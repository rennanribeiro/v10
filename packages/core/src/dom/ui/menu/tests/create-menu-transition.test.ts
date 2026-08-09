import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getMenuTransitionPanelAttrs,
  getMenuTransitionRootState,
  getMenuTransitionViewState,
} from '../../../../core/ui/menu/menu-transition';
import { createTransition } from '../../transition';
import { createMenu, type MenuApi } from '../create-menu';
import { createMenuTransition, getMenuTransitionSize } from '../create-menu-transition';

function rect(width: number, height: number): DOMRect {
  return new DOMRect(0, 0, width, height);
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

describe('createMenuTransition', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  function setup(menu = createCommittedMenu()) {
    const root = document.createElement('div');
    const child = document.createElement('div');
    const trigger = document.createElement('button');
    const item = document.createElement('button');
    root.append(trigger);
    child.append(item);
    document.body.append(root, child);
    const unregisterItem = menu.registerItem(item);
    const controller = createMenuTransition();
    const unregisterView = controller.registerView(menu);
    cleanups.push(
      unregisterItem,
      unregisterView,
      () => menu.destroy(),
      () => controller.destroy()
    );
    return { root, child, trigger, item, menu, controller };
  }

  it('publishes initial selection without mutating platform elements', () => {
    const { root, child, trigger, controller } = setup();

    expect(controller.state.current).toEqual({ activeMenu: null, direction: 'back' });
    expect(root.attributes).toHaveLength(0);
    expect(child.attributes).toHaveLength(0);
    expect(trigger.attributes).toHaveLength(0);
  });

  it('measures a rendered panel without changing its DOM', () => {
    const container = document.createElement('div');
    const panel = document.createElement('div');
    container.style.setProperty('--media-menu-available-width', '200px');
    panel.getBoundingClientRect = vi.fn(() => {
      expect(panel.style.getPropertyValue('max-width')).toBe('var(--media-menu-available-width, none)');
      return rect(200, 120);
    });
    Object.defineProperties(panel, {
      scrollWidth: { configurable: true, get: () => 240 },
      scrollHeight: { configurable: true, get: () => 120 },
    });
    container.append(panel);
    document.body.append(container);
    const before = panel.getAttribute('style');

    expect(getMenuTransitionSize(panel)).toEqual({ width: 200, height: 120 });
    expect(panel.getAttribute('style')).toBe(before);
    expect(panel.hidden).toBe(false);
  });

  it('publishes size supplied by a platform adapter', () => {
    const { controller } = setup();

    controller.setSize({ width: 220, height: 110 });

    expect(controller.size.current).toEqual({ width: 220, height: 110 });
  });

  it('selects a child only after its Menu commits open state', async () => {
    const { controller, menu } = setup();

    menu.open();
    await Promise.resolve();

    expect(controller.state.current).toEqual({ activeMenu: menu, direction: 'forward' });
  });

  it('returns selection to the root when the bound Menu begins closing', async () => {
    const { controller, menu } = setup();
    menu.open();
    await Promise.resolve();

    menu.close();
    await Promise.resolve();

    expect(controller.state.current).toEqual({ activeMenu: null, direction: 'back' });
    expect(menu.input.current).toMatchObject({ active: true, status: 'ending' });
  });

  it('does not navigate for a rejected controlled request', async () => {
    const request = vi.fn();
    const menu = createControlledMenu(request);
    const { controller } = setup(menu);

    menu.open();

    expect(request).toHaveBeenCalledWith(true, { reason: 'click' });
    expect(menu.input.current.active).toBe(false);
    expect(controller.state.current.activeMenu).toBeNull();

    menu.syncOpen(true);
    await Promise.resolve();

    expect(controller.state.current.activeMenu).toBe(menu);
  });

  it('handles rapid navigation without pending transition work', async () => {
    const { controller, menu } = setup();

    menu.open();
    menu.close();
    await Promise.resolve();

    expect(controller.state.current).toEqual({ activeMenu: null, direction: 'back' });
  });

  it('selects the latest child and requests the previous child close', async () => {
    const firstRequest = vi.fn();
    const firstMenu = createControlledMenu(firstRequest);
    const { controller } = setup(firstMenu);
    const secondMenu = createControlledMenu();
    const unregisterSecondView = controller.registerView(secondMenu);
    cleanups.push(unregisterSecondView, () => secondMenu.destroy());

    firstMenu.syncOpen(true);
    secondMenu.syncOpen(true);
    await Promise.resolve();

    expect(controller.state.current.activeMenu).toBe(secondMenu);
    expect(firstRequest).toHaveBeenLastCalledWith(false, { reason: 'imperative-action' });

    secondMenu.syncOpen(false);
    await Promise.resolve();

    expect(controller.state.current).toEqual({ activeMenu: null, direction: 'back' });
  });

  it('derives root and child presentation without owning Menu lifecycle', () => {
    const root = getMenuTransitionRootState(true, 'forward');
    const entering = getMenuTransitionViewState({ active: true, status: 'starting' }, true, 'forward');
    const exiting = getMenuTransitionViewState({ active: true, status: 'ending' }, false, 'back');
    const hidden = getMenuTransitionViewState({ active: false, status: 'idle' }, false, 'back');

    expect(root).toEqual({ visible: true, interactive: false, viewState: 'inactive', direction: 'forward' });
    expect(getMenuTransitionPanelAttrs(root)).toEqual({ hidden: undefined, inert: true, 'aria-hidden': 'true' });
    expect(entering).toEqual({ visible: true, interactive: true, viewState: 'active', direction: 'forward' });
    expect(exiting).toEqual({ visible: true, interactive: false, viewState: 'inactive', direction: 'back' });
    expect(hidden).toEqual({ visible: false, interactive: false, viewState: 'inactive', direction: 'back' });
  });

  it('warns when the same child root is registered twice', () => {
    const { menu, controller } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    controller.registerView(menu);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('only be registered once'));
  });
});
