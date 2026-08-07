import { describe, expect, it } from 'vitest';
import { compileVanillaStyles } from '../scripts/compile-styles';

const tailwindSource = `
@import "tailwindcss";
@import "./base.css";
@import "./themes/default.css";
@source "../**/*.skin.tsx";

@theme inline {
  --spacing-media-control: var(--media-control-size);
}
`;

describe('compileVanillaStyles', () => {
  it('compiles only supplied utility candidates without Tailwind imports', async () => {
    const css = await compileVanillaStyles(tailwindSource, [
      `export const button = 'grid size-media-control hover:opacity-50';`,
    ]);

    expect(css).toContain('.grid');
    expect(css).toContain('.size-media-control');
    expect(css).toContain('.hover\\:opacity-50:hover');
    expect(css).not.toContain('.flex');
    expect(css).not.toContain('@import "tailwindcss"');
  });
});
