import { defineMediaCapability } from '../capability';
import type { MediaSeekCapability } from '../types';

/** Moving through a timeline. Media with no addressable position (a live-only embed, an animated image) skips it. */
export const seekCapability = defineMediaCapability<MediaSeekCapability>()({
  name: 'seek',
  events: ['timeupdate', 'durationchange', 'seeking', 'seeked', 'loadedmetadata'],
  props: {
    currentTime: { fallback: 0 },
    loop: { fallback: false },
    duration: { fallback: Number.NaN, readonly: true },
    seeking: { fallback: false, readonly: true },
  },
});
