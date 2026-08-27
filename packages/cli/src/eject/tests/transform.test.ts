import { resolve } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import type { ResolvedCatalogItem } from '../../catalog/index.js';
import { htmlSkinContract, reactSkinContract } from '../skin-contract.js';
import { transformHtmlSkinUsage, transformReactSkinUsage } from '../transform.js';

const names = [
  'video',
  'minimal-video',
  'audio',
  'minimal-audio',
  'live-video',
  'minimal-live-video',
  'live-audio',
  'minimal-live-audio',
] as const;
const root = resolve('/project/src/components/videojs');

describe('transformReactSkinUsage', () => {
  it('replaces every packaged skin contract while preserving package media imports and local aliases', () => {
    for (const name of names) {
      for (const style of ['css', 'tailwind'] as const) {
        const item = fixtureItem(name, 'react', style);
        const contract = reactSkinContract(item);
        const stylesheet = contract.stylesheetSource ? `\nimport ${JSON.stringify(contract.stylesheetSource)};` : '';
        const source =
          `import { VideoPlayer, ${contract.packagedExport} as PlayerSkin } from ${JSON.stringify(contract.packageSource)};` +
          `${stylesheet}\nexport const player = <PlayerSkin data-player><VideoPlayer /></PlayerSkin>;\n`;
        const result = transformReactSkinUsage([{ path: '/project/src/player.tsx', source }], item, root);
        const output = result.edits[0]?.content ?? '';

        expect(result.packagedUses).toBe(1);
        expect(output).toContain(`import { VideoPlayer } from ${JSON.stringify(contract.packageSource)};`);
        expect(output).toContain(`import { ${contract.generatedExport} as PlayerSkin } from`);
        expect(output).toContain('<PlayerSkin data-player>');

        if (contract.stylesheetSource) expect(output).not.toContain(contract.stylesheetSource);
      }
    }
  });

  it('detects an already source-owned import and refuses namespace imports', () => {
    const item = fixtureItem('video', 'react', 'css');
    const local = `import { DefaultVideoSkin as VideoSkin } from './components/videojs/skins/default-video/skin';`;
    const already = transformReactSkinUsage([{ path: '/project/src/player.tsx', source: local }], item, root);

    expect(already).toMatchObject({ packagedUses: 0, localUses: 1, edits: [] });

    expect(() =>
      transformReactSkinUsage(
        [{ path: '/project/src/player.tsx', source: `import * as VideoPreset from '@videojs/react/video';` }],
        item,
        root
      )
    ).toThrow('namespace import');

    expect(() =>
      transformReactSkinUsage(
        [{ path: '/project/src/player.tsx', source: "void import('@videojs/react/video/skin.css');\n" }],
        item,
        root
      )
    ).toThrow('packaged stylesheet is loaded dynamically');
  });
});

describe('transformHtmlSkinUsage', () => {
  it('replaces every static packaged skin and preserves media, poster, and root attributes', () => {
    for (const name of names) {
      for (const style of ['css', 'tailwind'] as const) {
        const item = fixtureItem(name, 'html', style);
        const contract = htmlSkinContract(item);
        const video = name.includes('video');
        const children = `<media-${video ? 'video' : 'audio'} id="media"></media-${video ? 'video' : 'audio'}>`;
        const poster = video ? '<img slot="poster" src="poster.jpg">' : '';
        const result = transformHtmlSkinUsage(
          [
            {
              path: '/project/src/player.ts',
              source: `import ${JSON.stringify(contract.registrationSource)};\n`,
            },
            {
              path: '/project/src/index.html',
              source: `<${contract.tag} class="player" style="max-width: 40rem">${children}${poster}</${contract.tag}>`,
            },
          ],
          item,
          root
        );
        const script = result.edits.find((edit) => edit.path.endsWith('.ts'))?.content ?? '';
        const html = result.edits.find((edit) => edit.path.endsWith('.html'))?.content ?? '';

        expect(result.packagedUses).toBe(2);
        expect(script).not.toContain(contract.registrationSource);
        expect(script).toContain(`${name}.register`);
        expect(script).toContain(`styles/${name}${style === 'tailwind' ? '.tailwind' : ''}.css`);
        expect(html).not.toContain(`<${contract.tag}`);
        expect(html).toContain('class="media-skin player"');
        expect(html).toContain('style="max-width: 40rem"');
        expect(html).toContain(children);

        if (video) {
          expect(html).toContain('<img src="poster.jpg">');
          expect(html).not.toContain('slot="poster"');
        }
      }
    }
  });

  it('refuses registration without static markup', () => {
    const item = fixtureItem('video', 'html', 'css');
    const contract = htmlSkinContract(item);

    expect(() =>
      transformHtmlSkinUsage(
        [{ path: '/project/src/player.ts', source: `import ${JSON.stringify(contract.registrationSource)};\n` }],
        item,
        root
      )
    ).toThrow('without static <video-skin> markup');
  });

  it('refuses ambiguous poster ownership', () => {
    const item = fixtureItem('video', 'html', 'css');
    const contract = htmlSkinContract(item);

    expect(() =>
      transformHtmlSkinUsage(
        [
          { path: '/project/src/player.ts', source: `import ${JSON.stringify(contract.registrationSource)};\n` },
          {
            path: '/project/src/index.html',
            source: `<${contract.tag}><img slot="poster"><img slot="poster"></${contract.tag}>`,
          },
        ],
        item,
        root
      )
    ).toThrow('more than one poster slot');
  });

  it('detects an already source-owned dotted registration module', () => {
    const item = fixtureItem('video', 'html', 'css');
    const result = transformHtmlSkinUsage(
      [{ path: '/project/src/player.ts', source: "import './components/videojs/video.register';\n" }],
      item,
      root
    );

    expect(result).toMatchObject({ packagedUses: 0, localUses: 1, edits: [] });
  });
});

function fixtureItem(
  name: (typeof names)[number],
  framework: 'html' | 'react',
  style: 'css' | 'tailwind'
): ResolvedCatalogItem {
  const entry = framework === 'html' ? `${name}.html` : `skins/${skinContext(name)}/skin.tsx`;
  const stylesheet = `styles/${name}${style === 'tailwind' ? '.tailwind' : ''}.css`;
  const setup = framework === 'html' ? `${name}.register.ts` : undefined;
  const contentMarker = framework === 'html' ? '<!-- Add your media element here. -->' : undefined;
  const posterMarker = framework === 'html' && name.includes('video') ? '<!-- Poster -->' : undefined;
  const markup = `<media-container class="media-skin">${contentMarker ?? ''}${
    posterMarker ? `<media-poster>${posterMarker}<img alt=""></img></media-poster>` : ''
  }</media-container>\n`;

  return {
    kind: 'skin',
    name,
    title: name,
    description: `${name} fixture`,
    framework,
    style,
    context: skinContext(name),
    entry,
    stylesheet,
    setup,
    contentMarker,
    posterMarker,
    files: [
      { path: entry, content: framework === 'html' ? markup : 'export function Skin() {}\n' },
      { path: stylesheet, content: '.media-skin {}\n' },
      ...(setup ? [{ path: setup, content: 'export {};\n' }] : []),
    ],
    dependencies: [],
    devDependencies: [],
  };
}

function skinContext(name: string): string {
  return name.startsWith('minimal-') ? `minimal-${name.slice('minimal-'.length)}` : `default-${name}`;
}
