import catalogJson from '@/content/eject-catalog.json';

import {
  type Catalog,
  type CatalogFramework,
  type CatalogItem,
  type CatalogKind,
  type CatalogStyle,
  parseCatalog,
} from './schema.js';

let cachedCatalog: Catalog | undefined;

export interface ResolvedCatalogFile {
  readonly path: string;
  readonly content: string;
}

export interface ResolvedCatalogItem extends Omit<CatalogItem, 'files'> {
  readonly files: readonly ResolvedCatalogFile[];
}

export function sourceCatalog(): Catalog {
  cachedCatalog ??= parseCatalog(catalogJson);
  return cachedCatalog;
}

export function catalogItems(
  filters: {
    readonly kind?: CatalogKind | undefined;
    readonly framework?: CatalogFramework | undefined;
    readonly style?: CatalogStyle | undefined;
  } = {}
): readonly CatalogItem[] {
  return sourceCatalog().items.filter(
    (item) =>
      (!filters.kind || item.kind === filters.kind) &&
      (!filters.framework || item.framework === filters.framework) &&
      (!filters.style || item.style === filters.style)
  );
}

export function resolveCatalogItem(
  kind: CatalogKind,
  name: string,
  framework: CatalogFramework,
  style: CatalogStyle
): ResolvedCatalogItem {
  const catalog = sourceCatalog();
  const item = catalog.items.find(
    (candidate) =>
      candidate.kind === kind &&
      candidate.name === name &&
      candidate.framework === framework &&
      candidate.style === style
  );

  if (!item) {
    const names = [
      ...new Set(catalog.items.filter((candidate) => candidate.kind === kind).map((candidate) => candidate.name)),
    ];

    throw new Error(`Unknown ${kind} \`${name}\`. Available ${kind}s: ${names.join(', ')}.`);
  }

  return {
    ...item,
    files: item.files.map((file) => ({
      path: file.path,
      content: file.sources.map((source) => catalog.sources[source]!).join('\n'),
    })),
  };
}
