import { defineRenderTarget } from 'vjsc/components';

import type { SkinComponentMeta } from '../../meta';
import styles from '../../styles/sliders/slider.styles';

/** Shared generated slider track host. */
export const SliderTrack = defineRenderTarget('SliderTrack', styles.track);

/** Shared generated slider fill host. */
export const SliderFill = defineRenderTarget('SliderFill', styles.fill);

/** Shared generated slider buffer host. */
export const SliderBuffer = defineRenderTarget('SliderBuffer', styles.buffer);

/** Shared generated slider thumb host. */
export const SliderThumb = defineRenderTarget('SliderThumb', styles.thumb);

export const meta = {
  name: 'slider',
  type: 'component',
  title: 'Slider Parts',
  description: 'Shared styled hosts for generated slider tracks, progress layers, and thumbs.',
} as const satisfies SkinComponentMeta;
