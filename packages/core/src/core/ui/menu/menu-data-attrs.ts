import { TransitionDataAttrs } from '../transition';
import type { StateAttrMap } from '../types';
import type { MenuState } from './menu-core';

/** Data attributes set on the menu Content element and inherited by all children. */
export const MenuDataAttrs = {
  /** Present when the menu is open. */
  open: 'data-open',
  /** Rendered positioning side after collision handling. */
  side: 'data-side',
  /** Popover positioning alignment. */
  align: 'data-align',
  ...TransitionDataAttrs,
} as const satisfies StateAttrMap<MenuState>;

/** Stable DOM attributes used by menu-bound view transitions. */
export const MenuTransitionDataAttrs = {
  /** Present on every panel participating in a menu transition. */
  view: 'data-menu-view',
  /** Present on the root menu panel. */
  rootView: 'data-menu-root-view',
  /** Present on child menu panels. */
  submenu: 'data-submenu',
  /** Present on root-menu items that open a child menu panel. */
  hasSubmenu: 'data-has-submenu',
  /** Whether a panel is the active destination. */
  viewState: 'data-view-state',
  /** Navigation direction for the current panel transition. */
  direction: 'data-direction',
} as const;
