import type { Dirent } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, posix, resolve } from 'node:path';

import { isString } from '@videojs/utils/predicate';
import type { Plugin, Rolldown } from 'vite';

import { analyzeImports, replaceImportSpecifiers } from '../../vjsc/src/shadcn/analyze.ts';
import type { VideojsRegistryMeta } from '../registry/meta.ts';

interface RegistryFile {
  readonly path: string;
  readonly target?: string | undefined;
  readonly content?: string | undefined;
}

interface RegistryItem {
  readonly name: string;
  readonly files?: readonly RegistryFile[] | undefined;
  readonly registryDependencies?: readonly string[] | undefined;
  readonly meta?: VideojsRegistryMeta | undefined;
}

interface RegistryGroup {
  readonly items: readonly RegistryItem[];
}

interface RegistryItemRecord {
  readonly directory: string;
  readonly item: RegistryItem;
}

interface MaterializedSource {
  readonly content: string;
  readonly destination: string;
  readonly meta?: VideojsRegistryMeta | undefined;
  readonly target: string;
}

export interface FrameworkArtifact {
  /** Workspace-relative output path. */
  readonly path: string;
  readonly content: string;
}

interface FrameworkSkinMaterializerOptions {
  readonly workspaceDir: string;
}

const registryPrefix = '@videojs/';
const installPrefix = 'components/videojs/';
const scriptExtensions = ['.ts', '.tsx', '.js', '.jsx'] as const;
const presets = ['video', 'audio', 'live-video', 'live-audio'] as const;

const backgroundSources = [
  ['packages/skins/framework/react/background/skin.tsx', 'packages/react/src/presets/background/skin.tsx'],
  ['packages/skins/framework/react/background/skin.css', 'packages/react/src/presets/background/skin.css'],
  ['packages/skins/framework/html/background/skin.ts', 'packages/html/src/presets/background/skin.ts'],
  ['packages/skins/framework/html/background/skin.css', 'packages/html/src/define/background/skin.css'],
] as const;

/** Materialize package-owned CSS skins from the canonical prepared registry after its single VJSC build. */
export function frameworkSkinMaterializer(options: FrameworkSkinMaterializerOptions): Plugin {
  return {
    name: 'skins:materialize-framework-skins',
    buildStart() {
      for (const [source] of backgroundSources) this.addWatchFile(resolve(options.workspaceDir, source));
    },
    async writeBundle(_outputOptions, bundle) {
      const registry = registryAssets(bundle);
      const artifacts = [...createReactSkinArtifacts(registry), ...(await backgroundArtifacts(options.workspaceDir))];
      const changed = await syncArtifacts(options.workspaceDir, artifacts);

      if (changed > 0) this.info(`Materialized ${changed} changed framework skin file${changed === 1 ? '' : 's'}.`);
    },
  };
}

/** Convert prepared registry assets into package-shaped React skin files without invoking VJSC again. */
export function createReactSkinArtifacts(assets: ReadonlyMap<string, string>): FrameworkArtifact[] {
  const items = registryItems(assets);
  const selected = [...items.values()]
    .filter(({ item }) => isReactCssSkin(item.meta))
    .sort((left, right) => left.item.name.localeCompare(right.item.name));

  if (selected.length !== presets.length * 2) {
    throw new Error(`Expected ${presets.length * 2} React CSS skin items, received ${selected.length}.`);
  }

  const sources = new Map<string, MaterializedSource>();

  for (const root of selected) {
    for (const record of dependencyClosure(root, items)) {
      if (record.item.meta?.role === 'support') continue;

      for (const file of record.item.files ?? []) {
        if (!file.target)
          throw new Error(`Registry item \`${record.item.name}\` has a file without an install target.`);

        const target = normalizeTarget(file.target);
        const content = file.content ?? assets.get(posix.join(record.directory, file.path));

        if (content === undefined) {
          throw new Error(`Registry item \`${record.item.name}\` has no source asset for \`${file.path}\`.`);
        }

        const meta = record === root ? root.item.meta : undefined;
        const destination = reactDestination(target, meta);
        const previous = sources.get(target);

        if (previous && (previous.content !== content || previous.destination !== destination)) {
          throw new Error(`React skin registry target \`${target}\` has conflicting materializations.`);
        }

        sources.set(target, { content, destination, meta, target });
      }
    }
  }

  const generated = [...sources.values()]
    .sort((left, right) => left.destination.localeCompare(right.destination))
    .map((source) => ({
      path: source.destination,
      content: packageSource(source, sources),
    }));
  const wrappers = selected.map(({ item }) => reactSkinWrapper(item.meta!, sources));

  return [...generated, ...wrappers].sort((left, right) => left.path.localeCompare(right.path));
}

function registryAssets(bundle: Rolldown.OutputBundle): Map<string, string> {
  return new Map(
    Object.values(bundle).flatMap((output) => {
      if (output.type !== 'asset') return [];

      const source = isString(output.source) ? output.source : new TextDecoder().decode(output.source);

      return [[output.fileName, source] as const];
    })
  );
}

function registryItems(assets: ReadonlyMap<string, string>): Map<string, RegistryItemRecord> {
  const items = new Map<string, RegistryItemRecord>();

  for (const [path, source] of assets) {
    if (path === 'registry.json' || !path.endsWith('/registry.json')) continue;

    // SAFETY: The canonical registry emitter owns these included group assets and validates their item manifests.
    const parsed = JSON.parse(source) as RegistryGroup;
    const directory = posix.dirname(path);

    for (const item of parsed.items) {
      if (items.has(item.name)) throw new Error(`Prepared registry declares \`${item.name}\` more than once.`);

      items.set(item.name, { directory, item });
    }
  }

  return items;
}

function dependencyClosure(
  root: RegistryItemRecord,
  items: ReadonlyMap<string, RegistryItemRecord>
): RegistryItemRecord[] {
  const closure: RegistryItemRecord[] = [];
  const visited = new Set<string>();

  const visit = (record: RegistryItemRecord): void => {
    if (visited.has(record.item.name)) return;

    visited.add(record.item.name);

    for (const dependency of record.item.registryDependencies ?? []) {
      if (!dependency.startsWith(registryPrefix)) continue;

      const name = dependency.slice(registryPrefix.length);
      const target = items.get(name);

      if (!target)
        throw new Error(`Registry dependency \`${dependency}\` required by \`${record.item.name}\` is missing.`);

      visit(target);
    }

    closure.push(record);
  };

  visit(root);
  return closure;
}

function isReactCssSkin(meta: VideojsRegistryMeta | undefined): meta is VideojsRegistryMeta & {
  readonly framework: 'react';
  readonly preset: NonNullable<VideojsRegistryMeta['preset']>;
  readonly styling: 'css';
  readonly variant: NonNullable<VideojsRegistryMeta['variant']>;
} {
  return (
    meta?.role === 'skin' &&
    meta.framework === 'react' &&
    meta.styling === 'css' &&
    Boolean(meta.preset && meta.variant)
  );
}

function normalizeTarget(target: string): string {
  const normalized = posix.normalize(target);

  if (!normalized.startsWith(installPrefix))
    throw new Error(`Registry target is outside \`${installPrefix}\`: \`${target}\`.`);

  return normalized;
}

function reactDestination(target: string, meta: VideojsRegistryMeta | undefined): string {
  const relative = target.slice(installPrefix.length);

  if (isReactCssSkin(meta) && !relative.includes('/internal/') && posix.basename(relative) === 'skin.css') {
    const name = meta.variant === 'minimal' ? 'minimal-skin.css' : 'skin.css';

    return `packages/react/src/presets/${meta.preset}/${name}`;
  }

  return `packages/react/src/internal/skins/${relative}`;
}

function packageSource(source: MaterializedSource, sources: ReadonlyMap<string, MaterializedSource>): string {
  if (source.target.endsWith('.css')) return source.content;

  const content = isReactCssSkin(source.meta)
    ? source.content.replace(/^\s*import\s+['"]\.\/skin\.css['"];?\s*$/m, '')
    : source.content;
  const replacements = analyzeImports(content, source.target).flatMap((reference) => {
    const frameworkImport = reactFrameworkImport(reference.specifier);
    if (frameworkImport) return [{ ...reference, replacement: relativeImport(source.destination, frameworkImport) }];

    if (reference.specifier === '@/components/videojs/utils') {
      return [{ ...reference, replacement: '@videojs/utils/style' }];
    }

    const target = resolveRegistryImport(source.target, reference.specifier, sources);
    if (!target) return [];

    const dependency = sources.get(target);
    if (!dependency) throw new Error(`Materialized import target \`${target}\` is missing.`);

    return [{ ...reference, replacement: relativeImport(source.destination, dependency.destination) }];
  });
  const rewritten = replaceImportSpecifiers(content, replacements);

  return rewritten;
}

function reactFrameworkImport(specifier: string): string | undefined {
  if (specifier === '@videojs/react') return 'packages/react/src/internal/skin-primitives.ts';

  if (specifier === '@videojs/react/icons') return 'packages/react/src/icons/index.ts';

  if (specifier === '@videojs/react/icons/minimal') return 'packages/react/src/icons/minimal/index.ts';

  return undefined;
}

function resolveRegistryImport(
  importer: string,
  specifier: string,
  sources: ReadonlyMap<string, MaterializedSource>
): string | undefined {
  let requested: string;

  if (specifier.startsWith('@/components/videojs/')) {
    requested = `${installPrefix}${specifier.slice('@/components/videojs/'.length)}`;
  } else if (specifier.startsWith('.')) {
    requested = posix.normalize(posix.join(posix.dirname(importer), specifier));
  } else {
    return undefined;
  }

  const candidates = [
    requested,
    ...scriptExtensions.map((extension) => `${requested}${extension}`),
    `${requested}.css`,
    ...scriptExtensions.map((extension) => posix.join(requested, `index${extension}`)),
  ];

  return candidates.find((candidate) => sources.has(candidate));
}

function relativeImport(importer: string, dependency: string): string {
  let path = posix.relative(posix.dirname(importer), dependency);

  if (scriptExtensions.some((extension) => path.endsWith(extension))) path = path.slice(0, -extname(path).length);

  if (!path.startsWith('.')) path = `./${path}`;

  return path;
}

function pascalCase(value: string): string {
  return value.replace(/(?:^|-)([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function reactSkinWrapper(
  meta: VideojsRegistryMeta,
  sources: ReadonlyMap<string, MaterializedSource>
): FrameworkArtifact {
  if (!isReactCssSkin(meta)) throw new Error('React package wrappers require CSS skin metadata.');

  const presetName = pascalCase(meta.preset);
  const variantName = meta.variant === 'minimal' ? 'Minimal' : '';
  const componentName = `${variantName}${presetName}Skin`;
  const generatedName = `${meta.variant === 'default' ? 'Default' : 'Minimal'}${presetName}Skin`;
  const file = meta.variant === 'minimal' ? 'minimal-skin.tsx' : 'skin.tsx';
  const path = `packages/react/src/presets/${meta.preset}/${file}`;
  const generatedTarget = `components/videojs/skins/${meta.preset}${meta.variant === 'minimal' ? '-minimal' : ''}-css/skin.tsx`;
  const generated = sources.get(generatedTarget);
  if (!generated) throw new Error(`React skin wrapper source \`${generatedTarget}\` is missing.`);

  const props = `${componentName}Props`;
  const baseProps = meta.media === 'video' ? 'BaseVideoSkinProps' : 'BaseSkinProps';
  const importSource = relativeImport(path, generated.destination);
  const parameters = meta.media === 'video' ? `{ renderPoster, ...props }: ${props}` : `props: ${props}`;
  const forwarded = meta.media === 'video' ? 'poster={renderPoster} {...props}' : '{...props}';

  return {
    path,
    content: `'use client';

import { ${generatedName} as GeneratedSkin } from '${importSource}';

import type { ${baseProps} } from '../types';

/** Props for the packaged ${meta.variant} ${meta.preset.replace('-', ' ')} skin. */
export interface ${props} extends ${baseProps} {}

/** Render the packaged ${meta.variant} ${meta.preset.replace('-', ' ')} skin. */
export function ${componentName}(${parameters}) {
  return <GeneratedSkin ${forwarded} />;
}
`,
  };
}

async function backgroundArtifacts(workspaceDir: string): Promise<FrameworkArtifact[]> {
  return Promise.all(
    backgroundSources.map(async ([source, path]) => ({
      path,
      content: await readFile(resolve(workspaceDir, source), 'utf8'),
    }))
  );
}

async function syncArtifacts(workspaceDir: string, artifacts: readonly FrameworkArtifact[]): Promise<number> {
  const expected = new Map(artifacts.map((artifact) => [artifact.path, artifact.content]));
  const existing = new Set<string>([
    ...(await filesWithin(workspaceDir, 'packages/react/src/internal/skins')),
    ...ownedPublicPaths(),
  ]);
  let changed = 0;

  for (const path of existing) {
    if (expected.has(path)) continue;

    await rm(resolve(workspaceDir, path), { force: true });
    changed += 1;
  }

  for (const [path, content] of expected) {
    const filename = resolve(workspaceDir, path);
    const current = await readFile(filename, 'utf8').catch(() => undefined);
    if (current === content) continue;

    await mkdir(dirname(filename), { recursive: true });
    await writeFile(filename, content);
    changed += 1;
  }

  return changed;
}

async function filesWithin(workspaceDir: string, root: string): Promise<string[]> {
  const directory = resolve(workspaceDir, root);
  const entries = await readdir(directory, { withFileTypes: true }).catch((): Dirent[] => []);

  return (
    await Promise.all(
      entries.map((entry) => {
        const path = posix.join(root, entry.name);

        return entry.isDirectory() ? filesWithin(workspaceDir, path) : [path];
      })
    )
  ).flat();
}

function ownedPublicPaths(): string[] {
  const react = presets.flatMap((preset) =>
    ['skin.tsx', 'skin.css', 'minimal-skin.tsx', 'minimal-skin.css'].map(
      (file) => `packages/react/src/presets/${preset}/${file}`
    )
  );

  return [
    ...react,
    'packages/react/src/presets/background/skin.tsx',
    'packages/react/src/presets/background/skin.css',
    'packages/html/src/presets/background/skin.ts',
    'packages/html/src/define/background/skin.css',
  ];
}
