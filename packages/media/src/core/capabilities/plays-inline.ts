import { defineMediaCapability } from '../capability';
import type { MediaPlaysInlineCapability } from '../types';

/** Playing in place rather than taking over the screen, which small-screen browsers otherwise do. */
export const playsInlineCapability = defineMediaCapability<MediaPlaysInlineCapability>()({
  name: 'plays-inline',
  events: [],
  attributes: {
    playsInline: { type: Boolean },
  },
  props: {
    playsInline: { fallback: false },
  },
});
