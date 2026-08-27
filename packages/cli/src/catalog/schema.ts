import { posix } from 'node:path';

export type CatalogKind = 'component' | 'skin';
export type CatalogFramework = 'html' | 'react';
export type CatalogStyle = 'css' | 'tailwind';

export interface CatalogFile {
  readonly path: string;
  readonly sources: readonly string[];
}

export interface CatalogItem {
  readonly kind: CatalogKind;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly framework: CatalogFramework;
  readonly style: CatalogStyle;
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

export interface Catalog {
  readonly version: 1;
  readonly sources: Readonly<Record<string, string>>;
  readonly items: readonly CatalogItem[];
}

/** Validate the generated skin catalog at the CLI bundle boundary. */
export function parseCatalog(value: unknown): Catalog {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.sources) || !Array.isArray(value.items)) {
    throw new Error('The bundled Video.js source catalog is invalid.');
  }

  const sources: Record<string, string> = {};

  for (const [key, source] of Object.entries(value.sources)) {
    if (typeof source !== 'string') throw new Error(`Catalog source \`${key}\` is invalid.`);

    sources[key] = source;
  }

  const items = value.items.map((item, index) => parseItem(item, index, sources));

  return { version: 1, sources, items };
}

function parseItem(value: unknown, index: number, sources: Readonly<Record<string, string>>): CatalogItem {
  if (!isRecord(value)) throw new Error(`Catalog item ${index} is invalid.`);

  const kind = value.kind;
  const framework = value.framework;
  const style = value.style;
  const files = value.files;

  if (
    (kind !== 'component' && kind !== 'skin') ||
    (framework !== 'html' && framework !== 'react') ||
    (style !== 'css' && style !== 'tailwind') ||
    !isString(value.name) ||
    !isString(value.title) ||
    !isString(value.description) ||
    !isString(value.context) ||
    !isString(value.entry) ||
    !isSafeRelativePath(value.stylesheet) ||
    !Array.isArray(files) ||
    !isStringArray(value.dependencies) ||
    !isStringArray(value.devDependencies)
  ) {
    throw new Error(`Catalog item ${index} is invalid.`);
  }

  let setup: string | undefined;
  let contentMarker: string | undefined;
  let posterMarker: string | undefined;

  if (framework === 'html') {
    if (
      !isSafeRelativePath(value.setup) ||
      (kind === 'skin' ? !isString(value.contentMarker) : value.contentMarker !== undefined)
    ) {
      throw new Error(`Catalog item ${index} is invalid.`);
    }

    setup = value.setup;

    if (kind === 'skin') {
      if (!isString(value.contentMarker)) throw new Error(`Catalog item ${index} is invalid.`);

      contentMarker = value.contentMarker;
    }

    if (value.posterMarker !== undefined) {
      if (kind !== 'skin' || !isString(value.posterMarker)) throw new Error(`Catalog item ${index} is invalid.`);

      posterMarker = value.posterMarker;
    }
  } else if (value.setup !== undefined || value.contentMarker !== undefined || value.posterMarker !== undefined) {
    throw new Error(`Catalog item ${index} is invalid.`);
  }

  const parsedFiles = files.map((file, fileIndex) => {
    if (
      !isRecord(file) ||
      !isSafeRelativePath(file.path) ||
      !isStringArray(file.sources) ||
      file.sources.length === 0 ||
      file.sources.some((source) => sources[source] === undefined)
    ) {
      throw new Error(`Catalog item ${index} file ${fileIndex} is invalid.`);
    }

    return { path: file.path, sources: file.sources };
  });
  const uniquePaths = new Set(parsedFiles.map((file) => file.path.toLocaleLowerCase('en-US')));

  if (uniquePaths.size !== parsedFiles.length) {
    throw new Error(`Catalog item ${index} contains conflicting file paths.`);
  }

  if (!isSafeRelativePath(value.entry) || !parsedFiles.some((file) => file.path === value.entry)) {
    throw new Error(`Catalog item ${index} does not include its entry file.`);
  }

  if (!parsedFiles.some((file) => file.path === value.stylesheet)) {
    throw new Error(`Catalog item ${index} does not include its stylesheet.`);
  }

  if (setup && !parsedFiles.some((file) => file.path === setup)) {
    throw new Error(`Catalog item ${index} does not include its setup module.`);
  }

  return {
    kind,
    name: value.name,
    title: value.title,
    description: value.description,
    framework,
    style,
    context: value.context,
    entry: value.entry,
    stylesheet: value.stylesheet,
    setup,
    contentMarker,
    posterMarker,
    files: parsedFiles,
    dependencies: value.dependencies,
    devDependencies: value.devDependencies,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.length > 0);
}

function isSafeRelativePath(value: unknown): value is string {
  return (
    isString(value) &&
    !value.includes('\\') &&
    !posix.isAbsolute(value) &&
    posix.normalize(value) === value &&
    value !== '.' &&
    !value.startsWith('../')
  );
}
