import { defineConfig } from 'vite-plus';

import { cachedTaskInputs, packageTestTask, workspaceTaskDependencies } from '../../build/task.ts';

const packageDir = import.meta.dirname;

export default defineConfig({
  run: {
    tasks: {
      'prepare:shadcn': {
        command: 'vp -C shadcn pack',
        dependsOn: workspaceTaskDependencies(),
        // The registry plugin compares files in its output directory before
        // rewriting them; those reads must not turn outputs into inputs.
        input: [
          ...cachedTaskInputs,
          '!dist/registry',
          '!dist/registry/**',
          { pattern: '!packages/html/src/presets/background/skin.ts', base: 'workspace' },
          { pattern: '!packages/html/src/define/background/skin.css', base: 'workspace' },
          { pattern: '!packages/html/src/internal/skins', base: 'workspace' },
          { pattern: '!packages/html/src/internal/skins/**', base: 'workspace' },
          { pattern: '!packages/react/src/internal/skins', base: 'workspace' },
          { pattern: '!packages/react/src/internal/skins/**', base: 'workspace' },
          { pattern: '!packages/react/src/presets/*/skin.tsx', base: 'workspace' },
          { pattern: '!packages/react/src/presets/*/skin.css', base: 'workspace' },
          { pattern: '!packages/react/src/presets/*/minimal-skin.tsx', base: 'workspace' },
          { pattern: '!packages/react/src/presets/*/minimal-skin.css', base: 'workspace' },
        ],
        output: [
          'dist/registry/source/**',
          { pattern: 'packages/html/src/presets/background/skin.ts', base: 'workspace' },
          { pattern: 'packages/html/src/define/background/skin.css', base: 'workspace' },
          { pattern: 'packages/html/src/internal/skins/**', base: 'workspace' },
          { pattern: 'packages/react/src/internal/skins/**', base: 'workspace' },
          { pattern: 'packages/react/src/presets/*/skin.tsx', base: 'workspace' },
          { pattern: 'packages/react/src/presets/*/skin.css', base: 'workspace' },
          { pattern: 'packages/react/src/presets/*/minimal-skin.tsx', base: 'workspace' },
          { pattern: 'packages/react/src/presets/*/minimal-skin.css', base: 'workspace' },
        ],
      },
      'build:shadcn': {
        command: 'rimraf dist/registry/r && shadcn build dist/registry/source/registry.json --output dist/registry/r',
        dependsOn: ['prepare:shadcn'],
        input: ['dist/registry/source/**'],
        output: ['dist/registry/r/**'],
      },
      'validate:shadcn': {
        command: 'node --import tsx scripts/validate-shadcn-registry.ts',
        dependsOn: ['build:shadcn', '@videojs/html#build', '@videojs/react#build'],
        cache: false,
      },
      'test:ci': {
        ...packageTestTask('pnpm run test:types && vp test run'),
        dependsOn: ['validate:shadcn'],
      },
    },
  },
  test: {
    projects: [
      {
        test: {
          name: 'skins',
          root: packageDir,
          include: ['framework/**/*.test.ts', 'vjsc/**/*.test.ts'],
          // These integration tests share Vite and Rolldown package state.
          fileParallelism: false,
        },
      },
    ],
  },
});
