import { globSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { normalizePath } from 'vite';
import { defineConfig } from 'vite-plus';
import type { UserConfig as ViteUserConfig } from 'vite-plus';
import type { UserConfig as PackUserConfig } from 'vite-plus/pack';
import { shadcnPlugin, vjscPlugin as vjscPackPlugin } from 'vjsc/plugins';
import type { ShadcnItem } from 'vjsc/shadcn';
import { vjscPlugin } from 'vjsc/vite';

import { baseConfig, type PackageBuildMode, packageBuildConfig, packageBuildModes } from '../../build/pack.ts';
import { copyCssPlugin } from '../../build/plugins/copy-css-plugin.ts';
import { iconElementSourcePlugin } from '../icons/vjsc/vite';
import { configureSkinModule } from './vjsc/config';
import { type SkinModuleMeta, skinStyles } from './vjsc/meta';

const packageDir = import.meta.dirname;
const reactSourceDir = normalizePath(resolve(packageDir, '../react/src'));
const htmlDefineDir = normalizePath(resolve(packageDir, '../html/src/define'));
const htmlIconElementDir = normalizePath(resolve(packageDir, '../html/src/icons/element'));
const skinsDir = resolve('src');
const vjscDir = resolve(packageDir, 'vjsc');
const registryUtils = resolve(vjscDir, 'utils.ts');
const registryPaths = {
  output: 'vjsc/registry',
  source: 'default',
  install: 'components/videojs',
  import: '@/components/videojs',
} as const;
const entries = Object.fromEntries(
  globSync('src/**/*.tailwind.ts').map((file) => {
    const key = file.replace('src/', '').replace('.ts', '');
    return [key, file];
  })
);

const createPackConfig = (mode: PackageBuildMode): PackUserConfig => ({
  ...packageBuildConfig(mode, 'browser'),
  name: 'skins',
  entry: entries,
  plugins: [copyCssPlugin({ skinsDir, outDir: `dist/${mode}`, inline: false, rebuild: false })],
});

export const shadcnPackConfig: PackUserConfig = {
  ...baseConfig,
  name: 'skins-shadcn-registry',
  cwd: packageDir,
  entry: { registry: registryUtils },
  outDir: 'dist/registry',
  clean: true,
  dts: false,
  sourcemap: false,
  platform: 'browser',
  format: 'es',
  alias: {
    '@videojs/skins/registry': registryUtils,
    '@videojs/utils/style': registryUtils,
  },
  deps: {
    neverBundle: true,
    alwaysBundle: ['@videojs/skins/registry', '@videojs/utils/style'],
    onlyBundle: false,
  },
  plugins: [
    vjscPackPlugin({ configure: configureSkinModule }),
    shadcnPlugin<SkinModuleMeta>({
      root: vjscDir,
      include: ['./components/**/*.{ts,tsx}', './skins/*/skin.{ts,tsx}', './utils.ts'],
      name: 'videojs',
      homepage: 'https://videojs.org',
      namespace: '@videojs',
      paths: registryPaths,
      meta: {
        framework: 'react',
        style: 'tailwind',
      },
      publish: {
        modules: (module) => {
          if (module.filename === registryUtils) return [{}];

          const skins = Object.keys(skinStyles);
          const ownedSkin = skins.find((name) => module.filename.includes(`/skins/${name}/skin.`));
          const selected = ownedSkin ? [ownedSkin] : skins;

          return selected.map((skin) => ({
            target: 'react',
            skin,
            style: 'tailwind',
          }));
        },
        items: (modules) =>
          modules.flatMap<ShadcnItem<SkinModuleMeta>>((module) => {
            const { filename, meta, transform } = module;

            if (filename === registryUtils) {
              return [
                {
                  module,
                  name: 'utils',
                  type: 'registry:lib',
                  title: 'Video.js Utilities',
                  description:
                    'Class-name composition and state resolution utilities used by editable Video.js components.',
                  filename: 'utils.ts',
                },
              ];
            }

            if (!meta) return [];

            const skinName = transform.skin;
            const skin = modules.find(
              (candidate) => candidate.meta?.type === 'skin' && candidate.meta.name === skinName
            )?.meta;

            if (skin?.type !== 'skin') throw new Error(`Unknown skin: \`${skinName}\`.`);

            const variant = skin.style.variant;

            return [
              {
                module,
                name: meta.type === 'skin' || skin.style.theme === 'default' ? meta.name : `${meta.name}-${variant}`,
                type: meta.type === 'skin' ? 'registry:block' : 'registry:component',
                title: skin.style.theme === 'minimal' && meta.type !== 'skin' ? `${meta.title} (Minimal)` : meta.title,
                description: meta.description,
                filename: basename(filename),
                meta: { variant },
              },
            ];
          }),
      },
      styles: {
        input: './styles/tailwind.registry.css',
        filename: 'tailwind.css',
        title: 'Video.js Skin Styles',
        description: 'Shared Tailwind input, base behavior, and Default and Minimal video themes.',
      },
    }),
  ],
};

const previewConfig = createPreviewConfig();

// SAFETY: Vite+ supplies the workspace Vite runtime; the duplicate plugin type instances are runtime-compatible.
export default defineConfig({
  ...(previewConfig as ViteUserConfig),
  test: {
    projects: [
      {
        test: {
          name: 'skins',
          root: packageDir,
          include: ['vjsc/**/*.test.ts'],
        },
      },
    ],
  },
  pack: [...packageBuildModes.map(createPackConfig), shadcnPackConfig],
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
