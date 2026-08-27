import { dirname, extname, relative, resolve } from 'node:path';

import type { ImportDeclaration, ImportSpecifier, Node } from '@oxc-project/types';
import MagicString from 'magic-string';
import { parseSync } from 'oxc-parser';
import { walk } from 'oxc-walker';

import type { ResolvedCatalogItem } from '../catalog/index.js';
import { htmlSkinContract, reactSkinContract } from './skin-contract.js';

export interface ProjectSourceFile {
  readonly path: string;
  readonly source: string;
}

export interface SourceEdit extends ProjectSourceFile {
  readonly content: string;
}

export interface UsageTransform {
  readonly edits: readonly SourceEdit[];
  readonly packagedUses: number;
  readonly localUses: number;
  readonly instructions: readonly string[];
}

interface HtmlReplacement {
  readonly source: string;
  readonly count: number;
}

export function transformReactSkinUsage(
  files: readonly ProjectSourceFile[],
  item: ResolvedCatalogItem,
  outputRoot: string
): UsageTransform {
  const contract = reactSkinContract(item);
  const entry = resolve(outputRoot, item.entry);
  const edits: SourceEdit[] = [];
  const instructions: string[] = [];
  let packagedUses = 0;
  let localUses = 0;

  for (const file of files.filter(isScriptFile)) {
    if (
      !file.source.includes(contract.packageSource) &&
      !file.source.includes(contract.stylesheetSource ?? '\0') &&
      !file.source.includes(relativeImport(file.path, entry))
    ) {
      continue;
    }

    const program = parseModule(file);
    const magicString = new MagicString(file.source);
    const skinImports: Array<{ declaration: ImportDeclaration; specifier: ImportSpecifier }> = [];
    const stylesheetImports: ImportDeclaration[] = [];

    walk(program, {
      enter(node) {
        if (node.type === 'ImportExpression') {
          const source = importSource(node.source);

          if (source === contract.packageSource)
            throw unsafeReactError(item, 'the packaged preset is loaded dynamically');

          if (source === contract.stylesheetSource)
            throw unsafeReactError(item, 'the packaged stylesheet is loaded dynamically');
        }

        if (node.type !== 'ImportDeclaration') return;

        if (matchesLocalModule(file.path, node.source.value, entry)) {
          if (
            node.specifiers.some(
              (specifier) => specifier.type === 'ImportSpecifier' && importName(specifier) === contract.generatedExport
            )
          ) {
            localUses++;
          }

          return;
        }

        if (node.source.value === contract.stylesheetSource) {
          if (node.specifiers.length > 0)
            throw unsafeReactError(item, 'the packaged stylesheet import is not side-effect-only');

          stylesheetImports.push(node);
          return;
        }

        if (node.source.value !== contract.packageSource) return;

        if (node.specifiers.some((specifier) => specifier.type === 'ImportNamespaceSpecifier')) {
          throw unsafeReactError(item, 'the packaged preset uses a namespace import');
        }

        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportSpecifier' && importName(specifier) === contract.packagedExport) {
            if (node.importKind === 'type' || specifier.importKind === 'type') {
              throw unsafeReactError(item, 'the packaged skin is imported as a type');
            }

            skinImports.push({ declaration: node, specifier });
          }
        }
      },
    });

    if (skinImports.length > 1)
      throw unsafeReactError(item, `more than one packaged skin import appears in ${file.path}`);

    const skinImport = skinImports[0];

    if (skinImport) {
      replaceReactSkinImport(magicString, file, skinImport.declaration, skinImport.specifier, contract, entry);
      packagedUses++;
    }

    for (const declaration of stylesheetImports) removeStatement(magicString, file.source, declaration);

    if (magicString.hasChanged()) edits.push({ ...file, content: magicString.toString() });
  }

  if (packagedUses > 0)
    instructions.push(`Replaced ${packagedUses} packaged React skin import${packagedUses === 1 ? '' : 's'}.`);

  return { edits, packagedUses, localUses, instructions };
}

export function transformHtmlSkinUsage(
  files: readonly ProjectSourceFile[],
  item: ResolvedCatalogItem,
  outputRoot: string
): UsageTransform {
  if (!item.setup || !item.contentMarker) throw new Error(`HTML skin ${item.name} has incomplete source metadata.`);

  const contract = htmlSkinContract(item);
  const setup = resolve(outputRoot, item.setup);
  const stylesheet = resolve(outputRoot, item.stylesheet);
  const entry = item.files.find((file) => file.path === item.entry);
  if (!entry) throw new Error(`HTML skin ${item.name} has no markup entry.`);

  const edits: SourceEdit[] = [];
  let packagedImports = 0;
  let localUses = 0;

  for (const file of files.filter(isScriptFile)) {
    if (!file.source.includes(contract.registrationSource) && !file.source.includes(relativeImport(file.path, setup))) {
      continue;
    }

    const program = parseModule(file);
    const magicString = new MagicString(file.source);

    walk(program, {
      enter(node) {
        if (node.type === 'ImportExpression' && importSource(node.source) === contract.registrationSource) {
          throw unsafeHtmlError(item, 'the packaged skin registration is loaded dynamically');
        }

        if (node.type !== 'ImportDeclaration') return;

        if (matchesLocalModule(file.path, node.source.value, setup)) {
          localUses++;
          return;
        }

        if (node.source.value !== contract.registrationSource) return;

        if (node.specifiers.length > 0)
          throw unsafeHtmlError(item, 'the packaged skin registration import is not side-effect-only');

        const setupImport = relativeImport(file.path, setup);
        const styleImport = relativeImport(file.path, stylesheet);

        magicString.overwrite(
          node.start,
          node.end,
          `import ${JSON.stringify(setupImport)};\nimport ${JSON.stringify(styleImport)};`
        );
        packagedImports++;
      },
    });

    if (magicString.hasChanged()) edits.push({ ...file, content: magicString.toString() });
  }

  let packagedTags = 0;

  for (const file of files.filter((candidate) => extname(candidate.path) === '.html')) {
    if (!file.source.toLowerCase().includes(`<${contract.tag}`)) continue;

    const transformed = replaceHtmlSkinElements(file.source, contract.tag, entry.content, item);

    packagedTags += transformed.count;

    if (transformed.source !== file.source) edits.push({ ...file, content: transformed.source });
  }

  if ((packagedImports === 0) !== (packagedTags === 0)) {
    const reason =
      packagedImports === 0
        ? `found <${contract.tag}> markup without its static package registration import`
        : `found the package registration import without static <${contract.tag}> markup in an HTML file`;

    throw unsafeHtmlError(item, reason);
  }

  if (packagedImports > 0 && packagedTags > 0) {
    return {
      edits,
      packagedUses: packagedImports + packagedTags,
      localUses,
      instructions: [
        `Replaced ${packagedImports} packaged HTML registration import${packagedImports === 1 ? '' : 's'}.`,
        `Replaced ${packagedTags} <${contract.tag}> element${packagedTags === 1 ? '' : 's'} with owned markup.`,
      ],
    };
  }

  return { edits, packagedUses: 0, localUses, instructions: [] };
}

function replaceReactSkinImport(
  magicString: MagicString,
  file: ProjectSourceFile,
  declaration: ImportDeclaration,
  target: ImportSpecifier,
  contract: ReturnType<typeof reactSkinContract>,
  entry: string
): void {
  if (
    declaration.attributes.length > 0 ||
    declaration.specifiers.some((specifier) => specifier.type !== 'ImportSpecifier')
  ) {
    throw unsafeReactError({ name: contract.packagedExport }, 'the packaged preset import has an unsupported shape');
  }

  const remaining = declaration.specifiers.filter((specifier) => specifier !== target);
  const localName = target.local.name;
  const generated =
    contract.generatedExport === localName ? contract.generatedExport : `${contract.generatedExport} as ${localName}`;
  const localImport = `import { ${generated} } from ${JSON.stringify(relativeImport(file.path, entry))};`;
  const packageImport =
    remaining.length > 0
      ? `import { ${remaining.map((specifier) => file.source.slice(specifier.start, specifier.end)).join(', ')} } from ${JSON.stringify(
          contract.packageSource
        )};\n`
      : '';

  magicString.overwrite(declaration.start, declaration.end, `${packageImport}${localImport}`);
}

function replaceHtmlSkinElements(
  source: string,
  tag: string,
  ownedMarkup: string,
  item: ResolvedCatalogItem
): HtmlReplacement {
  const expression = new RegExp(`<${escapeRegExp(tag)}(\\s[^<>]*?)?>([\\s\\S]*?)<\\/${escapeRegExp(tag)}\\s*>`, 'gi');
  let count = 0;

  const output = source.replace(expression, (_match, attributes: string | undefined, children: string) => {
    count++;
    return ownedHtmlMarkup(ownedMarkup, attributes ?? '', children, item);
  });

  const openings = source.match(new RegExp(`<${escapeRegExp(tag)}(?:\\s|>)`, 'gi'))?.length ?? 0;
  if (openings !== count) throw unsafeHtmlError(item, `could not match every <${tag}> opening and closing tag`);

  return { source: output, count };
}

function ownedHtmlMarkup(
  markup: string,
  attributes: string,
  originalChildren: string,
  item: ResolvedCatalogItem
): string {
  if (!item.contentMarker || !markup.includes(item.contentMarker)) {
    throw new Error(`HTML skin ${item.name} has no media content marker.`);
  }

  if (/[{}<>]/.test(attributes))
    throw unsafeHtmlError(item, 'the packaged skin element has dynamic or malformed attributes');

  const poster = extractPoster(originalChildren, item);
  const children = poster ? originalChildren.replace(poster.source, '') : originalChildren;
  let output = markup.replace(item.contentMarker, children.trim());

  if (poster) output = replacePosterFallback(output, poster.element, item);

  return mergeRootAttributes(output, attributes, item);
}

function extractPoster(
  children: string,
  item: ResolvedCatalogItem
): { readonly source: string; readonly element: string } | undefined {
  const slots = [...children.matchAll(/\bslot\s*=\s*["']poster["']/gi)];
  if (slots.length === 0) return;

  if (slots.length > 1) throw unsafeHtmlError(item, 'more than one poster slot appears in the packaged skin');

  const paired = /<([a-z][\w-]*)([^>]*\bslot\s*=\s*(["'])poster\3[^>]*)>([\s\S]*?)<\/\1\s*>/i.exec(children);
  const image = /<img\b(?=[^>]*\bslot\s*=\s*(["'])poster\1)[^>]*>/i.exec(children);
  const match = paired ?? image;
  if (!match) throw unsafeHtmlError(item, 'the poster slot is not a static HTML element');

  return {
    source: match[0],
    element: match[0].replace(/\s+slot\s*=\s*(["'])poster\1/i, ''),
  };
}

function replacePosterFallback(markup: string, poster: string, item: ResolvedCatalogItem): string {
  if (!item.posterMarker) throw unsafeHtmlError(item, 'the selected skin has no poster handoff point');

  const marker = escapeRegExp(item.posterMarker);
  const fallback = new RegExp(`${marker}\\s*<img\\b[^>]*>\\s*<\\/img>`);
  if (!fallback.test(markup)) throw new Error(`HTML skin ${item.name} has no replaceable poster fallback.`);

  return markup.replace(fallback, poster);
}

function mergeRootAttributes(markup: string, original: string, item: ResolvedCatalogItem): string {
  let attributes = original.trim();
  if (!attributes) return markup;

  const classes = [...attributes.matchAll(/\bclass\s*=\s*(["'])(.*?)\1/gi)];
  if (classes.length > 1) throw unsafeHtmlError(item, 'the packaged skin element has more than one class attribute');

  const originalClass = classes[0]?.[2];

  if (classes[0]) attributes = attributes.replace(classes[0][0], '').trim();

  return markup.replace(/^<media-container\b([^>]*)>/, (_opening, generated: string) => {
    let merged = generated;

    if (originalClass) {
      if (!/\bclass="[^"]*"/.test(merged)) throw new Error(`HTML skin ${item.name} has no root class attribute.`);

      merged = merged.replace(
        /\bclass="([^"]*)"/,
        (_className, value: string) => `class="${value} ${originalClass.replaceAll('"', '&quot;')}"`
      );
    }

    return `<media-container${merged}${attributes ? ` ${attributes}` : ''}>`;
  });
}

function parseModule(file: ProjectSourceFile) {
  const parsed = parseSync(file.path, file.source);

  if (parsed.errors.length > 0) {
    throw new Error(
      `Could not parse \`${file.path}\`.\nReason: ${parsed.errors.map((error) => error.message).join('; ')}\n` +
        'Recommendation: fix the source error or use `videojs add` and replace the packaged skin manually.'
    );
  }

  return parsed.program;
}

function importName(specifier: ImportSpecifier): string {
  return 'name' in specifier.imported ? specifier.imported.name : specifier.imported.value;
}

function importSource(node: Node): string | undefined {
  if (node.type === 'Literal' && (node.raw?.startsWith('"') || node.raw?.startsWith("'"))) return String(node.value);

  if (node.type === 'TemplateLiteral' && node.expressions.length === 0)
    return node.quasis[0]?.value.cooked ?? undefined;

  return;
}

function relativeImport(importer: string, target: string): string {
  const extension = extname(target);
  const sourceTarget = ['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx'].includes(extension)
    ? target.slice(0, -extension.length)
    : target;
  const path = relative(dirname(importer), sourceTarget).split('\\').join('/');

  return path.startsWith('.') ? path : `./${path}`;
}

function matchesLocalModule(importer: string, specifier: string, target: string): boolean {
  if (!specifier.startsWith('.')) return false;

  return moduleKey(resolve(dirname(importer), specifier)) === moduleKey(target);
}

function moduleKey(path: string): string {
  const extension = extname(path);

  return ['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx'].includes(extension) ? path.slice(0, -extension.length) : path;
}

function removeStatement(magicString: MagicString, source: string, node: ImportDeclaration): void {
  const newline = source[node.end] === '\r' && source[node.end + 1] === '\n' ? 2 : source[node.end] === '\n' ? 1 : 0;

  magicString.remove(node.start, node.end + newline);
}

function isScriptFile(file: ProjectSourceFile): boolean {
  return ['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx'].includes(extname(file.path));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function unsafeReactError(item: Pick<ResolvedCatalogItem, 'name'>, reason: string): Error {
  return new Error(
    `Could not safely eject React skin ${item.name}.\nReason: ${reason}.\n` +
      'Recommendation: run `videojs add` and replace the packaged skin import manually.'
  );
}

function unsafeHtmlError(item: Pick<ResolvedCatalogItem, 'name'>, reason: string): Error {
  return new Error(
    `Could not safely eject HTML skin ${item.name}.\nReason: ${reason}.\n` +
      'Recommendation: run `videojs add`, import its registration and stylesheet, then replace the packaged skin element manually.'
  );
}
