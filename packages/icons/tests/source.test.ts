import { describe, expect, it } from 'vitest';
import { createHtmlIconsSource, createReactIconsSource } from '../scripts/source';

describe('createReactIconsSource', () => {
  it('generates only the requested named icon components', async () => {
    const source = await createReactIconsSource(['PlayIcon', 'PauseIcon']);

    expect(source).toContain('export function PlayIcon');
    expect(source).toContain('export function PauseIcon');
    expect(source).not.toContain('RestartIcon');
    expect(source).not.toContain('export default');
  });
});

describe('createHtmlIconsSource', () => {
  it('generates an exact local icon registration module', async () => {
    const source = await createHtmlIconsSource(['SpinnerIcon']);

    expect(source).toContain("import '@videojs/html/icons/element'");
    expect(source).toContain("iconElement?.register('default', icons)");
    expect(source).toContain("'spinner': `<svg");
    expect(source).not.toContain("'play':");
    expect(source).not.toContain("'volume-high':");
  });
});
