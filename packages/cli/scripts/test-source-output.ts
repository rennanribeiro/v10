import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

import tailwindcss from '@tailwindcss/vite';
import { build, type InlineConfig, type PluginOption } from 'vite';

type Framework = 'html' | 'react';
type Style = 'css' | 'tailwind';

const execute = promisify(execFile);
const cli = resolve(import.meta.dirname, '../dist/index.mjs');
const skins = [
  'video',
  'minimal-video',
  'audio',
  'minimal-audio',
  'live-video',
  'minimal-live-video',
  'live-audio',
  'minimal-live-audio',
] as const;
const components = ['play-button', 'mute-button'] as const;

for (const framework of ['react', 'html'] as const) {
  for (const style of ['css', 'tailwind'] as const) await verifyFixture(framework, style);
}

async function verifyFixture(framework: Framework, style: Style): Promise<void> {
  const root = await mkdtemp(resolve(tmpdir(), `videojs-source-${framework}-${style}-`));

  try {
    await writeFile(resolve(root, 'package.json'), fixturePackageJson(framework, style));

    if (style === 'tailwind') await linkTailwind(root);

    for (const skin of skins) await installItem(root, framework, style, 'skin', skin, `src/videojs/${skin}`);

    for (const component of components) {
      await installItem(root, framework, style, 'component', component, 'src/videojs/components');
    }

    await validateOwnedSource(root);
    await buildFixture(root, framework, style);
    console.log(`Verified source output for ${framework}/${style}.`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function installItem(
  root: string,
  framework: Framework,
  style: Style,
  kind: 'component' | 'skin',
  name: string,
  path: string
): Promise<void> {
  const args = ['add', kind, name, '--cwd', root, '--framework', framework, '--style', style, '--path', path, '--yes'];

  await execute(process.execPath, [cli, ...args], { maxBuffer: 50 * 1024 * 1024 });

  const replay = await execute(process.execPath, [cli, ...args, '--json'], { maxBuffer: 50 * 1024 * 1024 });
  const result: ChangeSetResult = JSON.parse(replay.stdout);

  if (result.files.some((file) => file.status !== 'unchanged')) {
    throw new Error(`${framework}/${style}/${kind}/${name} is not idempotent.`);
  }
}

interface ChangeSetResult {
  readonly files: readonly { readonly path: string; readonly status: string }[];
}

interface FixturePackageJson {
  readonly name: string;
  readonly private: boolean;
  readonly type: string;
  readonly dependencies: Readonly<Record<string, string>>;
  devDependencies?: Readonly<Record<string, string>> | undefined;
}

async function validateOwnedSource(root: string): Promise<void> {
  const sourceRoot = resolve(root, 'src/videojs');
  const files = await walkFiles(sourceRoot);
  const packageJson: {
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly devDependencies?: Readonly<Record<string, string>>;
  } = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const packages = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ]);

  for (const filename of files) {
    const source = await readFile(filename, 'utf8');

    if (source.includes('virtual:vjsc') || source.includes("from 'vjsc'") || source.includes('from "vjsc"')) {
      throw new Error(`Compiler runtime leaked into ${filename}.`);
    }

    for (const specifier of importSpecifiers(source)) {
      if (specifier.startsWith('.')) {
        if (!(await resolvesRelativeImport(filename, specifier))) {
          throw new Error(`Cannot resolve ${specifier} from ${filename}.`);
        }

        continue;
      }

      if (isAbsolute(specifier) || specifier.startsWith('virtual:')) {
        throw new Error(`Private import ${specifier} leaked into ${filename}.`);
      }

      const packageName = packageFromSpecifier(specifier);
      if (!packages.has(packageName)) throw new Error(`Undeclared package ${packageName} is imported by ${filename}.`);
    }
  }
}

async function buildFixture(root: string, framework: Framework, style: Style): Promise<void> {
  const entry = framework === 'react' ? await writeReactEntry(root) : await writeHtmlEntry(root, style);
  const plugins: PluginOption[] = style === 'tailwind' ? [tailwindcss()] : [];
  const buildOptions: NonNullable<InlineConfig['build']> = {
    write: false,
    rollupOptions: { external: (id) => isBareImport(id) },
  };

  if (framework === 'react') buildOptions.lib = { entry, formats: ['es'] };
  else buildOptions.rollupOptions = { ...buildOptions.rollupOptions, input: entry };

  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins,
    build: buildOptions,
  });
}

async function writeReactEntry(root: string): Promise<string> {
  const imports: string[] = [];

  for (const [index, skin] of skins.entries()) {
    const directory = resolve(root, 'src/videojs', skin);
    const entries = (await walkFiles(directory)).filter((filename) => /\/skins\/[^/]+\/skin\.tsx$/.test(filename));
    if (entries.length !== 1) throw new Error(`Expected one React entry for ${skin}, found ${entries.length}.`);

    imports.push(`import * as Skin${index} from ${JSON.stringify(relativeImport(root, entries[0]!))};`);
    imports.push(`void Skin${index};`);
  }

  for (const [index, component] of components.entries()) {
    const entry = resolve(root, 'src/videojs/components/components/buttons', `${component}.tsx`);

    imports.push(`import * as Component${index} from ${JSON.stringify(relativeImport(root, entry))};`);
    imports.push(`void Component${index};`);
  }

  const entry = resolve(root, 'source-output.ts');

  await writeFile(entry, `${imports.join('\n')}\n`);
  return entry;
}

async function writeHtmlEntry(root: string, style: Style): Promise<string> {
  const markup: string[] = [];
  const imports: string[] = [];

  for (const skin of skins) {
    const directory = resolve(root, 'src/videojs', skin);

    markup.push(await readFile(resolve(directory, `${skin}.html`), 'utf8'));

    const stylesheet = `styles/${skin}${style === 'tailwind' ? '.tailwind' : ''}.css`;

    for (const path of [`${skin}.register.ts`, stylesheet]) {
      imports.push(`import ${JSON.stringify(relativeImport(root, resolve(directory, path)))};`);
    }
  }

  for (const component of components) {
    const directory = resolve(root, 'src/videojs/components');
    const stylesheet = `styles/${component}${style === 'tailwind' ? '.tailwind' : ''}.css`;

    markup.push(await readFile(resolve(directory, `${component}.html`), 'utf8'));

    for (const path of [`${component}.register.ts`, stylesheet]) {
      imports.push(`import ${JSON.stringify(relativeImport(root, resolve(directory, path)))};`);
    }
  }

  const entry = resolve(root, 'index.html');

  await writeFile(
    entry,
    `<!doctype html><html><body>${markup.join('\n')}<script type="module">${imports.join('\n')}</script></body></html>\n`
  );
  return entry;
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);

      return entry.isDirectory() ? walkFiles(path) : [path];
    })
  );

  return files.flat().sort();
}

async function linkTailwind(root: string): Promise<void> {
  const modules = resolve(root, 'node_modules');

  await mkdir(modules);
  await symlink(resolve(import.meta.dirname, '../node_modules/tailwindcss'), resolve(modules, 'tailwindcss'), 'dir');
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g)].map(
    (match) => match[1]!
  );
}

async function resolvesRelativeImport(importer: string, specifier: string): Promise<boolean> {
  const requested = resolve(importer, '..', specifier);
  const candidates = [
    requested,
    ...['.ts', '.tsx', '.js', '.jsx', '.css'].map((extension) => `${requested}${extension}`),
  ];

  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      return true;
    } catch {
      // Try the next supported source extension.
    }
  }

  return false;
}

function fixturePackageJson(framework: Framework, style: Style): string {
  const dependencies =
    framework === 'react' ? { '@videojs/react': 'latest', react: '^19.0.0' } : { '@videojs/html': 'latest' };
  const packageJson: FixturePackageJson = {
    name: `videojs-${framework}-${style}-fixture`,
    private: true,
    type: 'module',
    dependencies,
  };

  if (style === 'tailwind') packageJson.devDependencies = { tailwindcss: '^4.0.0' };

  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function packageFromSpecifier(specifier: string): string {
  const [scopeOrName, name] = specifier.split('/');

  return scopeOrName!.startsWith('@') && name ? `${scopeOrName}/${name}` : scopeOrName!;
}

function relativeImport(root: string, filename: string): string {
  const path = relative(root, filename).split('\\').join('/');

  return path.startsWith('.') ? path : `./${path}`;
}

function isBareImport(id: string): boolean {
  return !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0');
}
