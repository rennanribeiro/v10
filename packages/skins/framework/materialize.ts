import type { Dirent } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, posix, resolve } from 'node:path';

import { isString } from '@videojs/utils/predicate';
import { rolldown } from 'rolldown';
import type { Plugin, Rolldown } from 'vite';

import { HTML_RUNTIME } from '../../vjsc/src/plugins/html-runtime.ts';
import { analyzeImports, replaceImportSpecifiers } from '../../vjsc/src/shadcn/analyze.ts';
import type { VideojsRegistryMeta } from '../registry/meta.ts';

interface RegistryFile {
  readonly path: string;
  readonly target?: string | undefined;
  readonly type?: string | undefined;
  readonly content?: string | undefined;
}

interface RegistryItem {
  readonly name: string;
  readonly type?: string | undefined;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly files?: readonly RegistryFile[] | undefined;
  readonly dependencies?: readonly string[] | undefined;
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

interface HtmlSkinSource {
  readonly entry: MaterializedSource;
  readonly item: RegistryItem;
  readonly sources: ReadonlyMap<string, MaterializedSource>;
}

interface RenderedHtmlSkin extends HtmlSkinSource {
  readonly template: string;
}

type HtmlSkinRenderProps = Readonly<Record<never, never>>;

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
  let artifacts: readonly FrameworkArtifact[] | undefined;

  return {
    name: 'skins:materialize-framework-skins',
    buildStart() {
      for (const [source] of backgroundSources) this.addWatchFile(resolve(options.workspaceDir, source));
    },
    async generateBundle(_outputOptions, bundle) {
      const registry = registryAssets(bundle);
      const htmlSkins = await renderHtmlSkins(registry, options.workspaceDir, 'all');

      artifacts = [
        ...createReactSkinArtifacts(registry),
        ...createHtmlPackageArtifacts(htmlSkins),
        ...(await backgroundArtifacts(options.workspaceDir)),
      ];
      materializeHtmlRegistry(bundle, htmlSkins, (fileName, source) => {
        this.emitFile({ type: 'asset', fileName, source });
      });
    },
    async writeBundle() {
      if (!artifacts) throw new Error('Framework skin artifacts were not prepared before output.');

      const changed = await syncArtifacts(options.workspaceDir, artifacts);

      if (changed > 0) this.info(`Materialized ${changed} changed framework skin file${changed === 1 ? '' : 's'}.`);
    },
  };
}

/** Render package HTML once from prepared registry sources and materialize private template, registration, and CSS. */
export async function createHtmlSkinArtifacts(
  assets: ReadonlyMap<string, string>,
  workspaceDir: string
): Promise<FrameworkArtifact[]> {
  return createHtmlPackageArtifacts(await renderHtmlSkins(assets, workspaceDir, 'css'));
}

async function renderHtmlSkins(
  assets: ReadonlyMap<string, string>,
  workspaceDir: string,
  selection: 'all' | 'css'
): Promise<RenderedHtmlSkin[]> {
  const items = registryItems(assets);
  const selected = [...items.values()]
    .filter(({ item }) => (selection === 'all' ? isHtmlSkin(item.meta) : isHtmlCssSkin(item.meta)))
    .sort((left, right) => left.item.name.localeCompare(right.item.name));
  const expected = presets.length * 2 * (selection === 'all' ? 2 : 1);

  if (selected.length !== expected) {
    throw new Error(`Expected ${expected} HTML skin items, received ${selected.length}.`);
  }

  const skins = selected.map((root): HtmlSkinSource => {
    const sources = new Map<string, MaterializedSource>();

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

        const source = { content, destination: target, target };
        const previous = sources.get(target);

        if (previous && previous.content !== content) {
          throw new Error(`HTML skin registry target \`${target}\` has conflicting materializations.`);
        }

        sources.set(target, source);
      }
    }

    const meta = root.item.meta!;
    const entryTarget = htmlSkinEntryTarget(meta);
    const entry = sources.get(entryTarget);
    if (!entry) throw new Error(`HTML skin entry \`${entryTarget}\` is missing.`);

    return { entry, item: root.item, sources };
  });
  const templates = await renderHtmlSkinTemplates(skins, workspaceDir);

  return skins.map((skin) => {
    const template = templates.get(skin.item.name);
    if (template === undefined) throw new Error(`HTML skin \`${skin.item.name}\` did not render a template.`);

    return { ...skin, template };
  });
}

function createHtmlPackageArtifacts(skins: readonly RenderedHtmlSkin[]): FrameworkArtifact[] {
  const selected = skins.filter(({ item }) => isHtmlCssSkin(item.meta));

  if (selected.length !== presets.length * 2) {
    throw new Error(`Expected ${presets.length * 2} HTML CSS skin items, received ${selected.length}.`);
  }

  return selected.flatMap(({ item, sources, template }) => {
    const meta = item.meta!;
    const name = frameworkSkinName(meta);
    const root = `packages/html/src/internal/skins/${name}`;
    const stylesheet = sources.get(htmlSkinEntryTarget(meta).replace(/\.tsx$/, '.css'));
    if (!stylesheet) throw new Error(`HTML skin \`${item.name}\` has no stylesheet.`);

    return [
      { path: `${root}/template.ts`, content: htmlTemplateModule(template) },
      { path: `${root}/register.ts`, content: htmlRegistration(template, sources.values(), 'package') },
      { path: `${root}/skin.css`, content: stylesheet.content },
    ];
  });
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

function isHtmlCssSkin(meta: VideojsRegistryMeta | undefined): meta is VideojsRegistryMeta & {
  readonly framework: 'html';
  readonly preset: NonNullable<VideojsRegistryMeta['preset']>;
  readonly styling: 'css';
  readonly variant: NonNullable<VideojsRegistryMeta['variant']>;
} {
  return (
    meta?.role === 'skin' && meta.framework === 'html' && meta.styling === 'css' && Boolean(meta.preset && meta.variant)
  );
}

function isHtmlSkin(meta: VideojsRegistryMeta | undefined): meta is VideojsRegistryMeta & {
  readonly framework: 'html';
  readonly preset: NonNullable<VideojsRegistryMeta['preset']>;
  readonly styling: NonNullable<VideojsRegistryMeta['styling']>;
  readonly variant: NonNullable<VideojsRegistryMeta['variant']>;
} {
  return meta?.role === 'skin' && meta.framework === 'html' && Boolean(meta.preset && meta.styling && meta.variant);
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

function frameworkSkinName(meta: VideojsRegistryMeta): string {
  if (!meta.preset || !meta.variant) throw new Error('Framework skin metadata requires a preset and variant.');

  return `${meta.variant}-${meta.preset}`;
}

function htmlSkinEntryTarget(meta: VideojsRegistryMeta): string {
  if (!isHtmlSkin(meta)) throw new Error('HTML materialization requires complete skin metadata.');

  const suffix = meta.variant === 'minimal' ? '-minimal' : '';
  const styling = meta.styling === 'css' ? '-css' : '';

  return `${installPrefix}skins/${meta.preset}${suffix}${styling}/skin.tsx`;
}

async function renderHtmlSkinTemplates(
  skins: readonly HtmlSkinSource[],
  workspaceDir: string
): Promise<ReadonlyMap<string, string>> {
  const sources = new Map<string, string>();

  for (const skin of skins) {
    for (const source of skin.sources.values()) {
      if (!scriptExtensions.some((extension) => source.target.endsWith(extension))) continue;

      const id = `/${source.target}`;
      const previous = sources.get(id);

      if (previous !== undefined && previous !== source.content) {
        throw new Error(`HTML renderer source \`${source.target}\` has conflicting contents.`);
      }

      sources.set(id, source.content);
    }
  }

  const iconBindings = new Set<string>(['registerIcons']);

  for (const source of sources.values()) {
    for (const match of source.matchAll(/registerIcons\([^,]+,\s*\{([\s\S]*?)\}\);/g)) {
      for (const pair of match[1]!.matchAll(/(?:['"][^'"]+['"]|[A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)/g)) {
        iconBindings.add(pair[1]!);
      }
    }
  }

  const entry = skins
    .map(({ entry: source, item }, index) => {
      const meta = item.meta!;
      const exportName = `${meta.variant === 'minimal' ? 'Minimal' : 'Default'}${pascalCase(meta.preset!)}Skin`;

      return `export { ${exportName} as render${index} } from ${JSON.stringify(`/${source.target}`)};`;
    })
    .join('\n');
  const emptyId = '\0skins:html-render-empty';
  const entryId = '\0skins:html-render-entry';
  const iconsId = '\0skins:html-render-icons';
  const runtimeId = '\0skins:html-render-runtime';
  const aliases = new Map([
    ['@videojs/core/i18n/text/menu', resolve(workspaceDir, 'packages/core/src/core/i18n/text/menu.ts')],
    ['@videojs/utils/string', resolve(workspaceDir, 'packages/utils/src/string/index.ts')],
    ['vjsc/target', resolve(workspaceDir, 'packages/vjsc/src/target/attributes.ts')],
  ]);
  const build = await rolldown({
    input: entryId,
    treeshake: true,
    plugins: [
      {
        name: 'skins:render-html-templates',
        resolveId(id, importer) {
          if ([emptyId, entryId, iconsId, runtimeId].includes(id) || sources.has(id)) return id;

          const alias = aliases.get(id);
          if (alias) return alias;

          if (id === 'vjsc/html-runtime/jsx-runtime') return runtimeId;

          if (id.startsWith('@videojs/html/ui/') || id === '@videojs/html/i18n' || id.endsWith('.css')) return emptyId;

          if (id === '@videojs/html/icons' || id === '@videojs/html/icons/minimal') return iconsId;

          if (id.startsWith('.') && importer?.startsWith(`/${installPrefix}`)) {
            const requested = posix.normalize(posix.join(posix.dirname(importer), id));
            const resolved = [
              requested,
              ...scriptExtensions.map((extension) => `${requested}${extension}`),
              ...scriptExtensions.map((extension) => posix.join(requested, `index${extension}`)),
            ].find((candidate) => sources.has(candidate));
            if (resolved) return resolved;
          }

          return null;
        },
        load(id) {
          if (id === entryId) return { code: entry, moduleType: 'js' };

          if (id === emptyId) return { code: 'export {};', moduleType: 'js' };

          if (id === runtimeId) return { code: HTML_RUNTIME, moduleType: 'js' };

          if (id === iconsId) {
            const code = [...iconBindings]
              .sort()
              .map((name) => `export const ${name} = ${name === 'registerIcons' ? '() => {}' : "''"};`)
              .join('\n');

            return { code, moduleType: 'js' };
          }

          const source = sources.get(id);

          return source === undefined ? null : { code: source, moduleType: 'tsx' };
        },
      },
    ],
  });

  try {
    const output = await build.generate({ codeSplitting: false, format: 'esm' });
    const chunks = output.output.filter((value) => value.type === 'chunk');

    if (chunks.length !== 1 || chunks[0]!.imports.length > 0) {
      throw new Error('Prepared HTML skin renderer did not produce one self-contained module.');
    }

    const url = `data:text/javascript;base64,${Buffer.from(chunks[0]!.code).toString('base64')}`;
    // SAFETY: The self-contained module is produced from the canonical, already-transformed registry graph above.
    const rendered = (await import(url)) as Readonly<
      Record<string, (props?: HtmlSkinRenderProps) => { toString(): string }>
    >;

    return new Map(
      skins.map(({ item }, index) => {
        const render = rendered[`render${index}`];
        if (!render) throw new Error(`HTML skin \`${item.name}\` has no renderer export.`);

        return [item.name, formatHtml(String(render({})))] as const;
      })
    );
  } finally {
    await build.close();
  }
}

function htmlTemplateModule(html: string): string {
  const template = html.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');

  return `import { createTemplate } from '@videojs/utils/dom';

/** Static template rendered from the canonical prepared VJSC registry graph. */
export const template = createTemplate(/* html */ \`${template}\`);
`;
}

function htmlRegistration(
  html: string,
  sources: Iterable<MaterializedSource>,
  destination: 'package' | 'registry'
): string {
  const output: string[] = [];
  const tags = new Set<string>();
  const define = (tag: string): string =>
    destination === 'package' ? `../../../define/ui/${tag}` : `@videojs/html/ui/${tag}`;
  const i18n = destination === 'package' ? '../../../define/i18n' : '@videojs/html/i18n';
  const iconsRoot = destination === 'package' ? '../../../icons' : '@videojs/html/icons';

  for (const match of html.matchAll(/<media-([a-z0-9-]+)\b/g)) tags.add(match[1]!);

  if (tags.delete('text')) output.push(`import ${quote(i18n)};`);

  tags.delete('icon');

  output.push(...[...tags].map((tag) => `import ${quote(define(tag))};`));

  const families = iconRegistrations(sources);

  if (families.size > 0) {
    if (destination === 'package' && output.length > 0) output.push('');

    output.push(`import { registerIcons } from ${quote(iconsRoot)};`);
  }

  for (const [family, icons] of [...families].sort(([left], [right]) => left.localeCompare(right))) {
    const bindings = [...new Set(icons.values())].sort();
    const source = family === 'default' ? iconsRoot : `${iconsRoot}/${family}`;

    output.push(`import {\n${bindings.map((binding) => `  ${binding},`).join('\n')}\n} from '${source}';`);
  }

  if (families.size > 0) output.push('');

  for (const [family, icons] of [...families].sort(([left], [right]) => left.localeCompare(right))) {
    const entries = [...icons]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, binding]) => `  ${propertyKey(name)}: ${binding},`)
      .join('\n');

    output.push(`registerIcons(${quote(family)}, {\n${entries}\n});`);
  }

  return `${output.join('\n')}\n`;
}

/** Replace transformed HTML registry sources with installable static templates and exact registrations. */
function materializeHtmlRegistry(
  bundle: Rolldown.OutputBundle,
  skins: readonly RenderedHtmlSkin[],
  emit: (fileName: string, source: string) => void
): void {
  const rendered = new Map(skins.map((skin) => [skin.item.name, skin]));
  const skinPath = 'html/skins/registry.json';
  const skinAsset = registryAsset(bundle, skinPath);
  // SAFETY: The registry emitter validates this group before the materializer replaces its generated file closure.
  const skinGroup = JSON.parse(assetSource(skinAsset)) as RegistryGroup;
  const skinItems = skinGroup.items.map((item): RegistryItem => {
    const skin = rendered.get(item.name);
    if (!skin) return item;

    const meta = skin.item.meta!;
    const directory = posix.dirname(htmlSkinEntryTarget(meta));
    const html = sourceOwnedHtml(skin.template);
    const root = `files/${item.name}`;
    const templatePath = `${root}/skin.html`;
    const registrationPath = `${root}/skin.ts`;
    const templateTarget = `${directory}/skin.html`;
    const registrationTarget = `${directory}/skin.ts`;
    const stylesheet = item.files?.find((file) => file.target === `${directory}/skin.css`);

    emit(`${posix.dirname(skinPath)}/${templatePath}`, html);
    emit(`${posix.dirname(skinPath)}/${registrationPath}`, htmlRegistration(html, skin.sources.values(), 'registry'));

    return {
      ...item,
      files: [
        { path: templatePath, target: templateTarget, type: 'registry:file' },
        { path: registrationPath, target: registrationTarget, type: 'registry:file' },
        ...(stylesheet ? [stylesheet] : []),
      ],
      dependencies: item.dependencies?.filter((dependency) => dependency.startsWith('@videojs/html@')),
      registryDependencies:
        meta.styling === 'tailwind'
          ? item.registryDependencies?.filter((name) => name === '@videojs/tailwind-styles')
          : [],
    };
  });

  skinAsset.source = `${JSON.stringify({ ...skinGroup, items: skinItems }, null, 2)}\n`;

  const playerPath = 'html/players/registry.json';
  const playerAsset = registryAsset(bundle, playerPath);
  // SAFETY: The registry emitter validates this authored group before the materializer fills its skin template slot.
  const playerGroup = JSON.parse(assetSource(playerAsset)) as RegistryGroup;

  for (const item of playerGroup.items) {
    const dependency = item.registryDependencies?.find((name) => rendered.has(name.slice(registryPrefix.length)));
    if (!dependency) continue;

    const skin = rendered.get(dependency.slice(registryPrefix.length))!;
    const file = item.files?.find((candidate) => candidate.target?.endsWith('.html'));
    if (!file) throw new Error(`HTML Player registry item \`${item.name}\` has no template file.`);

    const asset = registryAsset(bundle, `${posix.dirname(playerPath)}/${file.path}`);

    asset.source = htmlPlayerTemplate(skin, sourceOwnedHtml(skin.template));
  }
}

function sourceOwnedHtml(template: string): string {
  const mediaSlot = /<slot>\s*<\/slot>/;
  if (!mediaSlot.test(template)) throw new Error('Rendered HTML skin has no default media slot.');

  return template
    .replace(mediaSlot, '<!-- Add a compatible media element here. -->')
    .replace(/<slot name="poster">\s*([\s\S]*?)\s*<\/slot>/, '$1')
    .replaceAll('&amp;', '&')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<');
}

function htmlPlayerTemplate(skin: RenderedHtmlSkin, html: string): string {
  const meta = skin.item.meta!;
  if (!isHtmlSkin(meta)) throw new Error('HTML Player materialization requires HTML skin metadata.');

  const directory = posix.basename(posix.dirname(htmlSkinEntryTarget(meta)));
  const stylesheet = meta.styling === 'css' ? `\n<link rel="stylesheet" href="../skins/${directory}/skin.css">` : '';
  const content = html
    .trim()
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

  return `<script type="module">
  import '@videojs/html/${meta.preset}/player';
  import '../skins/${directory}/skin';
</script>
${stylesheet}
<${meta.preset}-player>
${content}
</${meta.preset}-player>
`;
}

function registryAsset(bundle: Rolldown.OutputBundle, fileName: string): Rolldown.OutputAsset {
  const output = bundle[fileName];
  if (!output || output.type !== 'asset') throw new Error(`Prepared registry asset \`${fileName}\` is missing.`);

  return output;
}

function assetSource(asset: Rolldown.OutputAsset): string {
  return isString(asset.source) ? asset.source : new TextDecoder().decode(asset.source);
}

function quote(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function propertyKey(value: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(value) ? value : quote(value);
}

function iconRegistrations(sources: Iterable<MaterializedSource>): ReadonlyMap<string, ReadonlyMap<string, string>> {
  const families = new Map<string, Map<string, string>>();

  for (const { content } of sources) {
    for (const match of content.matchAll(/registerIcons\(['"]([^'"]+)['"],\s*\{([\s\S]*?)\}\);/g)) {
      const icons = families.get(match[1]!) ?? new Map<string, string>();

      for (const pair of match[2]!.matchAll(/(?:['"]([^'"]+)['"]|([A-Za-z_$][\w$]*))\s*:\s*([A-Za-z_$][\w$]*)/g)) {
        icons.set(pair[1] ?? pair[2]!, pair[3]!);
      }

      families.set(match[1]!, icons);
    }
  }

  return families;
}

function formatHtml(html: string): string {
  return html.replace(/></g, '>\n<');
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
    ...(await filesWithin(workspaceDir, 'packages/html/src/internal/skins')),
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
