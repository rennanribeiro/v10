import type { StateAttrMap } from '../types';
import type { SeekButtonState } from './core';

export const SeekButtonDataAttrs = {
  /** Present when a seek is in progress. */
  seeking: 'data-seeking',
  /** Indicates the seek direction: `"forward"` or `"backward"`. */
  direction: 'data-direction',
  /** Present when the button is non-interactive (mirrors `aria-disabled`). */
  disabled: 'data-disabled',
} as const satisfies StateAttrMap<SeekButtonState>;
