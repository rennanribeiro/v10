import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { transform } from '@svgr/core';
import { transform as esbuildTransform } from 'esbuild';
import { optimize } from 'svgo';
import { iconBases } from './icon-bases.js';
import {
  ASSETS_DIR,
  createSvgoConfig,
  getSvgFiles,
  PRESET_DEFAULT_OVERRIDES,
  REMOVE_ATTRS_PLUGIN,
  replaceColors,
} from './shared.js';

const SVGO_CONFIG = createSvgoConfig([
  {
    name: 'preset-default',
    params: { overrides: PRESET_DEFAULT_OVERRIDES },
  },
  REMOVE_ATTRS_PLUGIN,
  {
    name: 'addAttributesToSVGElement',
    params: {
      attributes: [{ 'aria-hidden': 'true' }],
    },
  },
]);

export function optimizeSvg(svgContent: string): string {
  return replaceColors(optimize(svgContent, SVGO_CONFIG).data);
}

export async function buildReactComponent(
  svgContent: string,
  componentName: string
): Promise<{ js: string; tsx: string }> {
  const optimized = optimizeSvg(svgContent);
  const transformOpts: Parameters<typeof transform>[1] = {
    plugins: ['@svgr/plugin-jsx'],
    jsxRuntime: 'automatic',
  };
  const tsxCode = await transform(optimized, { ...transformOpts, typescript: true }, { componentName });
  const jsxCode = await transform(optimized, transformOpts, { componentName });
  const { code } = await esbuildTransform(jsxCode, { loader: 'jsx', jsx: 'automatic' });

  return { js: code, tsx: tsxCode };
}

export function buildHtmlExport(svgContent: string, varName: string): string {
  return `export const ${varName} = \`${optimizeSvg(svgContent)}\`;\n`;
}

export async function createReactIconsSource(componentNames: readonly string[], iconSet = 'default'): Promise<string> {
  const icons = await resolveIcons(componentNames, iconSet);
  const components = icons.map(({ componentName, source }) => reactIconSource(source, componentName));

  return [`import { createElement, type SVGProps } from 'react';`, ``, ...components, ``].join('\n');
}

export async function createHtmlIconsSource(componentNames: readonly string[], iconSet = 'default'): Promise<string> {
  const icons = await resolveIcons(componentNames, iconSet);
  const entries = icons.map(({ fileName, source }) => `  '${fileName}': \`${optimizeSvg(source)}\`,`);

  return [
    `import '@videojs/html/icons/element';`,
    ``,
    `interface MediaIconConstructor extends CustomElementConstructor {`,
    `  register(family: string, icons: Readonly<Record<string, string>>): void;`,
    `}`,
    ``,
    `const icons = {`,
    ...entries,
    `};`,
    ``,
    `if (typeof customElements !== 'undefined' && typeof HTMLElement !== 'undefined') {`,
    `  const iconElement = customElements.get('media-icon') as MediaIconConstructor | undefined;`,
    `  iconElement?.register('${iconSet}', icons);`,
    `}`,
    ``,
  ].join('\n');
}

async function resolveIcons(
  componentNames: readonly string[],
  iconSet: string
): Promise<Array<{ componentName: string; fileName: string; source: string }>> {
  const byComponent = new Map(
    getSvgFiles(iconSet).map((file) => {
      const fileName = file.slice(0, -'.svg'.length);
      return [`${iconBases(fileName).pascal}Icon`, fileName] as const;
    })
  );

  return Promise.all(
    [...new Set(componentNames)].sort().map(async (componentName) => {
      const fileName = byComponent.get(componentName);
      if (!fileName) throw new Error(`Unknown ${iconSet} icon component \`${componentName}\`.`);
      return {
        componentName,
        fileName,
        source: await readFile(join(ASSETS_DIR, iconSet, `${fileName}.svg`), 'utf8'),
      };
    })
  );
}

function reactIconSource(source: string, componentName: string): string {
  const optimized = optimizeSvg(source);
  const match = /^<svg\s*([^>]*)>([\s\S]*)<\/svg>$/.exec(optimized);
  if (!match) throw new Error(`Cannot generate React source for \`${componentName}\`.`);

  const attributes = [...(match[1] ?? '').matchAll(/([^\s=]+)="([^"]*)"/g)].map((attribute) => {
    const name = reactAttributeName(attribute[1] ?? '');
    return `    ${JSON.stringify(name)}: ${JSON.stringify(attribute[2] ?? '')},`;
  });

  return [
    `export function ${componentName}(props: SVGProps<SVGSVGElement>) {`,
    `  return createElement('svg', {`,
    ...attributes,
    `    ...props,`,
    `    dangerouslySetInnerHTML: { __html: ${JSON.stringify(match[2] ?? '')} },`,
    `  });`,
    `}`,
  ].join('\n');
}

function reactAttributeName(name: string): string {
  if (name === 'class') return 'className';
  if (name.startsWith('aria-') || name.startsWith('data-')) return name;
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
