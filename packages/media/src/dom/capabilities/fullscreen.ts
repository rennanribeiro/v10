import { defineMediaCapability } from '../../core/capability';
import type { MediaFullscreenControlCapability } from '../../core/types';
import type { MediaHostBase } from '../media-host/base';
import { getMediaTarget } from '../utils';

/**
 * Taking over the screen.
 *
 * `requestFullscreen` is the media's own, so it forwards. Leaving is the document's, so no media holds it and the
 * fallback answers — unless a media that manages its own presentation implements `exitFullscreen`, in which case that
 * wins, which is the precedence the player's presentation helpers expect.
 *
 * Whether fullscreen is currently active is not part of this: it is derived from the document with the media as its
 * subject, so a host reports it.
 */
export const fullscreenCapability = defineMediaCapability<MediaFullscreenControlCapability>()({
  name: 'fullscreen',
  events: [],
  props: {},
  methods: {
    requestFullscreen: {
      fallback: () => Promise.reject(new DOMException('No media is attached.', 'NotSupportedError')),
    },
    exitFullscreen: {
      fallback(this: MediaHostBase) {
        if (!getMediaTarget(this))
          return Promise.reject(new DOMException('No media is attached.', 'NotSupportedError'));

        return globalThis.document?.exitFullscreen();
      },
    },
  },
});
