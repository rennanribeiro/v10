import { defineMediaCapability } from '../capability';
import type { MediaPlaybackRateCapability } from '../types';

/** Playing faster or slower than real time. */
export const playbackRateCapability = defineMediaCapability<MediaPlaybackRateCapability>()({
  name: 'playback-rate',
  events: ['ratechange'],
  props: {
    playbackRate: { fallback: 1 },
    defaultPlaybackRate: { fallback: 1 },
  },
});
