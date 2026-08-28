import { defineMediaCapability } from '../capability';
import type { MediaLiveCapability } from '../types';

/** Describing the live window a stream exposes. */
export const liveCapability = defineMediaCapability<MediaLiveCapability>()({
  name: 'live',
  events: ['targetlivewindowchange'],
  props: {
    liveEdgeStart: { fallback: Number.NaN, readonly: true },
    targetLiveWindow: { fallback: Number.NaN, readonly: true },
  },
});
