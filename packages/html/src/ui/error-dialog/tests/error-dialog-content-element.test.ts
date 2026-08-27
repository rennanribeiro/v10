import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { ErrorDialogContentElement } from '../error-dialog-content-element';

let tagCounter = 0;

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

function createContent(clientHeight: number, scrollHeight: number): ErrorDialogContentElement {
  const tagName = `test-error-dialog-content-${tagCounter++}`;

  customElements.define(tagName, class extends ErrorDialogContentElement {});

  const element = document.createElement(tagName);
  if (!(element instanceof ErrorDialogContentElement)) throw new Error('Expected error dialog content element.');

  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: clientHeight },
    scrollHeight: { configurable: true, value: scrollHeight },
  });

  return element;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  ResizeObserverStub.instances.length = 0;
  MutationObserverStub.instances.length = 0;
});

describe('ErrorDialogContentElement', () => {
  it('stays out of the tab order when its content fits', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('MutationObserver', MutationObserverStub);

    const content = createContent(100, 100);

    document.body.append(content);

    expect(content.tabIndex).toBe(-1);
  });

  it('enters the tab order when its content overflows', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('MutationObserver', MutationObserverStub);

    const content = createContent(100, 200);

    document.body.append(content);

    expect(content.tabIndex).toBe(0);
  });

  it('updates focusability and stops observing on disconnect', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('MutationObserver', MutationObserverStub);

    const content = createContent(100, 100);

    document.body.append(content);

    Object.defineProperty(content, 'scrollHeight', { configurable: true, value: 200 });
    ResizeObserverStub.instances[0]!.callback([], ResizeObserverStub.instances[0]!);

    expect(content.tabIndex).toBe(0);

    content.remove();

    expect(ResizeObserverStub.instances[0]!.disconnect).toHaveBeenCalledOnce();
    expect(MutationObserverStub.instances[0]!.disconnect).toHaveBeenCalledOnce();
  });
});
