import { defineMediaCapability } from '../capability';
import type { MediaPauseCapability } from '../types';

/** Suspending playback. A media that plays through once, unstoppably, composes `playback` without this. */
export const pauseCapability = defineMediaCapability<MediaPauseCapability>()({
  name: 'pause',
  events: ['pause', 'ended'],
  props: {
    paused: { fallback: true, readonly: true },
    ended: { fallback: false, readonly: true },
  },
  methods: {
    pause: { fallback: () => undefined },
  },
});
