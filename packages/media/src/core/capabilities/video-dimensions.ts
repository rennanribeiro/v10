import { defineMediaCapability } from '../capability';
import type { MediaVideoDimensionsCapability } from '../types';

/** Reporting the intrinsic size of the decoded video. */
export const videoDimensionsCapability = defineMediaCapability<MediaVideoDimensionsCapability>()({
  name: 'video-dimensions',
  events: ['resize'],
  props: {
    videoWidth: { fallback: 0, readonly: true },
    videoHeight: { fallback: 0, readonly: true },
  },
});
