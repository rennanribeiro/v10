import { confirm, isCancel, select } from '@clack/prompts';
import { createPatch } from 'diff';

import { catalogItems, resolveCatalogItem } from '../catalog/index.js';
import type { CatalogFramework, CatalogKind, CatalogStyle } from '../catalog/schema.js';
import { applyChangeSet, type ChangeSet, planAdd } from '../eject/change-set.js';
import { detectProject } from '../eject/project.js';

export interface SourceCommandOptions {
  readonly cwd?: string | undefined;
  readonly framework?: string | undefined;
  readonly style?: string | undefined;
  readonly path?: string | undefined;
  readonly yes?: boolean | undefined;
  readonly overwrite?: boolean | undefined;
  readonly dryRun?: boolean | undefined;
  readonly diff?: string | true | undefined;
  readonly json?: boolean | undefined;
}

export function handleList(kindValue: string | undefined, options: SourceCommandOptions): void {
  const kind = kindValue ? parseKind(kindValue) : undefined;
  const framework = options.framework ? parseFramework(options.framework) : undefined;
  const style = options.style ? parseStyle(options.style) : undefined;
  const items = catalogItems({ kind, framework, style });
  const unique = new Map(items.map((item) => [`${item.kind}/${item.name}`, item]));
  const output = [...unique.values()].map(({ kind: itemKind, name, title, description }) => ({
    kind: itemKind,
    name,
    title,
    description,
  }));

  if (options.json) {
    console.log(JSON.stringify({ version: __CLI_VERSION__, items: output }, null, 2));
    return;
  }

  for (const item of output) console.log(`${item.kind.padEnd(9)} ${item.name.padEnd(28)} ${item.description}`);
}

export async function handleView(kindValue: string, name: string, options: SourceCommandOptions): Promise<void> {
  const project =
    options.framework && options.style
      ? undefined
      : await detectProject(options.cwd ?? process.cwd()).catch(() => undefined);
  const selection = await resolveSelection(options, project?.framework, project?.style);
  const item = resolveCatalogItem(parseKind(kindValue), name, selection.framework, selection.style);

  if (options.json) {
    console.log(JSON.stringify({ version: __CLI_VERSION__, item }, null, 2));
    return;
  }

  console.log(`${item.title}\n${item.description}\n`);
  console.log(item.files.map((file) => `- ${file.path}`).join('\n'));

  for (const file of item.files) console.log(`\n--- ${file.path} ---\n${file.content.trimEnd()}`);
}

export async function handleAdd(kindValue: string, name: string, options: SourceCommandOptions): Promise<void> {
  const project = await detectProject(options.cwd ?? process.cwd());
  const selection = await resolveSelection(options, project.framework, project.style);
  const item = resolveCatalogItem(parseKind(kindValue), name, selection.framework, selection.style);
  const path =
    options.diff === true || options.diff === undefined ? (options.path ?? project.defaultPath) : options.diff;
  const changeSet = await planAdd({ project, item, path, overwrite: Boolean(options.overwrite) });

  if (options.json) {
    console.log(JSON.stringify(serializableChangeSet(changeSet), null, 2));
    return;
  }

  printPlan(changeSet);

  if (options.diff) {
    printDiff(changeSet);
    return;
  }

  if (options.dryRun) return;

  if (changeSet.conflicts.length > 0) {
    throw new Error(
      `Existing files differ:\n${changeSet.conflicts.map((file) => `- ${file.relativePath}`).join('\n')}\n` +
        'Recommendation: review with --diff, choose another --path, or pass --overwrite.'
    );
  }

  if (!options.yes) {
    if (!process.stdin.isTTY) throw new Error('Confirmation is required. Recommendation: rerun with --yes.');

    const approved = await confirm({ message: `Write ${changedFiles(changeSet).length} files?` });
    if (isCancel(approved) || !approved) return;
  }

  await applyChangeSet(changeSet);
  console.log(`\nAdded ${item.kind} ${item.name}.`);

  for (const instruction of changeSet.instructions) console.log(`- ${instruction}`);
}

async function resolveSelection(
  options: SourceCommandOptions,
  detectedFramework?: CatalogFramework,
  detectedStyle?: CatalogStyle
): Promise<{ framework: CatalogFramework; style: CatalogStyle }> {
  let framework = options.framework ? parseFramework(options.framework) : detectedFramework;
  let style = options.style ? parseStyle(options.style) : detectedStyle;

  if (!framework) {
    if (options.json || !process.stdin.isTTY) {
      throw new Error('Could not determine a framework. Recommendation: pass --framework react or --framework html.');
    }

    const answer = await select<CatalogFramework>({
      message: 'Framework',
      options: [
        { value: 'react', label: 'React' },
        { value: 'html', label: 'HTML custom elements' },
      ],
    });
    if (isCancel(answer)) throw new Error('Cancelled.');

    framework = answer;
  }

  if (!style) {
    if (options.json || !process.stdin.isTTY) {
      throw new Error('Could not determine styling. Recommendation: pass --style css or --style tailwind.');
    }

    const answer = await select<CatalogStyle>({
      message: 'Styling',
      options: [
        { value: 'css', label: 'CSS' },
        { value: 'tailwind', label: 'Tailwind CSS' },
      ],
    });
    if (isCancel(answer)) throw new Error('Cancelled.');

    style = answer;
  }

  return { framework, style };
}

function printPlan(changeSet: ChangeSet): void {
  console.log(`${changeSet.item.title} (${changeSet.item.framework}/${changeSet.item.style})`);

  for (const file of changeSet.files) console.log(`${file.status.padEnd(9)} ${file.relativePath}`);
}

function printDiff(changeSet: ChangeSet): void {
  for (const file of changedFiles(changeSet)) {
    console.log(createPatch(file.relativePath, file.previous ?? '', file.content, 'local', 'catalog'));
  }
}

function changedFiles(changeSet: ChangeSet): ChangeSet['files'] {
  return changeSet.files.filter((file) => file.status !== 'unchanged');
}

function serializableChangeSet(changeSet: ChangeSet) {
  return {
    version: __CLI_VERSION__,
    item: {
      kind: changeSet.item.kind,
      name: changeSet.item.name,
      framework: changeSet.item.framework,
      style: changeSet.item.style,
    },
    files: changeSet.files.map(({ relativePath, status }) => ({ path: relativePath, status })),
    conflicts: changeSet.conflicts.map(({ relativePath }) => relativePath),
    instructions: changeSet.instructions,
  };
}

function parseKind(value: string): CatalogKind {
  if (value === 'component' || value === 'skin') return value;

  throw new Error(`Invalid source kind \`${value}\`. Expected component or skin.`);
}

function parseFramework(value: string): CatalogFramework {
  if (value === 'html' || value === 'react') return value;

  throw new Error(`Invalid framework \`${value}\`. Expected html or react.`);
}

function parseStyle(value: string): CatalogStyle {
  if (value === 'css' || value === 'tailwind') return value;

  throw new Error(`Invalid style \`${value}\`. Expected css or tailwind.`);
}
