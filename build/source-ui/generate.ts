import type { Dirent } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import { buildSkinArtifactGraph, skinsRoot } from '../../packages/skins/scripts/build-artifact-graph.ts';
import { createSourceOutput } from './output.ts';
import {
  createRegistryCatalog,
  type RegistryCatalog,
  type RegistryCatalogFile,
  type RegistryTarget,
} from './registry.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const targets = [
  { framework: 'react', style: 'tailwind' },
  { framework: 'react', style: 'css' },
  { framework: 'html', style: 'tailwind' },
  { framework: 'html', style: 'css' },
] as const satisfies readonly RegistryTarget[];

export interface GenerateSourceRegistryOptions {
  rootDir?: string | undefined;
  check?: boolean | undefined;
  ref?: string | undefined;
}

export async function generateSourceRegistry(options: GenerateSourceRegistryOptions = {}): Promise<void> {
  const rootDir = resolve(options.rootDir ?? repositoryRoot);
  const expected = await createRegistryFiles(options.ref);

  if (options.check) {
    const differences = await registryDifferences(rootDir, expected);
    if (differences.length > 0) {
      throw new Error(`Generated registry is out of date:\n${differences.map((path) => `- ${path}`).join('\n')}`);
    }
    return;
  }

  for (const [path, content] of expected) {
    const fileName = resolve(rootDir, path);
    await mkdir(dirname(fileName), { recursive: true });
    await writeFile(fileName, content);
  }

  for (const path of await generatedRegistryPaths(rootDir)) {
    if (!expected.has(path)) await rm(resolve(rootDir, path));
  }
}

export async function createRegistryFiles(ref?: string): Promise<ReadonlyMap<string, string>> {
  const { graph, diagnostics } = await buildSkinArtifactGraph();
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    throw new Error('Cannot generate the source registry from an invalid artifact graph.');
  }

  const files = new Map<string, string>();
  const include: string[] = [];

  for (const target of targets) {
    const prefix = posix.join('registry', target.framework, target.style);
    const output = await createSourceOutput(graph, { rootDir: skinsRoot, target });
    const catalog = createRegistryCatalog(graph, { target, output, ref, inlineBlocks: true });
    const manifestPath = posix.join(prefix, 'registry.json');
    include.push(manifestPath);
    await addFile(files, manifestPath, serializeNestedCatalog(catalog, prefix));

    for (const artifactFiles of Object.values(output.artifacts)) {
      for (const file of artifactFiles) await addFile(files, file.path, file.content);
    }
  }

  await addFile(
    files,
    'registry.json',
    serializeJson({
      $schema: 'https://ui.shadcn.com/schema/registry.json',
      name: 'videojs',
      homepage: 'https://videojs.org',
      include,
    })
  );
  return files;
}

function serializeNestedCatalog(catalog: RegistryCatalog, prefix: string): string {
  return serializeJson({
    $schema: catalog.$schema,
    items: catalog.items.map((item) => ({
      ...item,
      files: item.files.map(
        (file): RegistryCatalogFile => ({
          ...file,
          path: posix.relative(prefix, file.path),
        })
      ),
    })),
  });
}

function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function addFile(files: Map<string, string>, path: string, content: string): Promise<void> {
  const formatted = await formatRegistryFile(path, content);
  const previous = files.get(path);
  if (previous !== undefined && previous !== formatted) throw new Error(`Generated registry collision: ${path}`);
  files.set(path, formatted);
}

function formatRegistryFile(path: string, content: string): Promise<string> {
  const parser =
    path.endsWith('.tsx') || path.endsWith('.ts')
      ? 'typescript'
      : path.endsWith('.css')
        ? 'css'
        : path.endsWith('.html')
          ? 'html'
          : 'json';
  return format(content, { parser, printWidth: 120, singleQuote: true, htmlWhitespaceSensitivity: 'ignore' });
}

async function registryDifferences(rootDir: string, expected: ReadonlyMap<string, string>): Promise<string[]> {
  const differences: string[] = [];
  for (const [path, content] of expected) {
    try {
      if ((await readFile(resolve(rootDir, path), 'utf8')) !== content) differences.push(path);
    } catch {
      differences.push(path);
    }
  }
  for (const path of await generatedRegistryPaths(rootDir)) {
    if (!expected.has(path)) differences.push(path);
  }
  return [...new Set(differences)].sort();
}

async function generatedRegistryPaths(rootDir: string): Promise<string[]> {
  const registryDir = resolve(rootDir, 'registry');
  const paths = await walkFiles(registryDir);
  return [
    ...((await fileExists(resolve(rootDir, 'registry.json'))) ? ['registry.json'] : []),
    ...paths
      .filter((path) => !['AGENTS.md', 'README.md'].includes(posix.basename(path)))
      .map((path) => posix.join('registry', path)),
  ];
}

async function walkFiles(rootDir: string, currentDir = rootDir): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(currentDir, entry.name);
      if (entry.isDirectory()) return walkFiles(rootDir, path);
      return [normalizePath(relative(rootDir, path))];
    })
  );
  return files.flat();
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

function normalizePath(path: string): string {
  return path.split(sep).join('/');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ref = process.argv.find((argument) => argument.startsWith('--ref='))?.slice('--ref='.length);
  await generateSourceRegistry({
    check: process.argv.includes('--check'),
    ref,
  });
}
