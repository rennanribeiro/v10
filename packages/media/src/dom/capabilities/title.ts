import { defineMediaCapability } from '../../core/capability';
import type { MediaTitleCapability } from '../../core/types';

/** An author-supplied title, distinct from the media-owned `contentData.title`. */
export const titleCapability = defineMediaCapability<MediaTitleCapability>()({
  name: 'title',
  events: [],
  props: {
    title: { fallback: '' },
  },
});
