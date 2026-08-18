import { describe, expect, it } from 'vitest';
import {
  DEMO_LIVE_POSTER_SRC,
  DEMO_LIVE_SRC,
  DEMO_POSTER_SRC,
  DEMO_VIDEO_SRC,
  SKINS,
} from '../ejected-skins/config.ts';
import {
  createRenderMediaIcon,
  evaluateTemplate,
  extractTemplateLiteral,
  parseImportedNames,
  prependHtmlSkinScripts,
  replaceSlots,
} from '../ejected-skins/html.ts';
import { buildEjectedSkin } from '../ejected-skins/index.ts';

describe('ejected skin configuration', () => {
  it('has a unique id for every configured skin', () => {
    expect(new Set(SKINS.map(({ id }) => id)).size).toBe(SKINS.length);
  });

  it('defines both platforms and styling modes', () => {
    expect(new Set(SKINS.map(({ platform }) => platform))).toEqual(new Set(['html', 'react']));
    expect(new Set(SKINS.map(({ style }) => style))).toEqual(new Set(['css', 'tailwind']));
  });

  it('defines every preset, skin, platform, and styling combination', () => {
    expect(SKINS).toHaveLength(32);
    expect(SKINS.filter(({ live }) => live)).toHaveLength(16);
  });
});

describe('ejected HTML skins', () => {
  it('extracts and evaluates the skin template', () => {
    const source = `function getTemplateHTML() { return /*html*/ \`\n  <button>\${label}</button>\n\`; }`;
    expect(evaluateTemplate(extractTemplateLiteral(source), { label: 'Play' })).toBe('<button>Play</button>');
  });

  it('collects imported names and aliases', () => {
    const imports = parseImportedNames("import { playText, pauseText as pause } from '@videojs/core';");
    expect([...imports]).toEqual([
      ['playText', '@videojs/core'],
      ['pause', '@videojs/core'],
    ]);
  });

  const slotSource = [
    '<!-- @deprecated use the default slot -->',
    '<slot name="media"></slot>',
    '<slot></slot>',
    '<slot name="poster"></slot>',
  ].join('\n');

  it('replaces media and poster slots', () => {
    const result = replaceSlots(slotSource, { mediaType: 'video', live: false });
    expect(result).toContain(`<video src="${DEMO_VIDEO_SRC}" playsinline></video>`);
    expect(result).toContain(`<img src="${DEMO_POSTER_SRC}" />`);
  });

  it('gives live skins a media element and a live source', () => {
    const result = replaceSlots(slotSource, { mediaType: 'video', live: true });
    expect(result).toContain(`<hlsjs-video src="${DEMO_LIVE_SRC}" playsinline></hlsjs-video>`);
    expect(result).toContain(`<img src="${DEMO_LIVE_POSTER_SRC}" />`);
  });

  it('escapes generated media icons', () => {
    expect(createRenderMediaIcon('minimal')('play&pause', { label: 'a"b' })).toBe(
      '<media-icon name="play&amp;pause" family="minimal" label="a&quot;b"></media-icon>'
    );
  });

  it('wraps snippets with the matching player and CDN bundle', () => {
    const skin = SKINS.find(({ id }) => id === 'minimal-audio');
    if (skin?.platform !== 'html') throw new Error('Missing HTML skin fixture');
    expect(prependHtmlSkinScripts('<media-controls></media-controls>', skin)).toContain(
      '/audio-minimal-ui.js"></script>\n<link rel="stylesheet" href="./player.css">\n\n<audio-player>'
    );
  });

  it('loads the media bundle alongside the UI bundle for live skins', () => {
    const skin = SKINS.find(({ id }) => id === 'minimal-live-video');
    if (skin?.platform !== 'html') throw new Error('Missing live HTML skin fixture');
    const result = prependHtmlSkinScripts('<media-controls></media-controls>', skin);
    expect(result).toContain('/live-video-minimal-ui.js"></script>');
    expect(result).toContain('/media/hlsjs-video.js"></script>');
    expect(result).toContain('<live-video-player>');
  });

  it('does not link a generated stylesheet for Tailwind skins', () => {
    const skin = SKINS.find(({ id }) => id === 'minimal-live-video-tailwind');
    if (skin?.platform !== 'html') throw new Error('Missing live Tailwind HTML skin fixture');

    expect(prependHtmlSkinScripts('<media-controls></media-controls>', skin)).not.toContain('player.css');
  });
});

describe('ejected React skins', () => {
  it('produces CSS and Tailwind players with matching dependencies', async () => {
    const cssSkin = SKINS.find(({ id }) => id === 'default-live-video-react');
    const tailwindSkin = SKINS.find(({ id }) => id === 'default-live-video-react-tailwind');
    if (cssSkin?.platform !== 'react' || tailwindSkin?.platform !== 'react') {
      throw new Error('Missing live React skin fixtures');
    }

    const [cssEntry, tailwindEntry] = await Promise.all([buildEjectedSkin(cssSkin), buildEjectedSkin(tailwindSkin)]);
    const cssSource = cssEntry.tsx?.['LiveVideoPlayer.tsx'];
    const tailwindSource = tailwindEntry.tsx?.['LiveVideoPlayer.tsx'];

    expect(cssSource).toContain("import './player.css';");
    expect(tailwindSource).not.toContain("import './player.css';");
    expect(tailwindSource).toContain('export function LiveVideoPlayer');
    expect(tailwindSource).not.toContain('export function LiveVideoSkinTailwind');
  });
});
