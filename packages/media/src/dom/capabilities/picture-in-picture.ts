import { defineMediaCapability } from '../../core/capability';
import type { MediaPictureInPictureControlCapability } from '../../core/types';
import type { MediaHostBase } from '../media-host/base';
import { getMediaTarget } from '../utils';

/**
 * Playing in a floating window.
 *
 * `requestPictureInPicture` is the media's own, so it forwards. Leaving is the document's, so no media holds it and the
 * fallback answers — unless a media that manages its own presentation implements `exitPictureInPicture`, in which case
 * that wins.
 *
 * Whether picture-in-picture is currently active is not part of this: it is derived from the document with the media as
 * its subject, so a host reports it.
 */
export const pictureInPictureCapability = defineMediaCapability<MediaPictureInPictureControlCapability>()({
  name: 'picture-in-picture',
  events: ['enterpictureinpicture', 'leavepictureinpicture'],
  props: {
    disablePictureInPicture: { fallback: false },
  },
  methods: {
    requestPictureInPicture: {
      fallback: () => Promise.reject(new DOMException('No media is attached.', 'NotSupportedError')),
    },
    exitPictureInPicture: {
      fallback(this: MediaHostBase) {
        if (!getMediaTarget(this))
          return Promise.reject(new DOMException('No media is attached.', 'NotSupportedError'));

        return globalThis.document?.exitPictureInPicture();
      },
    },
  },
});
