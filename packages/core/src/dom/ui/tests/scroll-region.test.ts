import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { hasScrollOverflow, observeScrollOverflow } from '../scroll-region';

class ResizeObserverStub implements ResizeObserver {
  static instances: ResizeObserverStub[] = [];
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  constructor(readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this);
  }
}

class MutationObserverStub implements MutationObserver {
  static instances: MutationObserverStub[] = [];
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();
  readonly takeRecords = vi.fn(() => []);

  constructor(readonly callback: MutationCallback) {
    MutationObserverStub.instances.push(this);
  }
}

function setScrollMetrics(element: HTMLElement, clientHeight: number, scrollHeight: number): void {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: clientHeight },
    scrollHeight: { configurable: true, value: scrollHeight },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  ResizeObserverStub.instances.length = 0;
  MutationObserverStub.instances.length = 0;
});

describe('hasScrollOverflow', () => {
  it('detects content beyond the visible box', () => {
    const element = document.createElement('div');

    setScrollMetrics(element, 100, 101);
    expect(hasScrollOverflow(element)).toBe(true);

    setScrollMetrics(element, 100, 100);
    expect(hasScrollOverflow(element)).toBe(false);
  });
});

describe('observeScrollOverflow', () => {
  it('reports overflow changes from resize and content mutations', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('MutationObserver', MutationObserverStub);

    const element = document.createElement('div');
    const child = document.createElement('p');

    element.append(child);
    setScrollMetrics(element, 100, 100);

    const onChange = vi.fn();
    const cleanup = observeScrollOverflow(element, onChange);

    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(ResizeObserverStub.instances[0]!.observe).toHaveBeenCalledWith(element);
    expect(ResizeObserverStub.instances[0]!.observe).toHaveBeenCalledWith(child);

    setScrollMetrics(element, 100, 200);
    ResizeObserverStub.instances[0]!.callback([], ResizeObserverStub.instances[0]!);
    expect(onChange).toHaveBeenLastCalledWith(true);

    setScrollMetrics(element, 100, 100);
    MutationObserverStub.instances[0]!.callback([], MutationObserverStub.instances[0]!);
    expect(onChange).toHaveBeenLastCalledWith(false);

    cleanup();
    expect(MutationObserverStub.instances[0]!.disconnect).toHaveBeenCalledOnce();
    expect(ResizeObserverStub.instances.at(-1)!.disconnect).toHaveBeenCalledOnce();
  });

  it('does not notify when the overflow state is unchanged', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('MutationObserver', MutationObserverStub);

    const element = document.createElement('div');

    setScrollMetrics(element, 100, 100);

    const onChange = vi.fn();

    observeScrollOverflow(element, onChange);
    ResizeObserverStub.instances[0]!.callback([], ResizeObserverStub.instances[0]!);

    expect(onChange).toHaveBeenCalledOnce();
  });
});
