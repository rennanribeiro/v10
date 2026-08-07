import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTransition } from '../../transition';
import { createMenu, type MenuApi } from '../create-menu';
import { createMenuTransition } from '../create-menu-transition';

function rect(width: number, height: number): DOMRect {
  return new DOMRect(0, 0, width, height);
}

function mockSize(element: HTMLElement, width: number, height: number): void {
  element.getBoundingClientRect = vi.fn(() => rect(width, height));
  Object.defineProperties(element, {
    scrollWidth: { configurable: true, get: () => width },
    scrollHeight: { configurable: true, get: () => height },
  });
}

function createCommittedMenu(): MenuApi {
  let menu!: MenuApi;
  menu = createMenu({
    transition: createTransition(),
    onOpenChange: (open) => menu.syncOpen(open),
    closeOnEscape: () => true,
    closeOnOutsideClick: () => true,
  });
  return menu;
}

function createControlledMenu(onOpenChange = vi.fn()): MenuApi {
  return createMenu({
    transition: createTransition(),
    onOpenChange,
    closeOnEscape: () => true,
    closeOnOutsideClick: () => true,
  });
}

async function frames(count = 2): Promise<void> {
  for (let index = 0; index < count; index++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

describe('createMenuTransition', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function setup(menu = createCommittedMenu()) {
    const container = document.createElement('div');
    const root = document.createElement('div');
    const child = document.createElement('div');
    const trigger = document.createElement('button');
    const item = document.createElement('button');
    root.append(trigger);
    child.append(item);
    container.append(root, child);
    document.body.append(container);
    mockSize(root, 180, 80);
    mockSize(child, 240, 120);
    const unregisterItem = menu.registerItem(item);
    const controller = createMenuTransition();
    controller.setContainerElement(container);
    controller.setRootPanelElement(root);
    const view = controller.registerView(menu);
    view.setTriggerElement(trigger);
    view.setPanelElement(child);
    cleanups.push(
      unregisterItem,
      () => menu.destroy(),
      () => controller.destroy()
    );
    return { container, root, child, trigger, item, menu, controller, view };
  }

  it('starts with one accessible root panel and measures both dimensions', () => {
    const { container, root, child, trigger } = setup();

    expect(root.getAttribute('data-view-state')).toBe('active');
    expect(root.hasAttribute('data-menu-root-view')).toBe(true);
    expect(root.hasAttribute('data-submenu')).toBe(false);
    expect(child.hasAttribute('data-submenu')).toBe(true);
    expect(trigger.hasAttribute('data-has-submenu')).toBe(true);
    expect(root.inert).toBe(false);
    expect(child.hidden).toBe(true);
    expect(child.inert).toBe(true);
    expect(child.getAttribute('aria-hidden')).toBe('true');
    expect(container.style.getPropertyValue('--media-menu-width')).toBe('180px');
    expect(container.style.getPropertyValue('--media-menu-height')).toBe('80px');
  });

  it('remeasures the active destination when its content size changes', () => {
    let resize: ResizeObserverCallback = () => {};
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    const { container, root } = setup();

    mockSize(root, 220, 110);
    resize([], {} as ResizeObserver);

    expect(container.style.getPropertyValue('--media-menu-width')).toBe('220px');
    expect(container.style.getPropertyValue('--media-menu-height')).toBe('110px');
  });

  it('keeps outgoing content live while a committed child enters', async () => {
    const { root, child, menu } = setup();

    menu.open();
    await Promise.resolve();

    expect(root.hidden).toBe(false);
    expect(root.getAttribute('data-view-state')).toBe('inactive');
    expect(root.hasAttribute('data-ending-style')).toBe(true);
    expect(child.getAttribute('data-view-state')).toBe('active');
    expect(child.hasAttribute('data-starting-style')).toBe(true);
    expect(child.getAttribute('data-direction')).toBe('forward');

    await frames();

    expect(root.hidden).toBe(true);
    expect(child.hasAttribute('data-starting-style')).toBe(false);
  });

  it('returns to the root and restores focus to the bound trigger', async () => {
    const { root, child, trigger, menu } = setup();
    const focus = vi.spyOn(trigger, 'focus');
    menu.open();
    await Promise.resolve();
    await frames();

    menu.close();
    await Promise.resolve();

    expect(root.getAttribute('data-direction')).toBe('back');
    expect(root.hasAttribute('data-starting-style')).toBe(true);
    expect(child.hasAttribute('data-ending-style')).toBe(true);
    await frames();
    await Promise.resolve();

    expect(child.hidden).toBe(true);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('does not navigate for a rejected controlled request', async () => {
    const request = vi.fn();
    const menu = createControlledMenu(request);
    const { root, child } = setup(menu);

    menu.open();

    expect(request).toHaveBeenCalledWith(true, { reason: 'click' });
    expect(menu.input.current.active).toBe(false);
    expect(root.getAttribute('data-view-state')).toBe('active');
    expect(child.hidden).toBe(true);

    menu.syncOpen(true);
    await Promise.resolve();

    expect(child.getAttribute('data-view-state')).toBe('active');
  });

  it('cancels stale forward work when navigation reverses rapidly', async () => {
    const { root, child, menu } = setup();

    menu.open();
    menu.close();
    await frames(3);

    expect(root.hidden).toBe(false);
    expect(root.getAttribute('data-view-state')).toBe('active');
    expect(child.hidden).toBe(true);
  });

  it('shows the most recently opened controlled child and falls back when it closes', async () => {
    const firstMenu = createControlledMenu();
    const { container, child: firstPanel, controller } = setup(firstMenu);
    const secondMenu = createControlledMenu();
    const secondPanel = document.createElement('div');
    const secondTrigger = document.createElement('button');
    container.append(secondPanel);
    mockSize(secondPanel, 260, 140);
    const secondView = controller.registerView(secondMenu);
    secondView.setTriggerElement(secondTrigger);
    secondView.setPanelElement(secondPanel);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    cleanups.push(
      () => secondView.destroy(),
      () => secondMenu.destroy()
    );

    firstMenu.syncOpen(true);
    secondMenu.syncOpen(true);
    await Promise.resolve();

    expect(controller.activeView).toBe(secondView);
    expect(secondPanel.getAttribute('data-view-state')).toBe('active');
    expect(firstPanel.getAttribute('data-view-state')).toBe('inactive');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Multiple controlled child menus'));

    secondMenu.syncOpen(false);
    await Promise.resolve();

    expect(controller.activeView?.menu).toBe(firstMenu);
    expect(firstPanel.getAttribute('data-view-state')).toBe('active');
    expect(secondPanel.hidden).toBe(true);
  });

  it('warns when the same child root is registered twice', () => {
    const { menu, controller, view } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(controller.registerView(menu)).toBe(view);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('only be registered once'));
  });
});
