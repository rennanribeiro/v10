import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';

import { isPlainObject, isString } from '@videojs/utils/predicate';
import { registryItemSchema, registrySchema, type RegistryItem } from 'shadcn/schema';

import { formatRegistrySource } from '../shadcn/format';

const packageDir = resolve(import.meta.dirname, '..');
const workspaceDir = resolve(packageDir, '../..');
const sourceRegistry = resolve(packageDir, 'dist/registry/source/registry.json');
const hostedDir = resolve(packageDir, 'dist/registry/r');
const shadcnBin = resolve(packageDir, 'node_modules/shadcn/dist/index.js');
const typecheckBin = resolve(workspaceDir, 'node_modules/.bin/tsgo');
const generatedSource = /\.(?:css|[cm]?[jt]sx?)$/;

const registry = registrySchema.parse(JSON.parse(await readFile(resolve(hostedDir, 'registry.json'), 'utf8')));
const items = await validateHostedItems(registry.items);

await runShadcn(['registry', 'validate', sourceRegistry, '--cwd', packageDir], packageDir);
await assertIgnoredOutput();

const server = createServer();
const address = await listen(server);

server.on('request', async (request, response) => {
  const path = new URL(request.url ?? '/', address).pathname.slice(1);
  const source = await readFile(resolve(hostedDir, path)).catch(() => undefined);

  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('cache-control', 'no-store');

  if (!source) {
    response.statusCode = 404;
    response.end('Not found.');
    return;
  }

  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(source);
});

try {
  await validateDiscovery(address, items);
  await validateInstalls(address, items);
} finally {
  await close(server);
}

console.log(`Validated ${items.length} hosted Shadcn items with stock discovery, view, and install commands.`);

async function validateHostedItems(manifests: readonly RegistryItem[]): Promise<RegistryItem[]> {
  const files = (await readdir(hostedDir)).filter((path) => path.endsWith('.json')).sort();
  const expected = ['registry.json', ...manifests.map((item) => `${item.name}.json`)].sort();

  if (files.join('\n') !== expected.join('\n')) {
    throw new Error(
      `Hosted registry files do not match the catalog.\nExpected: ${expected.length}\nActual: ${files.length}`
    );
  }

  return Promise.all(
    manifests.map(async (manifest) => {
      const item = registryItemSchema.parse(
        JSON.parse(await readFile(resolve(hostedDir, `${manifest.name}.json`), 'utf8'))
      );
      if (item.name !== manifest.name) throw new Error(`Hosted registry item name mismatch: ${manifest.name}.`);

      validateHtmlItem(item);

      for (const file of item.files ?? []) {
        if (!file.content || !generatedSource.test(file.target ?? file.path)) continue;

        const formatted = await formatRegistrySource(file.target ?? file.path, file.content);

        if (formatted.errors.length > 0 || formatted.code !== file.content) {
          throw new Error(`Hosted registry source is not formatted: ${item.name}/${file.path}.`);
        }
      }

      return item;
    })
  );
}

function validateHtmlItem(item: RegistryItem): void {
  if (item.meta?.framework !== 'html') return;

  const files = item.files ?? [];

  if (item.meta.role === 'skin') {
    const template = files.find((file) => file.target?.endsWith('/skin.html'))?.content;
    const registration = files.find((file) => file.target?.endsWith('/skin.ts'))?.content;

    if (!template?.includes('<media-container') || !template.includes('Add a compatible media element here')) {
      throw new Error(`Hosted HTML skin \`${item.name}\` has no complete editable template.`);
    }

    if (!registration?.includes(`@videojs/html/ui/container`) || registration.includes('vjsc')) {
      throw new Error(`Hosted HTML skin \`${item.name}\` has no exact package registration.`);
    }

    if (files.some((file) => file.target?.endsWith('.tsx'))) {
      throw new Error(`Hosted HTML skin \`${item.name}\` contains compiler-owned TSX.`);
    }
  }

  if (item.meta.role === 'player') {
    const template = files.find((file) => file.target?.endsWith('.html'))?.content;

    if (!template?.includes('<media-container') || /<(?:live-)?(?:video|audio)-(?:minimal-)?skin\b/.test(template)) {
      throw new Error(`Hosted HTML Player \`${item.name}\` does not contain its complete skin template.`);
    }
  }
}

async function validateDiscovery(address: string, hostedItems: readonly RegistryItem[]): Promise<void> {
  await withFixture(address, async (root) => {
    const search = await runShadcn(
      ['search', `${address}/registry.json`, '--limit', '200', '--json', '--cwd', root],
      root
    );
    const result = JSON.parse(search.stdout);

    if (!isPlainObject(result) || !Array.isArray(result.items)) {
      throw new Error('Shadcn search did not return an item list.');
    }

    const names = result.items.flatMap((item) => (isPlainObject(item) && isString(item.name) ? [item.name] : []));

    if (names.length !== hostedItems.length) {
      throw new Error(`Shadcn search returned ${names.length} items; expected ${hostedItems.length}.`);
    }

    const view = await runShadcn(['view', `${address}/react-video.json`, '--cwd', root], root);
    const viewed = registryItemSchema.array().parse(JSON.parse(view.stdout));

    if (!viewed.some((item) => item.name === 'react-video')) {
      throw new Error('Shadcn view did not return `react-video`.');
    }
  });
}

async function validateInstalls(address: string, hostedItems: readonly RegistryItem[]): Promise<void> {
  const publicItems = hostedItems.filter((item) => item.meta?.public === true);
  const batches = groupInstallItems(publicItems);

  await withFixture(address, async (root) => {
    for (const [key, batch] of batches) {
      await rm(resolve(root, 'src/components/videojs'), { recursive: true, force: true });
      await add(
        root,
        batch.map((item) => `@videojs/${item.name}`)
      );
      await assertInstalled(root, batch);

      if (key === 'react/player/tailwind/default') await typecheckFixture(root);
    }

    await rm(resolve(root, 'src/components/videojs'), { recursive: true, force: true });
    await add(root, ['@videojs/react-video']);

    const before = await sourceHashes(resolve(root, 'src/components/videojs'));

    await add(root, ['@videojs/react-video']);

    const after = await sourceHashes(resolve(root, 'src/components/videojs'));

    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error('Installing `react-video` twice changed its source output.');
    }
  });
}

function groupInstallItems(items: readonly RegistryItem[]): ReadonlyMap<string, RegistryItem[]> {
  const batches = new Map<string, RegistryItem[]>();

  for (const item of items) {
    const fields = ['framework', 'role', 'styling', 'variant'].map((field) => {
      const value = item.meta?.[field];

      return isString(value) ? value : 'none';
    });
    const key = fields.join('/');
    const batch = batches.get(key) ?? [];

    batch.push(item);
    batches.set(key, batch);
  }

  return batches;
}

async function withFixture(address: string, run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(resolve(tmpdir(), 'videojs-shadcn-'));

  try {
    await writeFixture(root, address);
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writeFixture(root: string, address: string): Promise<void> {
  const packageJson = {
    name: 'videojs-shadcn-validation',
    private: true,
    type: 'module',
    packageManager: 'pnpm@11.17.0',
    dependencies: {
      '@videojs/core': '*',
      '@videojs/html': '10.0.0-beta.32',
      '@videojs/react': '10.0.0-beta.32',
      clsx: '*',
      react: '*',
      'tailwind-merge': '*',
      vjsc: '*',
    },
  };
  const components = {
    $schema: 'https://ui.shadcn.com/schema.json',
    style: 'new-york',
    rsc: false,
    tsx: true,
    tailwind: {
      config: '',
      css: 'src/index.css',
      baseColor: 'neutral',
      cssVariables: true,
      prefix: '',
    },
    aliases: {
      components: '@/components',
      ui: '@/components/ui',
      utils: '@/lib/utils',
      lib: '@/lib',
      hooks: '@/hooks',
    },
    registries: {
      '@videojs': `${address}/{name}.json`,
    },
  };
  const tsconfig = {
    compilerOptions: {
      jsx: 'react-jsx',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      noEmit: true,
      paths: { '@/*': ['./src/*'] },
      skipLibCheck: true,
      strict: true,
      target: 'ES2022',
    },
    include: ['src'],
  };

  await mkdir(resolve(root, 'src'), { recursive: true });
  await writeFile(resolve(root, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  await writeFile(resolve(root, 'components.json'), `${JSON.stringify(components, null, 2)}\n`);
  await writeFile(resolve(root, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`);
  await writeFile(resolve(root, 'src/index.css'), '@import "./components/videojs/styles/tailwind.css";\n');
  await linkModules(root);
}

async function linkModules(root: string): Promise<void> {
  const modules = resolve(root, 'node_modules');
  const videojs = resolve(modules, '@videojs');
  const types = resolve(modules, '@types');

  await mkdir(videojs, { recursive: true });
  await mkdir(types, { recursive: true });

  for (const name of ['clsx', 'react', 'react-dom', 'tailwind-merge'] as const) {
    const target = resolve(modules, name);

    await rm(target, { recursive: true, force: true });
    await symlink(resolve(packageDir, 'node_modules', name), target, 'dir');
  }

  for (const name of ['react', 'react-dom'] as const) {
    const target = resolve(types, name);

    await rm(target, { recursive: true, force: true });
    await symlink(resolve(packageDir, 'node_modules/@types', name), target, 'dir');
  }

  for (const name of ['core', 'html', 'icons', 'react', 'utils'] as const) {
    const target = resolve(videojs, name);

    await rm(target, { recursive: true, force: true });
    await symlink(resolve(workspaceDir, 'packages', name), target, 'dir');
  }

  const vjsc = resolve(modules, 'vjsc');

  await rm(vjsc, { recursive: true, force: true });
  await symlink(resolve(workspaceDir, 'packages/vjsc'), vjsc, 'dir');
}

async function add(root: string, names: readonly string[]): Promise<void> {
  await runShadcn(['add', ...names, '--cwd', root, '--yes', '--overwrite', '--silent'], root);
}

async function assertInstalled(root: string, items: readonly RegistryItem[]): Promise<void> {
  for (const item of items) {
    for (const file of item.files ?? []) {
      if (!file.target) continue;

      const installed = resolve(root, 'src', file.target);
      const source = await readFile(installed, 'utf8').catch(() => undefined);
      if (!source) throw new Error(`Shadcn did not install ${item.name}: ${file.target}.`);
    }
  }
}

async function typecheckFixture(root: string): Promise<void> {
  // Shadcn installs declared registry dependencies while adding items, which can
  // replace these fixture links with the latest published beta. Typecheck the
  // generated source against the workspace contract this registry was built for.
  await linkModules(root);
  await runCommand(typecheckBin, ['--project', resolve(root, 'tsconfig.json')], root);
}

async function sourceHashes(directory: string): Promise<Array<readonly [string, string]>> {
  const files = await walkFiles(directory);

  return Promise.all(
    files.map(async (filename) => {
      const source = await readFile(filename);

      return [relative(directory, filename), createHash('sha256').update(source).digest('hex')] as const;
    })
  );
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);

      return entry.isDirectory() ? walkFiles(path) : [path];
    })
  );

  return files.flat().sort();
}

async function assertIgnoredOutput(): Promise<void> {
  await Promise.all(
    [sourceRegistry, hostedDir].map((path) =>
      runCommand('git', ['check-ignore', '--quiet', relative(workspaceDir, path)], workspaceDir)
    )
  );
}

async function runShadcn(
  args: readonly string[],
  cwd: string
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  return runCommand(process.execPath, [shadcnBin, ...args], cwd);
}

async function runCommand(
  executable: string,
  args: readonly string[],
  cwd: string
): Promise<{ readonly stdout: string; readonly stderr: string }> {
  return new Promise((resolvePromise, reject) => {
    execFile(
      executable,
      [...args],
      {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1' },
        maxBuffer: 100 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (!error) {
          resolvePromise({ stdout, stderr });
          return;
        }

        reject(
          new Error([`${executable} ${args.join(' ')}`, stdout, stderr].filter(Boolean).join('\n'), {
            cause: error,
          })
        );
      }
    );
  });
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });

  const address = server.address();
  if (!address || isString(address)) throw new Error('Could not resolve the registry server address.');

  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    server.close((error) => (error ? reject(error) : resolvePromise()));
  });
}
