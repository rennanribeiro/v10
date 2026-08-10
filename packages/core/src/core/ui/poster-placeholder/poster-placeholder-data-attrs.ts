import type { StateAttrMap } from '../types';
import type { PosterPlaceholderState } from './poster-placeholder-core';

export const PosterPlaceholderDataAttrs = {
  visible: 'data-visible',
} as const satisfies StateAttrMap<PosterPlaceholderState>;
