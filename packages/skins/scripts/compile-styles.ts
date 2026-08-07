import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'tailwindcss';

const tailwindRoot = resolve(dirname(fileURLToPath(import.meta.resolve('tailwindcss'))), '..');

/** Compile the utility candidates used by one artifact into ordinary CSS. */
export async function compileVanillaStyles(tailwindSource: string, sourceFiles: readonly string[]): Promise<string> {
  const compiler = await compile(vanillaCompilerSource(tailwindSource), {
    base: process.cwd(),
    loadStylesheet: async (id, base) => {
      const path = id.startsWith('tailwindcss/')
        ? resolve(tailwindRoot, id.slice('tailwindcss/'.length))
        : resolve(base, id);
      return { path, base: dirname(path), content: await readFile(path, 'utf8') };
    },
  });

  return compiler.build(collectCandidates(sourceFiles));
}

function vanillaCompilerSource(source: string): string {
  return source
    .replace(
      '@import "tailwindcss";',
      [
        '@layer theme, base, components, utilities;',
        '@import "tailwindcss/theme.css" layer(theme) reference;',
        '@import "tailwindcss/utilities.css" layer(utilities);',
      ].join('\n')
    )
    .replace(/^@import "\.\/base\.css";\s*$/m, '')
    .replace(/^@import "\.\/themes\/default\.css";\s*$/m, '')
    .replace(/^@source .*;\s*$/gm, '');
}

function collectCandidates(sourceFiles: readonly string[]): string[] {
  const candidates = new Set<string>();
  for (const source of sourceFiles) {
    for (const match of source.matchAll(/(['"])(.*?)\1/gs)) {
      for (const candidate of match[2]?.split(/\s+/) ?? []) {
        if (candidate) candidates.add(candidate);
      }
    }
  }
  return [...candidates].sort();
}
