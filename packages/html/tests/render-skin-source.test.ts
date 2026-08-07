import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderSkinSource } from '../scripts/render-skin-source';

const canonicalRoot = resolve(import.meta.dirname, '../../skins/canonical');

describe('renderSkinSource', () => {
  it('renders canonical composition to static light-DOM custom elements', async () => {
    const html = await renderSkinSource(resolve(canonicalRoot, 'skins/default/video-controls.skin.tsx'));

    expect(html).toContain('<media-controls');
    expect(html).toContain('<media-play-button');
    expect(html).toContain('<media-seek-button');
    expect(html).toContain('seconds="-10"');
    expect(html).toContain('seconds="10"');
    expect(html).toContain('thumb-alignment="edge"');
    expect(html).not.toContain('thumbAlignment');
    expect(html).not.toMatch(/class="[^"]*,/);
    expect(html).not.toContain('commandfor=');
    expect(html).not.toMatch(/ id=/);
  });
});
