import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createHtmlSkinArtifacts, createReactSkinArtifacts } from '../materialize.ts';

const presets = ['video', 'audio', 'live-video', 'live-audio'] as const;
const variants = ['default', 'minimal'] as const;

describe('createReactSkinArtifacts', () => {
  it('maps the CSS skin graph into public and private React package files', () => {
    const assets = fixtureRegistry();
    const files = new Map(createReactSkinArtifacts(assets).map((file) => [file.path, file.content]));

    expect(files).toHaveLength(25);
    expect(files.get('packages/react/src/presets/video/skin.tsx')).toContain('export interface VideoSkinProps');
    expect(files.get('packages/react/src/presets/video/skin.tsx')).toContain('export function VideoSkin');
    expect(files.get('packages/react/src/presets/video/skin.tsx')).toContain('extends BaseVideoSkinProps');
    expect(files.get('packages/react/src/presets/video/skin.tsx')).toContain('poster={renderPoster}');
    expect(files.get('packages/react/src/presets/video/skin.tsx')).toContain('as GeneratedSkin');
    expect(files.get('packages/react/src/presets/video/minimal-skin.tsx')).toContain(
      'export function MinimalVideoSkin'
    );
    expect(files.get('packages/react/src/internal/skins/skins/video-css/skin.tsx')).toContain("from '../../ui/button'");
    expect(files.get('packages/react/src/internal/skins/skins/video-css/skin.tsx')).not.toContain('skin.css');
    expect(files.get('packages/react/src/internal/skins/ui/button.tsx')).toContain("from '@videojs/utils/style'");
  });
});

describe('createHtmlSkinArtifacts', () => {
  it('renders static templates and exact package registration from the prepared HTML graph', async () => {
    const workspaceDir = resolve(import.meta.dirname, '../../../..');
    const files = new Map(
      (await createHtmlSkinArtifacts(fixtureRegistry(), workspaceDir)).map((file) => [file.path, file.content])
    );

    expect(files).toHaveLength(24);
    expect(files.get('packages/html/src/internal/skins/default-video/template.ts')).toContain('<media-container');
    expect(files.get('packages/html/src/internal/skins/default-video/template.ts')).toContain('<media-play-button');
    expect(files.get('packages/html/src/internal/skins/default-video/register.ts')).toContain(
      "import '../../../define/ui/container';"
    );
    expect(files.get('packages/html/src/internal/skins/default-video/register.ts')).toContain(
      "import '../../../define/ui/play-button';"
    );
    expect(files.get('packages/html/src/internal/skins/default-video/register.ts')).toContain(
      "registerIcons('default', {\n  play: playIcon,\n});"
    );
    expect(files.get('packages/html/src/internal/skins/default-video/skin.css')).toBe('.video-default {}\n');
  });
});

function fixtureRegistry(): Map<string, string> {
  const files = new Map<string, string>();
  const reactItems = presets.flatMap((preset) =>
    variants.map((variant) => {
      const directory = `${preset}${variant === 'minimal' ? '-minimal' : ''}-css`;
      const component = `${pascalCase(variant)}${pascalCase(preset)}Skin`;
      const name = `react-${preset}-skin${variant === 'minimal' ? '-minimal' : ''}-css`;
      const root = `files/${name}/skin.tsx`;
      const stylesheet = `files/${name}/skin.css`;

      files.set(
        `react/skins/${root}`,
        `import './skin.css';\nimport { Button } from '@/components/videojs/ui/button';\n\nexport interface ${component}Props {}\nexport function ${component}(_props: ${component}Props = {}) { return <Button />; }\n`
      );
      files.set(`react/skins/${stylesheet}`, `.${directory} {}\n`);

      return {
        name,
        registryDependencies: ['@videojs/react-button'],
        files: [
          {
            path: root,
            target: `components/videojs/skins/${directory}/skin.tsx`,
          },
          {
            path: stylesheet,
            target: `components/videojs/skins/${directory}/skin.css`,
          },
        ],
        meta: {
          role: 'skin',
          framework: 'react',
          styling: 'css',
          preset,
          media: preset.endsWith('audio') ? 'audio' : 'video',
          variant,
          public: true,
        },
      };
    })
  );

  files.set('react/skins/registry.json', JSON.stringify({ items: reactItems }));
  const htmlItems = presets.flatMap((preset) =>
    variants.map((variant) => {
      const suffix = variant === 'minimal' ? '-minimal' : '';
      const directory = `${preset}${suffix}-css`;
      const component = `${pascalCase(variant)}${pascalCase(preset)}Skin`;
      const name = `html-${preset}-skin${suffix}-css`;
      const root = `files/${name}/skin.tsx`;
      const stylesheet = `files/${name}/skin.css`;

      files.set(
        `html/skins/${root}`,
        `/** @jsxImportSource vjsc/html-runtime */\nimport './skin.css';\nimport { registerIcons, playIcon } from '@videojs/html/icons';\nimport '@videojs/html/ui/container';\nimport '@videojs/html/ui/play-button';\n\nregisterIcons('default', { play: playIcon });\n\nexport function ${component}() { return <media-container><media-play-button><media-icon name="play" /></media-play-button></media-container>; }\n`
      );
      files.set(`html/skins/${stylesheet}`, `.${preset}-${variant} {}\n`);

      return {
        name,
        files: [
          {
            path: root,
            target: `components/videojs/skins/${directory}/skin.tsx`,
          },
          {
            path: stylesheet,
            target: `components/videojs/skins/${directory}/skin.css`,
          },
        ],
        meta: {
          role: 'skin',
          framework: 'html',
          styling: 'css',
          preset,
          media: preset.endsWith('audio') ? 'audio' : 'video',
          variant,
          public: true,
        },
      };
    })
  );

  files.set('html/skins/registry.json', JSON.stringify({ items: htmlItems }));
  files.set(
    'react/components/registry.json',
    JSON.stringify({
      items: [
        {
          name: 'react-button',
          files: [
            {
              path: 'files/react-button/button.tsx',
              target: 'components/videojs/ui/button.tsx',
            },
          ],
          meta: {
            role: 'component',
            framework: 'react',
            styling: 'tailwind',
            public: true,
          },
        },
      ],
    })
  );
  files.set(
    'react/components/files/react-button/button.tsx',
    "import { cn } from '@/components/videojs/utils';\n\nexport function Button() { return <button className={cn('button')} />; }\n"
  );

  return files;
}

function pascalCase(value: string): string {
  return value.replace(/(?:^|-)([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}
