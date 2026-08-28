import { defineMediaCapability } from '../capability';
import { type MediaStreamTypeCapability, MediaStreamTypes } from '../types';

/**
 * Whether the media is on-demand, live, or not yet known.
 *
 * Detecting media report their own value, but a consumer can override detection, so a write is remembered rather than
 * left to a media that may not hold it. No media element announces the change, so the capability names the event to
 * announce on its behalf.
 */
export const streamTypeCapability = defineMediaCapability<MediaStreamTypeCapability>()({
  name: 'stream-type',
  events: ['streamtypechange'],
  attributes: {
    streamType: { type: String, attribute: 'stream-type', empty: 'unknown' },
  },
  props: {
    streamType: {
      fallback: MediaStreamTypes.UNKNOWN,
      remembered: true,
      changeEvent: 'streamtypechange',
    },
  },
});
