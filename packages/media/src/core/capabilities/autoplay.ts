import { defineMediaCapability } from '../capability';
import type { MediaAutoplayCapability } from '../types';

/** Starting playback without a gesture. */
export const autoplayCapability = defineMediaCapability<MediaAutoplayCapability>()({
  name: 'autoplay',
  events: [],
  props: {
    autoplay: { fallback: false },
  },
});
