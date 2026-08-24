import type { StateAttrMap } from '../types';
import type { ControlsState } from './core';

export const ControlsDataAttrs = {
  /** Name of the grouped popup currently open within the player. */
  activePopup: 'data-active-popup',
  /** Present when controls are visible. */
  visible: 'data-visible',
  /** Present when the user has recently interacted. */
  userActive: 'data-user-active',
} as const satisfies StateAttrMap<ControlsState>;
