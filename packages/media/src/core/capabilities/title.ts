import { defineMediaCapability } from '../capability';
import type { MediaTitleCapability } from '../types';

/** An author-supplied title, distinct from the media-owned `contentData.title`. */
export const titleCapability = defineMediaCapability<MediaTitleCapability>()({
  name: 'title',
  events: [],
  props: {
    title: { fallback: '' },
  },
});
