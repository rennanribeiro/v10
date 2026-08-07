import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, posix, relative, resolve, sep } from 'node:path';
import type { ArtifactGraph, ArtifactGraphNode } from '../../packages/compiler/src/artifacts/index.ts';
import { type CompilerConfig, compile } from '../../packages/compiler/src/index.ts';
import htmlSourceConfig, { resolveHtmlElementImports } from '../../packages/html/skins.compiler.config.ts';
import { createHtmlIconsSource, createReactIconsSource } from '../../packages/icons/scripts/source.ts';
import reactSourceConfig from '../../packages/react/skins.compiler.config.ts';
import type { RegistryOutputFile, RegistryOutputManifest, RegistryTarget } from './registry.ts';

export interface CreateSourceOutputOptions {
  rootDir: string;
  target: RegistryTarget;
  iconSet?: string | undefined;
  registryRoot?: string | undefined;
  targetRoot?: string | undefined;
}

interface ArtifactOutputContext {
  artifact: ArtifactGraphNode;
  artifactDir: string;
  entryFile: string;
  files: ReadonlyMap<string, string>;
}

/**
 * Lowers every artifact entry and materializes its complete source-owned file set.
 *
 * The graph decides what belongs to an artifact. Framework packages own lowering,
 * the icons package owns icon source generation, and this module only orchestrates
 * those inputs into registry-ready files.
 */
export async function createSourceOutput(
  graph: ArtifactGraph,
  options: CreateSourceOutputOptions
): Promise<RegistryOutputManifest> {
  const rootDir = resolve(options.rootDir);
  const registryRoot = options.registryRoot ?? 'registry';
  const targetRoot = options.targetRoot ?? 'components/videojs';
  const contexts = createArtifactContexts(graph, rootDir, targetRoot);
  const entryArtifacts = new Map(
    [...contexts.values()].map((context) => [absoluteGraphPath(rootDir, context.artifact.entry), context])
  );
  const artifacts: Record<string, RegistryOutputFile[]> = {};
  const dependencies: Record<string, string[]> = {};

  for (const context of [...contexts.values()].sort((a, b) => a.artifact.id.localeCompare(b.artifact.id))) {
    const files = await emitArtifact(context, {
      rootDir,
      target: options.target,
      iconSet: options.iconSet ?? 'default',
      registryRoot,
      entryArtifacts,
    });
    artifacts[context.artifact.id] = files;
    dependencies[context.artifact.id] = collectPackageDependencies(files);
  }

  return { artifacts, dependencies };
}

async function emitArtifact(
  context: ArtifactOutputContext,
  options: {
    rootDir: string;
    target: RegistryTarget;
    iconSet: string;
    registryRoot: string;
    entryArtifacts: ReadonlyMap<string, ArtifactOutputContext>;
  }
): Promise<RegistryOutputFile[]> {
  const { artifact } = context;
  const outputFiles: RegistryOutputFile[] = [];
  const sourceFiles = artifact.files.filter((file) => file.role === 'source');

  for (const file of sourceFiles) {
    const inputFile = absoluteGraphPath(options.rootDir, file.path);
    const target = context.files.get(inputFile);
    if (!target) throw new Error(`Artifact \`${artifact.id}\` has no output path for \`${file.path}\`.`);
    const source = await readFile(inputFile, 'utf8');
    outputFiles.push(outputFile(options, target, rewriteRelativeImports(source, inputFile, context, options)));
  }

  const inputFile = absoluteGraphPath(options.rootDir, artifact.entry);
  const canonical = await readFile(inputFile, 'utf8');
  const config = targetConfig(options.target);
  const result = await compile(canonical, {
    filename: inputFile,
    config,
    configDir: resolve(options.rootDir, context.artifactDir),
    outputFile: resolve(options.rootDir, context.entryFile),
  });
  if (result.diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    throw new Error(`Artifact \`${artifact.id}\` failed ${options.target.framework} lowering.`);
  }

  let entrySource = rewriteRelativeImports(result.code, inputFile, context, options);
  const supportImports: string[] = [];
  const icons = artifact.dependencies.symbols.icons ?? [];
  const components = artifact.dependencies.symbols.components ?? [];

  if (icons.length > 0) {
    const content =
      options.target.framework === 'react'
        ? await createReactIconsSource(icons, options.iconSet)
        : await createHtmlIconsSource(icons, options.iconSet);
    outputFiles.push(outputFile(options, posix.join(context.artifactDir, 'icons.ts'), content));
    if (options.target.framework === 'html') supportImports.push(`import './icons';`);
  }

  if (options.target.framework === 'html') {
    const elementImports = resolveHtmlElementImports(components);
    if (elementImports.length > 0) {
      const content = `${elementImports.map((specifier) => `import '${specifier}';`).join('\n')}\n`;
      outputFiles.push(outputFile(options, posix.join(context.artifactDir, 'elements.ts'), content));
      supportImports.push(`import './elements';`);
    }
  }

  if (supportImports.length > 0) entrySource = `${supportImports.join('\n')}\n${entrySource}`;
  outputFiles.push(outputFile(options, context.entryFile, entrySource));

  return outputFiles.sort((a, b) => a.path.localeCompare(b.path));
}

function createArtifactContexts(
  graph: ArtifactGraph,
  rootDir: string,
  targetRoot: string
): ReadonlyMap<string, ArtifactOutputContext> {
  return new Map(
    graph.artifacts.map((artifact) => {
      const artifactDir = posix.join(targetRoot, artifact.id);
      const entryFile = posix.join(artifactDir, outputEntryName(artifact.entry));
      const files = new Map<string, string>();

      for (const file of artifact.files) {
        const absolute = absoluteGraphPath(rootDir, file.path);
        files.set(
          absolute,
          file.role === 'entry' ? entryFile : posix.join(artifactDir, stripCanonicalPrefix(normalizePath(file.path)))
        );
      }

      return [artifact.id, { artifact, artifactDir, entryFile, files }] as const;
    })
  );
}

function rewriteRelativeImports(
  source: string,
  inputFile: string,
  context: ArtifactOutputContext,
  options: {
    rootDir: string;
    entryArtifacts: ReadonlyMap<string, ArtifactOutputContext>;
  }
): string {
  const outputFile = context.files.get(inputFile) ?? context.entryFile;
  return source.replace(/((?:\bfrom\s*|\bimport\s*)['"])([^'"]+)(['"])/g, (match, prefix, specifier, suffix) => {
    if (!specifier.startsWith('.')) return match;
    const importedFile = resolveSourceFile(inputFile, specifier);
    const dependency = options.entryArtifacts.get(importedFile);
    const target = dependency?.entryFile ?? context.files.get(importedFile);
    if (!existsSync(importedFile)) return match;
    if (!target) {
      throw new Error(
        `Artifact \`${context.artifact.id}\` cannot map relative import \`${specifier}\` from \`${normalizePath(
          relative(options.rootDir, inputFile)
        )}\`.`
      );
    }
    return `${prefix}${relativeModulePath(dirname(outputFile), withoutTypeScriptExtension(target))}${suffix}`;
  });
}

function outputFile(
  options: { registryRoot: string; target: RegistryTarget },
  target: string,
  content: string
): RegistryOutputFile {
  return {
    path: posix.join(options.registryRoot, options.target.framework, options.target.style, target),
    type: target.endsWith('.css') ? 'registry:file' : 'registry:component',
    target,
    content,
  };
}

function collectPackageDependencies(files: readonly RegistryOutputFile[]): string[] {
  const packages = new Set<string>();
  for (const file of files) {
    if (file.path.endsWith('.css')) continue;
    for (const match of file.content.matchAll(/(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      if (specifier && !specifier.startsWith('.')) packages.add(packageName(specifier));
    }
  }
  return [...packages].sort();
}

function targetConfig(target: RegistryTarget): CompilerConfig {
  return target.framework === 'react' ? reactSourceConfig : htmlSourceConfig;
}

function outputEntryName(entry: string): string {
  return basename(entry).replace(/\.skin(?=\.[^.]+$)/, '');
}

function stripCanonicalPrefix(path: string): string {
  return path.replace(/^\.\/canonical\//, '');
}

function absoluteGraphPath(rootDir: string, path: string): string {
  return resolve(rootDir, path);
}

function resolveSourceFile(inputFile: string, specifier: string): string {
  const candidate = resolve(dirname(inputFile), specifier);
  if (['.ts', '.tsx', '.mts', '.cts'].includes(extname(candidate))) return candidate;
  for (const extension of ['.ts', '.tsx', '.mts', '.cts']) {
    const fileName = `${candidate}${extension}`;
    if (existsSync(fileName)) return fileName;
  }
  return candidate;
}

function withoutTypeScriptExtension(path: string): string {
  return path.replace(/\.(?:[cm]?ts|tsx)$/, '');
}

function relativeModulePath(from: string, to: string): string {
  const path = posix.relative(normalizePath(from), normalizePath(to));
  return path.startsWith('.') ? path : `./${path}`;
}

function normalizePath(path: string): string {
  return path.split(sep).join('/');
}

function packageName(specifier: string): string {
  if (!specifier.startsWith('@')) return specifier.split('/')[0] ?? specifier;
  return specifier.split('/').slice(0, 2).join('/');
}
