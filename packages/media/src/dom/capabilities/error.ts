import { defineMediaCapability } from '../../core/capability';
import type { MediaErrorCapability } from '../../core/types';

/** Reporting a fatal playback failure. */
export const errorCapability = defineMediaCapability<MediaErrorCapability>()({
  name: 'error',
  events: ['error'],
  props: {
    error: { fallback: null, readonly: true },
  },
});
