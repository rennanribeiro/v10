import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

import type { ResolvedCatalogItem } from '../catalog/index.js';
import type { JsonObject, ProjectInfo } from './project.js';

export type FileStatus = 'conflict' | 'create' | 'unchanged' | 'update';

export interface PlannedFile {
  readonly path: string;
  readonly relativePath: string;
  readonly content: string;
  readonly previous?: string | undefined;
  readonly status: FileStatus;
}

export interface ChangeSet {
  readonly cwd: string;
  readonly item: ResolvedCatalogItem;
  readonly files: readonly PlannedFile[];
  readonly conflicts: readonly PlannedFile[];
  readonly instructions: readonly string[];
}

export async function planAdd(options: {
  readonly project: ProjectInfo;
  readonly item: ResolvedCatalogItem;
  readonly path: string;
  readonly overwrite: boolean;
}): Promise<ChangeSet> {
  const root = resolve(options.project.cwd, options.path);

  await assertProjectPath(options.project.cwd, root, 'installation path');

  const desired = options.item.files.map((file) => ({
    path: resolve(root, file.path),
    content: file.content,
    managed: false,
  }));
  const packageContent = updatedPackageJson(options.project.packageJson, options.item);

  desired.push({ path: options.project.packageFile, content: packageContent, managed: true });

  await Promise.all(desired.map(({ path }) => assertProjectPath(options.project.cwd, path, 'output file')));

  const files = await Promise.all(
    desired.map(async ({ path, content, managed }): Promise<PlannedFile> => {
      const previous = await readFile(path, 'utf8').catch(() => undefined);
      const status =
        previous === undefined
          ? 'create'
          : previous === content
            ? 'unchanged'
            : managed || options.overwrite
              ? 'update'
              : 'conflict';

      return { path, relativePath: relative(options.project.cwd, path), content, previous, status };
    })
  );
  const conflicts = files.filter((file) => file.status === 'conflict');
  const instructions =
    options.item.framework === 'html'
      ? htmlInstructions(options.project.cwd, root, options.item)
      : [`Import the component exported from \`${relative(options.project.cwd, resolve(root, options.item.entry))}\`.`];

  return {
    cwd: options.project.cwd,
    item: options.item,
    files,
    conflicts,
    instructions,
  };
}

export async function applyChangeSet(changeSet: ChangeSet): Promise<void> {
  if (changeSet.conflicts.length > 0) {
    throw new Error(
      `Refusing to overwrite existing files:\n${changeSet.conflicts.map((file) => `- ${file.relativePath}`).join('\n')}\n` +
        'Recommendation: review with --diff, choose another --path, or pass --overwrite.'
    );
  }

  const changed = changeSet.files.filter((file) => file.status === 'create' || file.status === 'update');
  const staged: Array<{ target: PlannedFile; temporary: string }> = [];
  const applied: PlannedFile[] = [];

  try {
    for (const file of changed) {
      await mkdir(dirname(file.path), { recursive: true });
      const temporary = `${file.path}.videojs-${process.pid}-${randomUUID()}.tmp`;

      await writeFile(temporary, file.content, { flag: 'wx' });
      staged.push({ target: file, temporary });
    }

    for (const { target, temporary } of staged) {
      await rename(temporary, target.path);
      applied.push(target);
    }
  } catch (error) {
    for (const { temporary } of staged) await rm(temporary, { force: true });

    for (const file of [...applied].reverse()) {
      if (file.previous === undefined) await rm(file.path, { force: true });
      else await writeFile(file.path, file.previous);
    }

    throw error;
  }
}

function updatedPackageJson(packageJson: JsonObject, item: ResolvedCatalogItem): string {
  const next = structuredClone(packageJson);

  addDependencies(next, 'dependencies', item.dependencies);
  addDependencies(next, 'devDependencies', item.devDependencies);

  return `${JSON.stringify(next, null, 2)}\n`;
}

function addDependencies(packageJson: JsonObject, field: string, names: readonly string[]): void {
  if (names.length === 0) return;

  const current = packageJson[field];
  const dependencies: JsonObject = {};

  if (Object.prototype.toString.call(current) === '[object Object]') {
    // SAFETY: The JSON object representation was checked immediately above.
    Object.assign(dependencies, current as JsonObject);
  }

  for (const name of names) dependencies[name] ??= dependencyVersion(name);

  packageJson[field] = Object.fromEntries(
    Object.entries(dependencies).sort(([left], [right]) => left.localeCompare(right))
  );
}

function dependencyVersion(name: string): string {
  if (name.startsWith('@videojs/')) return `^${__CLI_VERSION__}`;

  if (name === 'react') return '^19.0.0';

  if (name === 'tailwindcss') return '^4.0.0';

  return 'latest';
}

function htmlInstructions(cwd: string, root: string, item: ResolvedCatalogItem): string[] {
  if (!item.setup) throw new Error(`HTML catalog item ${item.name} has no setup module.`);

  return [
    `Import \`${relative(cwd, resolve(root, item.setup))}\` once.`,
    `Use the markup in \`${relative(cwd, resolve(root, item.entry))}\` and load \`${relative(
      cwd,
      resolve(root, item.stylesheet)
    )}\`.`,
  ];
}

async function assertProjectPath(cwd: string, target: string, label: string): Promise<void> {
  if (!isWithin(cwd, target)) {
    throw new Error(
      `Refusing ${label} outside the project: \`${target}\`.\n` +
        `Reason: source-owned files must stay inside \`${cwd}\`.\n` +
        'Recommendation: choose a relative --path within the project.'
    );
  }

  const canonicalRoot = await realpath(cwd);
  const canonicalTarget = await nearestExistingPath(target);

  if (!isWithin(canonicalRoot, canonicalTarget)) {
    throw new Error(
      `Refusing ${label} through a symlink outside the project: \`${target}\`.\n` +
        `Reason: its existing path resolves outside \`${canonicalRoot}\`.\n` +
        'Recommendation: choose a normal directory within the project.'
    );
  }
}

async function nearestExistingPath(target: string): Promise<string> {
  let candidate = target;

  while (true) {
    try {
      return await realpath(candidate);
    } catch {
      const parent = dirname(candidate);
      if (parent === candidate) throw new Error(`Could not resolve an existing parent for \`${target}\`.`);

      candidate = parent;
    }
  }
}

function isWithin(root: string, target: string): boolean {
  const path = relative(root, target);

  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
}
