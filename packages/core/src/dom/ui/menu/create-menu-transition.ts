import { createState, type State } from '@videojs/store';
import { resolveCSSLength, withTemporaryStyles } from '@videojs/utils/dom';
import { MenuCSSVars } from '../../../core/ui/menu/menu-css-vars';
import type { MenuTransitionDirection } from '../../../core/ui/menu/menu-transition';
import { PopoverCSSVars } from '../../../core/ui/popover/popover-css-vars';
import type { MenuApi } from './create-menu';

export interface MenuTransitionSize {
  width: number | null;
  height: number | null;
}

const DEFAULT_MIN_WIDTH = 160;

const measureStyles = {
  position: 'absolute',
  top: '0px',
  right: 'auto',
  bottom: 'auto',
  left: '0px',
  width: 'max-content',
  height: 'auto',
  'min-width': `${DEFAULT_MIN_WIDTH}px`,
  'max-width': 'none',
};

/** Measures a rendered panel without mutating it. */
export function getMenuTransitionSize(
  container: HTMLElement,
  panel: HTMLElement,
  minWidth = DEFAULT_MIN_WIDTH
): MenuTransitionSize {
  return withTemporaryStyles(panel, { ...measureStyles, 'min-width': `${minWidth}px` }, () => {
    const availableValue =
      container.style.getPropertyValue(MenuCSSVars.availableWidth) ||
      container.style.getPropertyValue(PopoverCSSVars.availableWidth) ||
      getComputedStyle(container).getPropertyValue(MenuCSSVars.availableWidth) ||
      getComputedStyle(container).getPropertyValue(PopoverCSSVars.availableWidth);
    const resolvedAvailableWidth = resolveCSSLength(container, availableValue);
    const availableWidth =
      Number.isFinite(resolvedAvailableWidth) && resolvedAvailableWidth > 0 ? resolvedAvailableWidth : null;
    const rect = panel.getBoundingClientRect();
    const naturalWidth = Math.ceil(Math.max(minWidth, rect.width, panel.scrollWidth));

    return {
      width: Math.ceil(availableWidth ? Math.min(naturalWidth, Math.max(minWidth, availableWidth)) : naturalWidth),
      height: Math.ceil(Math.max(rect.height, panel.scrollHeight)),
    };
  });
}

export interface MenuTransitionState {
  activeMenu: MenuApi | null;
  direction: MenuTransitionDirection;
}

export interface MenuTransitionApi {
  readonly state: State<MenuTransitionState>;
  readonly size: State<MenuTransitionSize>;
  setSize(size: MenuTransitionSize): void;
  registerView(menu: MenuApi): () => void;
  reset(): void;
  destroy(): void;
}

/** Selects the active child Menu while platform adapters own rendered DOM output. */
export function createMenuTransition(): MenuTransitionApi {
  const state = createState<MenuTransitionState>({ activeMenu: null, direction: 'back' });
  const size = createState<MenuTransitionSize>({ width: null, height: null });
  const views = new Map<MenuApi, () => void>();

  function activate(menu: MenuApi): void {
    const previous = state.current.activeMenu;
    if (previous === menu) return;
    previous?.close('imperative-action');
    state.replace({ activeMenu: menu, direction: 'forward' });
  }

  function sync(menu: MenuApi): void {
    const { active, status } = menu.input.current;
    if (active && status !== 'ending') activate(menu);
    else if (state.current.activeMenu === menu) state.replace({ activeMenu: null, direction: 'back' });
  }

  function registerView(menu: MenuApi): () => void {
    if (views.has(menu)) {
      if (__DEV__) console.warn('[vjs-menu-transition] A child Menu root can only be registered once.');
      return () => {};
    }

    const unsubscribe = menu.input.subscribe(() => sync(menu));
    views.set(menu, unsubscribe);
    sync(menu);

    return () => {
      if (views.get(menu) !== unsubscribe) return;
      views.delete(menu);
      unsubscribe();
      if (state.current.activeMenu === menu) state.replace({ activeMenu: null, direction: 'back' });
    };
  }

  function reset(): void {
    for (const menu of views.keys()) {
      if (menu.input.current.active) menu.close('imperative-action');
    }
    state.replace({ activeMenu: null, direction: 'back' });
  }

  return {
    state,
    size,
    setSize(nextSize) {
      size.replace(nextSize);
    },
    registerView,
    reset,
    destroy() {
      for (const unsubscribe of views.values()) unsubscribe();
      views.clear();
      state.replace({ activeMenu: null, direction: 'back' });
    },
  };
}
