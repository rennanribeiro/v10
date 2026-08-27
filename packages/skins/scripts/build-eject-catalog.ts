import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, posix, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createLogger, createServer, type LoadResult, type Plugin, type ViteDevServer } from 'vite';

import { analyzeImports } from '../../vjsc/src/shadcn/analyze.ts';
import type { SkinComponentMeta, SkinMeta } from '../vjsc/meta.ts';

type ArtifactMeta = SkinComponentMeta | SkinMeta;
type Framework = 'html' | 'react';
type Style = 'css' | 'tailwind';

interface CatalogFile {
  readonly path: string;
  readonly sources: readonly string[];
}

interface CatalogItem {
  readonly kind: 'component' | 'skin';
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly framework: Framework;
  readonly style: Style;
  readonly context: string;
  readonly entry: string;
  readonly stylesheet: string;
  readonly setup?: string | undefined;
  readonly contentMarker?: string | undefined;
  readonly posterMarker?: string | undefined;
  readonly files: readonly CatalogFile[];
  readonly dependencies: readonly string[];
  readonly devDependencies: readonly string[];
}

interface Catalog {
  readonly version: 1;
  readonly sources: Readonly<Record<string, string>>;
  readonly items: readonly CatalogItem[];
}

interface SourceArtifact {
  readonly filename: string;
  readonly meta: ArtifactMeta;
}

interface TransformConfig {
  readonly framework: Framework;
  readonly skin: string;
  readonly style: Style;
}

interface PlannedArtifact extends SourceArtifact, TransformConfig {
  readonly name: string;
}

const packageDir = resolve(import.meta.dirname, '..');
const vjscDir = resolve(packageDir, 'vjsc');
const outputFile = resolve(packageDir, 'dist/eject/catalog.json');
const configFile = resolve(packageDir, 'dev/vite.config.ts');
const frameworks = ['react', 'html'] as const;
const styles = ['css', 'tailwind'] as const;
const componentContexts = {
  'audio-play-button': ['default-audio', 'minimal-audio'],
  'audio-time-slider': ['default-audio', 'minimal-audio'],
  'captions-menu': ['default-live-video', 'minimal-live-video'],
  'live-button': ['default-live-video', 'minimal-live-video'],
  'live-playback-hotkeys': ['default-live-video', 'minimal-live-video'],
  'live-video-gestures': ['default-live-video', 'minimal-live-video'],
  'live-video-hotkeys': ['default-live-video', 'minimal-live-video'],
  'playback-rate-menu': ['default-audio', 'minimal-audio'],
} as const satisfies Readonly<Record<string, readonly [string, string]>>;
const defaultComponentContexts = ['default-video', 'minimal-video'] as const;
const internalComponents = new Set(['button-tooltip']);
const artifactExportNames = {
  'airplay-button': 'AirPlayButton',
  'pip-button': 'PiPButton',
} as const satisfies Readonly<Record<string, string>>;
const scriptExtensions = ['.tsx', '.ts', '.jsx', '.js'] as const;
const virtualCssPattern = /\bimport\s+["'](virtual:vjsc\/css\/[^"']+)["'];?\s*/g;
const htmlContentMarker = '<!-- Add your media element here. -->';
const htmlPosterMarker = '<!-- Replace the fallback image below to customize the poster. -->';

const captured = new Map<string, string>();
const capture: Plugin = {
  name: 'eject:capture-vjsc-source',
  enforce: 'pre',
  transform(code, id) {
    if (id.startsWith(`${vjscDir}${sep}`) && id.includes('?')) captured.set(id, normalizeSource(code));

    return null;
  },
};
const htmlStubs: Plugin = {
  name: 'eject:html-evaluation-stubs',
  enforce: 'pre',
  resolveId(id) {
    if (id.startsWith('@videojs/html/ui/') || id === '@videojs/html/i18n') return `\0eject:empty:${id}`;

    if (id === '@videojs/html/icons/element/register') return '\0eject:register-icons';

    return null;
  },
  load(id) {
    if (id.startsWith('\0eject:empty:')) return 'export {}';

    if (id === '\0eject:register-icons') return 'export function registerIcons() {}';

    return null;
  },
};

await buildCatalog();

async function buildCatalog(): Promise<void> {
  const sources = await sourceModules();
  const artifacts = await sourceArtifacts(sources);
  const plans = plannedArtifacts(artifacts);
  const configs = uniqueConfigs(plans);
  const logger = createLogger('silent');
  const server = await createServer({
    configFile,
    customLogger: logger,
    logLevel: 'silent',
    plugins: [htmlStubs, capture],
    optimizeDeps: { include: [], noDiscovery: true },
    server: { middlewareMode: true },
  });

  try {
    await transformSources(server, sources, configs);

    const contents = new Map<string, string>();
    const items: CatalogItem[] = [];

    for (const plan of plans) items.push(await buildItem(server, plan, sources, contents));

    items.sort((left, right) => itemKey(left).localeCompare(itemKey(right)));

    const catalog: Catalog = {
      version: 1,
      sources: Object.fromEntries([...contents].sort(([left], [right]) => left.localeCompare(right))),
      items,
    };

    await mkdir(dirname(outputFile), { recursive: true });
    await writeFile(outputFile, `${JSON.stringify(catalog)}\n`);

    console.log(
      `Built Eject catalog with ${items.length} variants and ${contents.size} deduplicated source files at ${relative(
        process.cwd(),
        outputFile
      )}.`
    );
  } finally {
    await server.close();
  }
}

async function sourceModules(): Promise<string[]> {
  return (await Promise.all([walkFiles(resolve(vjscDir, 'components')), walkFiles(resolve(vjscDir, 'skins'))]))
    .flat()
    .filter((filename) => scriptExtensions.some((extension) => extname(filename) === extension))
    .sort();
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });

  return (
    await Promise.all(
      entries.map((entry: Dirent) => {
        const path = resolve(directory, entry.name);

        return entry.isDirectory() ? walkFiles(path) : [path];
      })
    )
  ).flat();
}

async function sourceArtifacts(sources: readonly string[]): Promise<SourceArtifact[]> {
  const artifacts: SourceArtifact[] = [];

  for (const filename of sources) {
    const module = await import(pathToFileURL(filename).href);
    const meta = parseArtifactMeta(module.meta);

    if (meta && !internalComponents.has(meta.name)) artifacts.push({ filename, meta });
  }

  return artifacts.sort((left, right) => left.meta.name.localeCompare(right.meta.name));
}

function plannedArtifacts(artifacts: readonly SourceArtifact[]): PlannedArtifact[] {
  const plans: PlannedArtifact[] = [];

  for (const artifact of artifacts) {
    const contexts =
      artifact.meta.type === 'skin'
        ? [artifact.meta.name]
        : (componentContexts[artifact.meta.name] ?? defaultComponentContexts);

    for (const [index, skin] of contexts.entries()) {
      const name =
        artifact.meta.type === 'skin' ? artifact.meta.name : `${artifact.meta.name}${index === 1 ? '-minimal' : ''}`;

      for (const framework of frameworks) {
        for (const style of styles) plans.push({ ...artifact, name, framework, skin, style });
      }
    }
  }

  return plans;
}

function uniqueConfigs(plans: readonly PlannedArtifact[]): TransformConfig[] {
  const configs = new Map<string, TransformConfig>();

  for (const { framework, skin, style } of plans) {
    const config = { framework, skin, style } as const;

    configs.set(configKey(config), config);
  }

  return [...configs.values()];
}

async function transformSources(
  server: ViteDevServer,
  sources: readonly string[],
  configs: readonly TransformConfig[]
): Promise<void> {
  await Promise.all(
    configs.flatMap((config) =>
      sources.flatMap((filename) => {
        const ownedSkin = /^skins\/([^/]+)\//.exec(sourcePath(filename))?.[1];
        if (ownedSkin && ownedSkin !== config.skin) return [];

        return server.transformRequest(requestUrl(filename, config));
      })
    )
  );
}

async function buildItem(
  server: ViteDevServer,
  plan: PlannedArtifact,
  sources: readonly string[],
  contents: Map<string, string>
): Promise<CatalogItem> {
  const transformed = transformedSources(plan, sources);
  const closure = collectClosure(plan.filename, transformed);
  const files =
    plan.framework === 'react'
      ? await reactFiles(server, plan, closure, contents)
      : await htmlFiles(server, plan, closure, contents);
  const dependencies = plan.framework === 'html' ? new Set(['@videojs/html']) : collectPackageImports(closure.values());
  const devDependencies = new Set<string>();

  dependencies.delete('vjsc');
  dependencies.delete('tailwindcss');

  if (plan.style === 'tailwind') devDependencies.add('tailwindcss');

  return {
    kind: plan.meta.type,
    name: publicName(plan),
    title: plan.meta.title,
    description: plan.meta.description,
    framework: plan.framework,
    style: plan.style,
    context: plan.skin,
    entry: entryPath(plan),
    stylesheet: stylesheetPath(plan),
    setup: plan.framework === 'html' ? setupPath(plan) : undefined,
    contentMarker: plan.framework === 'html' && plan.meta.type === 'skin' ? htmlContentMarker : undefined,
    posterMarker:
      plan.framework === 'html' && plan.meta.type === 'skin' && plan.skin.includes('video')
        ? htmlPosterMarker
        : undefined,
    files,
    dependencies: [...dependencies].sort(),
    devDependencies: [...devDependencies].sort(),
  };
}

function transformedSources(plan: TransformConfig, sources: readonly string[]): ReadonlyMap<string, string> {
  const transformed = new Map<string, string>();

  for (const filename of sources) {
    const code = captured.get(moduleId(filename, plan));

    if (code) transformed.set(filename, code);
  }

  return transformed;
}

function collectClosure(entry: string, transformed: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const closure = new Map<string, string>();

  const visit = (filename: string): void => {
    if (closure.has(filename)) return;

    const code = transformed.get(filename);
    if (!code) throw new Error(`Eject catalog has no transformed source for ${filename}.`);

    closure.set(filename, code);

    for (const reference of analyzeImports(code, filename)) {
      if (!reference.specifier.startsWith('.')) continue;

      const dependency = resolveSourceImport(filename, reference.specifier, transformed);
      if (!dependency) throw new Error(`Cannot resolve ${reference.specifier} from ${filename}.`);

      visit(dependency);
    }
  };

  visit(entry);
  return closure;
}

function resolveSourceImport(
  importer: string,
  specifier: string,
  transformed: ReadonlyMap<string, string>
): string | undefined {
  const requested = resolve(dirname(importer), specifier);
  const candidates = [requested, ...scriptExtensions.map((extension) => `${requested}${extension}`)];

  return candidates.find((candidate) => transformed.has(candidate));
}

async function reactFiles(
  server: ViteDevServer,
  plan: PlannedArtifact,
  closure: ReadonlyMap<string, string>,
  contents: Map<string, string>
): Promise<CatalogFile[]> {
  const files: CatalogFile[] = [];
  const css = await catalogStyles(server, plan, closure.values(), contents);
  const stylesheet = stylesheetPath(plan);

  for (const [filename, original] of closure) {
    const path = sourcePath(filename);
    const source = stripVirtualCss(original);
    const content = filename === plan.filename ? injectStylesheet(source, path, stylesheet) : source;

    files.push(catalogFile(path, content, contents));
  }

  files.push(...css);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function htmlFiles(
  server: ViteDevServer,
  plan: PlannedArtifact,
  closure: ReadonlyMap<string, string>,
  contents: Map<string, string>
): Promise<CatalogFile[]> {
  const module = await server.ssrLoadModule(requestUrl(plan.filename, plan));
  const exported = module[artifactExportName(plan.meta)];
  if (!(exported instanceof Function)) throw new Error(`HTML artifact ${plan.filename} has no component export.`);

  // SAFETY: VJSC artifact metadata owns this exact named function export, verified above.
  const render = exported as (props: Record<string, never>) => { toString(): string };

  const original = String(render({}));
  const rendered = plan.meta.type === 'skin' ? lightDomHtml(original, plan.skin.includes('video')) : original;
  const files = [
    catalogFile(entryPath(plan), `${formatHtml(rendered)}\n`, contents),
    catalogFile(setupPath(plan), htmlRegistration(closure.values()), contents),
    ...(await catalogStyles(server, plan, closure.values(), contents)),
  ];

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function catalogStyles(
  server: ViteDevServer,
  plan: PlannedArtifact,
  sources: Iterable<string>,
  contents: Map<string, string>
): Promise<CatalogFile[]> {
  const files = await baseStyleFiles(plan, contents);

  if (plan.style === 'tailwind') {
    files.push(
      catalogFile(
        'styles/tailwind.shared.css',
        await readFile(resolve(vjscDir, 'styles/tailwind.shared.css'), 'utf8'),
        contents
      )
    );
    const tailwind = await readFile(resolve(vjscDir, 'styles/tailwind.css'), 'utf8');
    const imports = styleImports(plan)
      .filter((path) => path !== './base.css')
      .map((path) => `@import ${JSON.stringify(path)};`)
      .join('\n');

    files.push(
      catalogFile(
        stylesheetPath(plan),
        tailwind.replace('@import "./base.css";', `@import "./base.css";\n${imports}`),
        contents
      )
    );
    return files;
  }

  const generated = new Map<string, string>();

  for (const source of sources) {
    for (const id of virtualCssImports(source)) {
      if (id.endsWith('/base.css')) continue;

      const resolved = await server.environments.client.pluginContainer.resolveId(id);
      if (!resolved) throw new Error(`Cannot resolve generated stylesheet ${id}.`);

      const loaded = await server.environments.client.pluginContainer.load(resolved.id);
      const content = loadedSource(loaded);
      if (content === undefined) throw new Error(`Cannot load generated stylesheet ${id}.`);

      generated.set(id, content);
    }
  }

  files.push(
    catalogSourcesFile(
      stylesheetPath(plan),
      [
        `${styleImports(plan)
          .map((path) => `@import ${JSON.stringify(path)};`)
          .join('\n')}\n`,
        ...[...generated].sort(([left], [right]) => left.localeCompare(right)).map(([, content]) => content),
      ],
      contents
    )
  );

  return files;
}

async function baseStyleFiles(plan: PlannedArtifact, contents: Map<string, string>): Promise<CatalogFile[]> {
  const media = plan.skin.includes('audio') ? 'audio' : 'video';
  const variant = plan.skin.startsWith('minimal-') ? 'minimal' : 'default';
  const files = [...(media === 'video' ? ['captions.css'] : []), `themes/${media}.css`, `themes/${variant}.css`];
  const original = await readFile(resolve(vjscDir, 'styles/base.css'), 'utf8');
  const base = original.replace(/^@import .*;\n/gm, '');

  const supporting = await Promise.all(
    files.map(async (path) =>
      catalogFile(`styles/${path}`, await readFile(resolve(vjscDir, 'styles', path), 'utf8'), contents)
    )
  );

  return [catalogFile('styles/base.css', base, contents), ...supporting];
}

function htmlElements(sources: Iterable<string>): string {
  const imports = new Set<string>();

  for (const source of sources) {
    for (const match of source.matchAll(/^import\s+["'](@videojs\/html\/(?:ui\/[^"']+|i18n))["'];?$/gm)) {
      imports.add(match[1]!);
    }
  }

  return `${[...imports]
    .sort()
    .map((specifier) => `import ${JSON.stringify(specifier)};`)
    .join('\n')}\n`;
}

function htmlRegistration(sources: Iterable<string>): string {
  const values = [...sources];

  return `${htmlElements(values).trim()}\n\n${htmlIcons(values).trim()}\n`;
}

function htmlIcons(sources: Iterable<string>): string {
  const families = new Map<string, Map<string, string>>();

  for (const source of sources) {
    for (const match of source.matchAll(/registerIcons\("([^"]+)", \{([^}]+)\}\);/g)) {
      const icons = families.get(match[1]!) ?? new Map<string, string>();

      for (const pair of match[2]!.matchAll(/"([^"]+)":\s*([A-Za-z_$][\w$]*)/g)) icons.set(pair[1]!, pair[2]!);

      families.set(match[1]!, icons);
    }
  }

  if (families.size === 0) return '';

  const output = [`import { registerIcons } from '@videojs/html/icons/element/register';`];

  for (const [family, icons] of [...families].sort(([left], [right]) => left.localeCompare(right))) {
    const names = [...new Set(icons.values())].sort();
    const source = family === 'default' ? '@videojs/html/icons' : `@videojs/html/icons/${family}`;

    output.push(`import { ${names.join(', ')} } from ${JSON.stringify(source)};`);
  }

  output.push('');

  for (const [family, icons] of [...families].sort(([left], [right]) => left.localeCompare(right))) {
    const entries = [...icons]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, value]) => `${JSON.stringify(name)}: ${value}`)
      .join(', ');

    output.push(`registerIcons(${JSON.stringify(family)}, { ${entries} });`);
  }

  return `${output.join('\n')}\n`;
}

function collectPackageImports(sources: Iterable<string>): Set<string> {
  const packages = new Set<string>();

  for (const source of sources) {
    for (const { specifier, kind } of analyzeImports(source, 'artifact.tsx')) {
      if (kind === 'type' || specifier.startsWith('.') || specifier.startsWith('virtual:')) continue;

      packages.add(packageName(specifier));
    }
  }

  return packages;
}

function packageName(specifier: string): string {
  const [scopeOrName, name] = specifier.split('/');

  return scopeOrName!.startsWith('@') && name ? `${scopeOrName}/${name}` : scopeOrName!;
}

function catalogFile(path: string, content: string, contents: Map<string, string>): CatalogFile {
  return catalogSourcesFile(path, [content], contents);
}

function catalogSourcesFile(path: string, sources: readonly string[], contents: Map<string, string>): CatalogFile {
  const hashes: string[] = [];

  for (const content of sources) {
    const normalized = normalizeSource(content);
    const source = sourceHash(normalized);
    const previous = contents.get(source);
    if (previous !== undefined && previous !== normalized) throw new Error(`Catalog source hash collision: ${source}.`);

    contents.set(source, normalized);
    hashes.push(source);
  }

  return { path, sources: hashes };
}

function injectStylesheet(source: string, entry: string, stylesheet: string): string {
  const relativePath = posix.relative(posix.dirname(entry), stylesheet);
  const specifier = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
  const pragma = /^(\/\*\* @jsxImportSource[^\n]+\*\/\n)/.exec(source);

  return pragma
    ? `${pragma[1]}import ${JSON.stringify(specifier)};\n${source.slice(pragma[1].length)}`
    : `import ${JSON.stringify(specifier)};\n${source}`;
}

function stripVirtualCss(source: string): string {
  return source.replace(virtualCssPattern, '');
}

function virtualCssImports(source: string): string[] {
  return [...source.matchAll(new RegExp(virtualCssPattern.source, 'g'))].map((match) => match[1]!);
}

function publicName(plan: PlannedArtifact): string {
  if (plan.meta.type === 'skin' && plan.meta.name.startsWith('default-'))
    return plan.meta.name.slice('default-'.length);

  return plan.name;
}

function entryPath(plan: PlannedArtifact): string {
  return plan.framework === 'html'
    ? `${publicName(plan)}.html`
    : plan.meta.type === 'skin'
      ? sourcePath(plan.filename)
      : sourcePath(plan.filename);
}

function stylesheetPath(plan: PlannedArtifact): string {
  return `styles/${publicName(plan)}${plan.style === 'tailwind' ? '.tailwind' : ''}.css`;
}

function setupPath(plan: PlannedArtifact): string {
  return `${publicName(plan)}.register.ts`;
}

function styleImports(plan: PlannedArtifact): string[] {
  const media = plan.skin.includes('audio') ? 'audio' : 'video';
  const variant = plan.skin.startsWith('minimal-') ? 'minimal' : 'default';

  return [
    './base.css',
    ...(media === 'video' ? ['./captions.css'] : []),
    `./themes/${media}.css`,
    `./themes/${variant}.css`,
  ];
}

function requestUrl(filename: string, config: TransformConfig): string {
  const parameters = new URLSearchParams({ target: config.framework, skin: config.skin, style: config.style });

  return `/@fs${filename}?${parameters}`;
}

function moduleId(filename: string, config: TransformConfig): string {
  return `${filename}?skin=${config.skin}&style=${config.style}&target=${config.framework}`;
}

function configKey(config: TransformConfig): string {
  return `${config.framework}/${config.skin}/${config.style}`;
}

function itemKey(item: CatalogItem): string {
  return `${item.kind}/${item.name}/${item.framework}/${item.style}`;
}

function sourcePath(filename: string): string {
  return relative(vjscDir, filename).split(sep).join('/');
}

function sourceHash(source: string): string {
  return createHash('sha256').update(source).digest('hex').slice(0, 16);
}

function normalizeSource(source: string): string {
  return `${source
    .replaceAll('\r\n', '\n')
    .replace(/[ \t]+$/gm, '')
    .trim()}\n`;
}

function formatHtml(html: string): string {
  return html.replace(/></g, '>\n<');
}

function lightDomHtml(html: string, hasPoster: boolean): string {
  const content = html.replace(/<slot>\s*<\/slot>/, htmlContentMarker);
  if (content === html) throw new Error('HTML skin output has no default media slot.');

  const output = content.replace(/<slot name="poster">([\s\S]*?)<\/slot>/, `${htmlPosterMarker}$1`);
  if (hasPoster && output === content) throw new Error('HTML video skin output has no poster slot.');

  return output;
}

function parseArtifactMeta(value: Partial<ArtifactMeta> | undefined): ArtifactMeta | undefined {
  if (Object.prototype.toString.call(value) !== '[object Object]') return;

  // SAFETY: The external module value is checked field-by-field before it leaves this boundary.
  const meta = value as Partial<ArtifactMeta>;
  if ((meta.type !== 'component' && meta.type !== 'skin') || !meta.name || !meta.title || !meta.description) return;

  // SAFETY: Every shared ArtifactMeta field and discriminant was checked above; Skin-specific style is authored data.
  return meta as ArtifactMeta;
}

function artifactExportName(meta: ArtifactMeta): string {
  const explicit = artifactExportNames[meta.name];
  if (explicit) return explicit;

  const name = meta.name
    .split('-')
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join('');

  return meta.type === 'skin' ? `${name}Skin` : name;
}

function loadedSource(value: LoadResult | null): string | undefined {
  if (Object.prototype.toString.call(value) === '[object String]') return String(value);

  if (Object.prototype.toString.call(value) !== '[object Object]') return;

  // SAFETY: The plugin load result object is checked before reading its optional code field.
  const result = value as { code?: unknown | undefined };

  return Object.prototype.toString.call(result.code) === '[object String]' ? String(result.code) : undefined;
}
