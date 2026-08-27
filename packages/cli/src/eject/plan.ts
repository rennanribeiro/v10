import type { Dirent } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';

import type { ResolvedCatalogItem } from '../catalog/index.js';
import { type ChangeSet, planAdd, type PlannedFile } from './change-set.js';
import type { ProjectInfo } from './project.js';
import {
  type ProjectSourceFile,
  transformHtmlSkinUsage,
  transformReactSkinUsage,
  type UsageTransform,
} from './transform.js';

const ignoredDirectories = new Set([
  '.git',
  '.next',
  '.output',
  '.turbo',
  '.vite',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
]);
const sourceExtensions = new Set(['.cjs', '.html', '.js', '.jsx', '.mjs', '.ts', '.tsx']);

export interface EjectPlan {
  readonly alreadyEjected: boolean;
  readonly changeSet: ChangeSet;
}

export async function planEject(options: {
  readonly project: ProjectInfo;
  readonly item: ResolvedCatalogItem;
  readonly path: string;
  readonly overwrite: boolean;
}): Promise<EjectPlan> {
  if (options.item.kind !== 'skin') {
    throw new Error(`Cannot eject ${options.item.kind} ${options.item.name}. Recommendation: use \`videojs add\`.`);
  }

  const add = await planAdd(options);
  const outputRoot = resolve(options.project.cwd, options.path);
  const sources = await projectSourceFiles(options.project.cwd, outputRoot);
  const usage =
    options.item.framework === 'react'
      ? transformReactSkinUsage(sources, options.item, outputRoot)
      : transformHtmlSkinUsage(sources, options.item, outputRoot);

  if (usage.localUses > 0 && (usage.packagedUses > 0 || usage.edits.length > 0)) {
    throw new Error(
      `Could not safely eject skin ${options.item.name}.\nReason: local source and packaged skin resources both exist.\n` +
        'Recommendation: resolve the partial migration manually, then rerun the command.'
    );
  }

  if (usage.packagedUses === 0) {
    if (usage.localUses > 0) return { alreadyEjected: true, changeSet: emptyChangeSet(options, usage) };

    throw noUsageError(options.item);
  }

  const applicationFiles = usage.edits.map(
    (edit): PlannedFile => ({
      path: edit.path,
      relativePath: relative(options.project.cwd, edit.path),
      content: edit.content,
      previous: edit.source,
      status: edit.content === edit.source ? 'unchanged' : 'update',
    })
  );
  const plannedPaths = new Set(add.files.map((file) => file.path));

  for (const file of applicationFiles) {
    if (plannedPaths.has(file.path)) {
      throw new Error(`Eject output path overlaps application source: \`${file.relativePath}\`.`);
    }
  }

  return {
    alreadyEjected: false,
    changeSet: {
      ...add,
      files: [...add.files, ...applicationFiles],
      instructions: [...usage.instructions, ...add.instructions],
    },
  };
}

async function projectSourceFiles(cwd: string, outputRoot: string): Promise<ProjectSourceFile[]> {
  const files = await walkProject(cwd, outputRoot);

  return Promise.all(files.map(async (path) => ({ path, source: await readFile(path, 'utf8') })));
}

async function walkProject(directory: string, outputRoot: string): Promise<string[]> {
  if (isWithin(directory, outputRoot) && directory === outputRoot) return [];

  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry: Dirent): Promise<string[]> | string[] => {
      const path = resolve(directory, entry.name);

      if (entry.isSymbolicLink()) return [];

      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name) || entry.name.startsWith('.')) return [];

        return walkProject(path, outputRoot);
      }

      return entry.isFile() && sourceExtensions.has(extname(entry.name)) ? [path] : [];
    })
  );

  return files.flat().sort();
}

function emptyChangeSet(
  options: { readonly project: ProjectInfo; readonly item: ResolvedCatalogItem },
  usage: UsageTransform
): ChangeSet {
  return {
    cwd: options.project.cwd,
    item: options.item,
    files: [],
    conflicts: [],
    instructions: [...usage.instructions, 'The packaged skin has already been replaced by local source.'],
  };
}

function noUsageError(item: ResolvedCatalogItem): Error {
  const surface =
    item.framework === 'react' ? 'named packaged skin import' : 'static registration import and HTML skin element';

  return new Error(
    `Could not safely eject ${item.framework} skin ${item.name}.\nReason: no supported ${surface} was found.\n` +
      `Recommendation: run \`videojs add skin ${item.name}\` and replace the packaged skin manually.`
  );
}

function isWithin(root: string, target: string): boolean {
  const path = relative(root, target);

  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`));
}
