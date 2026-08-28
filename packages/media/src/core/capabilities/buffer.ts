import { defineMediaCapability } from '../capability';
import { EMPTY_TIME_RANGES } from '../constants';
import type { MediaBufferCapability } from '../types';

/** Reporting which parts of the timeline are downloaded and reachable. */
export const bufferCapability = defineMediaCapability<MediaBufferCapability>()({
  name: 'buffer',
  events: ['progress'],
  props: {
    buffered: { fallback: EMPTY_TIME_RANGES, readonly: true },
    seekable: { fallback: EMPTY_TIME_RANGES, readonly: true },
  },
});
