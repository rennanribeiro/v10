import { listen } from '@videojs/utils/dom';

import { definePlayerFeature } from '../../feature';
import { isFullscreen } from '../../presentation/fullscreen';
import { createScreenOrientationLock, type ScreenOrientationLockType } from '../../presentation/orientation';

// Re-exported because it is now part of a public surface: the resolved value
// appears on the store, and `orientation-lock` is a provider attribute.
export type { ScreenOrientationLockType };

/** Preserves the behaviour of the feature's former baked-in default. */
const LIBRARY_DEFAULT: ScreenOrientationLockType = 'landscape';

const USER_ORIENTATION_LOCK = Symbol('vjs.orientationLock.user');

interface WebKitPresentationMedia extends HTMLMediaElement {
  webkitPresentationMode?: string;
}

export interface OrientationLockSource {
  [tier: symbol]: ScreenOrientationLockType | null | undefined;
  /**
   * Screen orientation to lock to while fullscreen is active.
   *
   * Written through as-is with no membership check, matching how media-provided
   * enums already behave. So this can hold a non-enum string at runtime, which
   * is the same compile-time-only guarantee `MediaStreamType` has. The platform
   * rejects a bad value when the lock is requested — silently, since that
   * rejection is discarded.
   */
  setOrientationLock(value: ScreenOrientationLockType | null | undefined): void;
}

export interface OrientationLockDerived {
  orientationLock: ScreenOrientationLockType;
}

export interface OrientationLockProviderProps {
  orientationLock?: ScreenOrientationLockType | null | undefined;
}

/**
 * Locks screen orientation while the player is fullscreen.
 *
 * Declares **one** provider prop, not two, and this is useful news about the
 * machinery rather than a special case: the `default*` tier means "use this
 * unless the media says otherwise", and nothing in a video donates an
 * orientation preference. A `defaultOrientationLock` would just be a second
 * developer-supplied value with lower precedence than the first. Tiers are the
 * feature's private business — "two entries per field" is a fact about content
 * metadata, not about provider props.
 */
export const orientationLockFeature = definePlayerFeature<
  OrientationLockSource,
  OrientationLockDerived,
  OrientationLockProviderProps
>({
  name: 'orientationLock',

  state: ({ set }): OrientationLockSource => ({
    setOrientationLock: (value) => set({ [USER_ORIENTATION_LOCK]: value }),
  }),

  derived: {
    orientationLock: ({ get }) => get(USER_ORIENTATION_LOCK) ?? LIBRARY_DEFAULT,
  },

  providerProps: {
    orientationLock: { type: String, attribute: 'orientation-lock', action: 'setOrientationLock' },
  },

  attach({ target, signal, get }) {
    const { media, container } = target;

    // Read the current value at lock time rather than capturing it up front.
    // This is the behavioural change that makes the value reactive, and it is
    // easy to miss: the store half looks finished while the lock still uses
    // whatever was set when the media attached.
    const orientationLock = createScreenOrientationLock({
      get type() {
        return get().orientationLock;
      },
    });

    let wasFullscreen = false;
    const sync = () => {
      const fullscreen = isFullscreen(container, media);

      if (!wasFullscreen && fullscreen) {
        void orientationLock.lock();
      } else if (wasFullscreen && !fullscreen) {
        orientationLock.unlock();
      }

      wasFullscreen = fullscreen;
    };

    sync();

    listen(document, 'fullscreenchange', sync, { signal });
    listen(document, 'webkitfullscreenchange', sync, { signal });

    const video = media as WebKitPresentationMedia;
    if ('webkitPresentationMode' in video) {
      listen(media, 'webkitpresentationmodechanged', sync, { signal });
    }

    signal.addEventListener('abort', () => orientationLock.unlock(), { once: true });
  },
});
