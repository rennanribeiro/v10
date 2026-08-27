import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite-plus';

import { baseConfig } from '../../build/pack.ts';
import { cachedTaskInputs } from '../../build/task.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
const siteSrcDir = resolve(__dirname, '../../site/src');
const ejectCatalog = resolve(__dirname, '../skins/dist/eject/catalog.json');
const ejectCatalogFixture = resolve(__dirname, 'src/catalog/tests/fixtures/eject-catalog.json');
const cdnMediaFixture = resolve(__dirname, 'src/utils/tests/fixtures/cdn-media.json');
const packCdnMedia =
  process.env.VIDEOJS_CLI_CDN_FIXTURE === '1' ? cdnMediaFixture : resolve(siteSrcDir, 'content/cdn-media.json');
const siteAliases = {
  '@/utils/installation/codegen': resolve(siteSrcDir, 'utils/installation/codegen.ts'),
  '@/utils/installation/types': resolve(siteSrcDir, 'utils/installation/types.ts'),
  '@/utils/installation/cdn-code': resolve(siteSrcDir, 'utils/installation/cdn-code.ts'),
  '@/utils/installation/detect-renderer': resolve(siteSrcDir, 'utils/installation/detect-renderer.ts'),
  '@/utils/installation/renderer-options': resolve(siteSrcDir, 'utils/installation/renderer-options.ts'),
  '@/consts': resolve(siteSrcDir, 'consts.ts'),
};

export default defineConfig({
  run: {
    tasks: {
      build: {
        command: 'node --import tsx ../../site/scripts/copy-package-docs.ts cli && vp pack',
        dependsOn: ['site#build', '@videojs/skins#build:eject'],
        input: cachedTaskInputs,
        output: ['dist/**', 'docs/**'],
      },
      'test:ci': {
        command: 'pnpm test && VIDEOJS_CLI_CDN_FIXTURE=1 vp pack && pnpm test:source-output',
        cache: false,
        // Unit tests use committed catalog/CDN fixtures. The source-output integration
        // pass packs the real generated catalog, then builds all supported clean fixtures.
        dependsOn: ['@videojs/utils#build', '@videojs/skins#build:eject'],
      },
    },
  },
  define: {
    __CLI_VERSION__: JSON.stringify('0.0.0-test'),
  },
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      ...siteAliases,
      // The real manifest is generated at build time (gitignored) and bundled
      // by Vite+ pack. CLI tests are intentionally hermetic (`test` has no task-runner
      // build dependency), so they resolve a committed fixture that mirrors the
      // manifest's shape and contents instead of forcing a CDN build.
      '@/content/cdn-media.json': cdnMediaFixture,
      '@/content/eject-catalog.json': ejectCatalogFixture,
    },
  },
  pack: {
    ...baseConfig,
    entry: { index: './src/index.ts' },
    platform: 'node',
    format: 'es',
    clean: true,
    banner: { js: '#!/usr/bin/env node' },
    deps: { alwaysBundle: ['site'] },
    define: {
      __CLI_VERSION__: JSON.stringify(pkg.version),
    },
    alias: {
      ...siteAliases,
      // The source-output CI task runs before the site manifest exists and opts
      // into its committed mirror. Release builds continue to bundle the generated manifest.
      '@/content/cdn-media.json': packCdnMedia,
      '@/content/eject-catalog.json': ejectCatalog,
    },
  },
});
