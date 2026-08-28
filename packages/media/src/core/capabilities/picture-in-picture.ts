import { defineMediaCapability } from '../capability';
import type { MediaDisablePictureInPictureCapability } from '../types';

/**
 * The part of picture-in-picture the media itself owns.
 *
 * Composing this is what marks a media as one picture-in-picture applies to at all; a host supplies entering, leaving,
 * and the current mode, which run against the presentation environment rather than the media.
 */
export const pictureInPictureCapability = defineMediaCapability<MediaDisablePictureInPictureCapability>()({
  name: 'picture-in-picture',
  events: ['enterpictureinpicture', 'leavepictureinpicture'],
  attributes: {
    disablePictureInPicture: { type: Boolean },
  },
  props: {
    disablePictureInPicture: { fallback: false },
  },
});
