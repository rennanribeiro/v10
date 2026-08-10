import { globSync } from 'node:fs';
import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { normalizePath } from 'vite';
import { defineConfig } from 'vite-plus';
import type { UserConfig as PackUserConfig } from 'vite-plus/pack';
import { vjscPlugin } from 'vjsc/vite';

import { copyCssPlugin } from '../../build/plugins/copy-css-plugin.ts';
import { type PackageBuildMode, packageBuildConfig, packageBuildModes } from '../../build/pack.ts';
import { iconElementSourcePlugin } from '../icons/vjsc/vite';
import { configureSkinModule } from './vjsc/config';

const packageDir = import.meta.dirname;
const reactSourceDir = normalizePath(resolve(packageDir, '../react/src'));
const htmlDefineDir = normalizePath(resolve(packageDir, '../html/src/define'));
const htmlIconElementDir = normalizePath(resolve(packageDir, '../html/src/icons/element'));
const skinsDir = resolve('src');
const entries = Object.fromEntries(
  globSync('src/**/*.tailwind.ts').map((file) => {
    const key = file.replace('src/', '').replace('.ts', '');
    return [key, file];
  })
);

const createPackConfig = (mode: PackageBuildMode): PackUserConfig => ({
  ...packageBuildConfig(mode, 'browser'),
  entry: entries,
  plugins: [copyCssPlugin({ skinsDir, outDir: `dist/${mode}`, inline: false, rebuild: false })],
});

export default defineConfig({
  ...createPreviewConfig(),
  test: {
    include: ['vjsc/**/*.test.ts'],
  },
  pack: packageBuildModes.map(createPackConfig),
});

function createPreviewConfig() {
  return {
    root: resolve(packageDir, 'dev'),
    define: {
      __DEV__: 'true',
    },
    plugins: [
      iconElementSourcePlugin(),
      vjscPlugin({
        configure: configureSkinModule,
      }),
      tailwindcss(),
      react({ jsxImportSource: 'react' }),
    ],
    resolve: {
      alias: [
        { find: /^@videojs\/react(?=\/|$)/, replacement: reactSourceDir },
        { find: /^@videojs\/html\/icons\/element(?=\/|$)/, replacement: htmlIconElementDir },
        { find: /^@videojs\/html(?=\/|$)/, replacement: htmlDefineDir },
      ],
      conditions: ['development', 'import', 'module', 'browser', 'default'],
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
      exclude: ['vjsc', 'vjsc/styles', '@videojs/core', '@videojs/icons', '@videojs/react', '@videojs/utils'],
    },
    build: {
      sourcemap: true,
      rolldownOptions: {
        experimental: {
          nativeMagicString: true,
        },
      },
    },
  };
}
