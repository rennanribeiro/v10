import { defineMediaCapability } from '../capability';
import { EMPTY_TIME_RANGES } from '../constants';
import type { MediaPlayedCapability } from '../types';

/** Reporting which parts of the timeline the viewer has actually watched. */
export const playedCapability = defineMediaCapability<MediaPlayedCapability>()({
  name: 'played',
  events: [],
  props: {
    played: { fallback: EMPTY_TIME_RANGES, readonly: true },
  },
});
