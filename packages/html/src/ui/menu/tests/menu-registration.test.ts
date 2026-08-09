import { describe, expect, it } from 'vitest';

describe('Menu registration boundaries', () => {
  it('defines transition elements only from their explicit entry', async () => {
    await import('../../../define/ui/menu');

    expect(customElements.get('media-menu')).toBeDefined();
    expect(customElements.get('media-menu-transition-root')).toBeUndefined();
    expect(customElements.get('media-menu-transition-view')).toBeUndefined();

    await import('../../../define/ui/menu-transition');

    expect(customElements.get('media-menu-transition-root')).toBeDefined();
    expect(customElements.get('media-menu-transition-view')).toBeDefined();
  });
});
