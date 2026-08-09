import type { StateAttrMap } from '../types';
import type { MenuInput } from './menu-core';

export type MenuTransitionDirection = 'forward' | 'back';
export type MenuViewState = 'active' | 'inactive';

/** Presentation state for one live-DOM panel participating in a Menu transition. */
export interface MenuTransitionPanelState {
  visible: boolean;
  interactive: boolean;
  viewState: MenuViewState;
  direction: MenuTransitionDirection;
}

/** Stable structural and state attributes used by menu-bound transitions. */
export const MenuTransitionDataAttrs = {
  /** Present on every panel participating in a menu transition. */
  view: 'data-menu-view',
  /** Present on the generated root menu panel. */
  rootView: 'data-menu-root-view',
  /** Present on root-menu items that open a child menu panel. */
  hasSubmenu: 'data-has-submenu',
  /** Whether a panel is the active destination. */
  viewState: 'data-view-state',
  /** Navigation direction for the current panel transition. */
  direction: 'data-direction',
} as const;

/** Maps Menu transition presentation state to stable styling attributes. */
export const MenuTransitionStateDataAttrs = {
  viewState: MenuTransitionDataAttrs.viewState,
  direction: MenuTransitionDataAttrs.direction,
} as const satisfies StateAttrMap<MenuTransitionPanelState>;

/** Derives the permanently mounted root panel's presentation. */
export function getMenuTransitionRootState(
  childActive: boolean,
  direction: MenuTransitionDirection
): MenuTransitionPanelState {
  return {
    visible: true,
    interactive: !childActive,
    viewState: childActive ? 'inactive' : 'active',
    direction,
  };
}

/** Derives a destination panel's presentation from its bound Menu lifecycle. */
export function getMenuTransitionViewState(
  input: MenuInput,
  selected: boolean,
  direction: MenuTransitionDirection
): MenuTransitionPanelState {
  const exiting = input.active && input.status === 'ending';
  const interactive = selected && input.active && !exiting;

  return {
    visible: selected || exiting,
    interactive,
    viewState: interactive ? 'active' : 'inactive',
    direction,
  };
}

/** Returns the attributes a platform adapter should apply to a transition panel. */
export function getMenuTransitionPanelAttrs(state: MenuTransitionPanelState) {
  return {
    hidden: state.visible ? undefined : true,
    inert: state.interactive ? undefined : true,
    'aria-hidden': state.interactive ? undefined : ('true' as const),
  };
}
