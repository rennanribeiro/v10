import { defineMediaCapability } from '../../core/capability';
import type { MediaAutoplayCapability } from '../../core/types';

/** Starting playback without a gesture. */
export const autoplayCapability = defineMediaCapability<MediaAutoplayCapability>()({
  name: 'autoplay',
  events: [],
  attributes: {
    autoplay: { type: Boolean },
  },
  props: {
    autoplay: { fallback: false },
  },
});
