import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMenuRootViewAttrs, syncMenuHeight } from '../menu-height';

afterEach(() => vi.restoreAllMocks());

function setHeight(element: HTMLElement, height: number): void {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: height });
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ height } as DOMRect);
}

describe('menu height', () => {
  it('marks the root view and measures it by default', () => {
    const content = document.createElement('div');
    const root = document.createElement('div');
    Object.entries(getMenuRootViewAttrs()).forEach(([name, value]) => root.setAttribute(name, value));
    content.append(root);
    setHeight(root, 120);

    syncMenuHeight(content);

    expect(root.hidden).toBe(false);
    expect(root.getAttribute('data-menu-view-state')).toBe('active');
    expect(content.style.getPropertyValue('--media-menu-height')).toBe('120px');
  });

  it('hides the root view and measures the active submenu', () => {
    const content = document.createElement('div');
    const root = document.createElement('div');
    const submenu = document.createElement('div');
    root.setAttribute('data-menu-root-view', '');
    root.setAttribute('data-menu-view', '');
    submenu.setAttribute('data-menu-view', '');
    content.append(root, submenu);
    setHeight(submenu, 240);

    syncMenuHeight(content);

    expect(root.hidden).toBe(true);
    expect(root.getAttribute('data-menu-view-state')).toBe('inactive');
    expect(content.style.getPropertyValue('--media-menu-height')).toBe('240px');
  });
});
