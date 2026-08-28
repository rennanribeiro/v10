import { isString } from '@videojs/utils/predicate';
import { format } from 'oxfmt';
import type { Plugin } from 'vite';

const sourceFile = /\.(?:css|[cm]?[jt]sx?)$/;

interface RegistryFormatResult {
  readonly code: string;
  readonly errors: readonly { readonly message: string }[];
}

/** Format generated registry source before the stock Shadcn build embeds it in item JSON. */
export function formatRegistrySources(): Plugin {
  return {
    name: 'videojs:format-registry-sources',
    async generateBundle(_options, bundle) {
      await Promise.all(
        Object.values(bundle).map(async (asset) => {
          if (asset.type !== 'asset' || !isString(asset.source) || !sourceFile.test(asset.fileName)) return;

          const result = await formatRegistrySource(asset.fileName, asset.source);

          if (result.errors.length > 0) {
            const messages = result.errors.map((error) => error.message).join('\n');

            throw new Error(`Could not format generated registry source \`${asset.fileName}\`:\n${messages}`);
          }

          asset.source = result.code;
        })
      );
    },
  };
}

/** Format one generated registry source file with the repository's source conventions. */
export function formatRegistrySource(filename: string, source: string): Promise<RegistryFormatResult> {
  return format(filename, source, {
    arrowParens: 'always',
    bracketSpacing: true,
    jsdoc: true,
    printWidth: 120,
    semi: true,
    singleQuote: !filename.endsWith('.css'),
    sortImports: true,
    tabWidth: 2,
    trailingComma: 'es5',
  });
}
