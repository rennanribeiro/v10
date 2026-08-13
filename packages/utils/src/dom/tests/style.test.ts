import { afterEach, describe, expect, it, vi } from 'vitest';

import { addAnchorName, getAnchorNames, resolveCSSLength } from '../style';

describe('getAnchorNames', () => {
  it('returns normalized anchor names', () => {
    const el = document.createElement('button');

    el.style.setProperty('anchor-name', '--menu,  --tooltip');

    expect(getAnchorNames(el)).toEqual(['--menu', '--tooltip']);
  });

  it('returns no names for none', () => {
    const el = document.createElement('button');

    el.style.setProperty('anchor-name', 'none');

    expect(getAnchorNames(el)).toEqual([]);
  });
});

describe('addAnchorName', () => {
  it('composes anchor names and cleans up only its own name', () => {
    const el = document.createElement('button');
    const cleanupMenu = addAnchorName(el, 'settings-menu');
    const cleanupTooltip = addAnchorName(el, 'settings-tooltip');

    expect(getAnchorNames(el)).toEqual(['--settings-menu', '--settings-tooltip']);

    cleanupMenu();
    expect(getAnchorNames(el)).toEqual(['--settings-tooltip']);

    cleanupTooltip();
    expect(getAnchorNames(el)).toEqual([]);
  });

  it('preserves a pre-existing anchor name on cleanup', () => {
    const el = document.createElement('button');

    el.style.setProperty('anchor-name', '--settings-menu');

    const cleanup = addAnchorName(el, 'settings-menu');

    cleanup();

    expect(getAnchorNames(el)).toEqual(['--settings-menu']);
  });
});

describe('resolveCSSLength', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockComputedLength(el: Element, insetInlineStart: string, variables: Record<string, string> = {}) {
    const getPropertyValue = vi.fn((name: string) => variables[name] ?? '');

    vi.spyOn(globalThis, 'getComputedStyle').mockImplementation((target: Element) =>
      target === el
        ? ({ fontSize: '14px', getPropertyValue } as unknown as CSSStyleDeclaration)
        : ({ insetInlineStart } as CSSStyleDeclaration)
    );

    return getPropertyValue;
  }

  it('returns pixel and unitless values directly', () => {
    const el = document.createElement('div');

    expect(resolveCSSLength(el, '8px')).toBe(8);
    expect(resolveCSSLength(el, '-2.5px')).toBe(-2.5);
    expect(resolveCSSLength(el, '4')).toBe(4);
  });

  it.each([
    ['0.5rem', '8px', 8],
    ['-0.5rem', '-8px', -8],
    ['1em', '14px', 14],
    ['-1em', '-14px', -14],
    ['10vw', '24px', 24],
    ['calc(0.5 * 16px)', '8px', 8],
    ['calc(0px - 0.5rem)', '-8px', -8],
    ['calc(1px - 1px)', '0px', 0],
  ])('resolves %s from its computed inset', (value, inset, expected) => {
    const el = document.createElement('div');
    const appendSpy = vi.spyOn(document.body, 'append');

    mockComputedLength(el, inset);

    expect(resolveCSSLength(el, value)).toBe(expected);
    expect(appendSpy).toHaveBeenCalledOnce();
    expect((appendSpy.mock.calls[0]![0] as Element).isConnected).toBe(false);
  });

  it('copies computed custom properties referenced by the length', () => {
    const el = document.createElement('div');
    const appendSpy = vi.spyOn(document.body, 'append');
    const getPropertyValue = mockComputedLength(el, '-8px', {
      '--offset': 'calc(calc(16px / 4) * -2)',
    });

    expect(resolveCSSLength(el, 'var(--offset)')).toBe(-8);
    expect(getPropertyValue).toHaveBeenCalledExactlyOnceWith('--offset');
    expect((appendSpy.mock.calls[0]![0] as HTMLElement).style.getPropertyValue('--offset')).toBe(
      'calc(calc(16px / 4) * -2)'
    );
  });

  it('returns zero for empty, invalid, and unresolved values', () => {
    const el = document.createElement('div');

    expect(resolveCSSLength(el, '')).toBe(0);
    expect(resolveCSSLength(el, 'not-a-length')).toBe(0);

    mockComputedLength(el, 'auto');
    expect(resolveCSSLength(el, 'var(--missing-size)')).toBe(0);
  });
});
