import { defineMediaCapability } from '../capability';
import type { MediaControlsCapability } from '../types';

/** The media's own native controls. */
export const controlsCapability = defineMediaCapability<MediaControlsCapability>()({
  name: 'controls',
  events: [],
  reflects: {
    controls: { type: Boolean },
  },
  props: {
    controls: { fallback: false },
  },
});
