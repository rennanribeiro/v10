import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { CatalogFramework, CatalogStyle } from '../catalog/schema.js';

export interface ProjectInfo {
  readonly cwd: string;
  readonly packageFile: string;
  readonly packageJson: JsonObject;
  readonly framework?: CatalogFramework | undefined;
  readonly style: CatalogStyle;
  readonly defaultPath: string;
}

export async function detectProject(cwd: string): Promise<ProjectInfo> {
  const requestedRoot = resolve(cwd);
  const root = await realpath(requestedRoot).catch(() => requestedRoot);
  const packageFile = resolve(root, 'package.json');
  let packageJson: JsonObject;

  try {
    const parsed: JsonValue = JSON.parse(await readFile(packageFile, 'utf8'));

    if (Object.prototype.toString.call(parsed) !== '[object Object]')
      throw new Error('package.json must be an object.');

    // SAFETY: JSON.parse returns JsonValue and the object representation was checked above.
    packageJson = parsed as JsonObject;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(`Could not read a project package.json at \`${packageFile}\`.\nReason: ${reason}`);
  }

  const dependencies = dependencyNames(packageJson);
  const hasReact = dependencies.has('@videojs/react') || dependencies.has('react');
  const hasHtml = dependencies.has('@videojs/html');
  const framework = hasReact === hasHtml ? undefined : hasReact ? 'react' : 'html';
  const style = dependencies.has('tailwindcss') ? 'tailwind' : 'css';

  return {
    cwd: root,
    packageFile,
    packageJson,
    framework,
    style,
    defaultPath: 'src/components/videojs',
  };
}

export type JsonValue = boolean | JsonObject | JsonValue[] | null | number | string;
export type JsonObject = { [key: string]: JsonValue };

function dependencyNames(packageJson: JsonObject): Set<string> {
  const names = new Set<string>();

  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const dependencies = packageJson[field];
    if (Object.prototype.toString.call(dependencies) !== '[object Object]') continue;

    // SAFETY: The JSON object representation was checked immediately above.
    const object = dependencies as JsonObject;

    for (const name of Object.keys(object)) names.add(name);
  }

  return names;
}
