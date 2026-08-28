import { defineMediaCapability } from '../capability';
import type { MediaErrorCapability } from '../types';

/** Reporting a fatal playback failure. */
export const errorCapability = defineMediaCapability<MediaErrorCapability>()({
  name: 'error',
  events: ['error'],
  props: {
    error: { fallback: null, readonly: true },
  },
});
