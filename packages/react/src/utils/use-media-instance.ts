import type { Media } from '@videojs/media';
import { useLayoutEffect, useState } from 'react';

import { useMediaAttach } from '../player/context';
import { useLatestRef } from './use-latest-ref';

interface MediaAcquisition<Instance> {
  MediaClass: new () => Instance;
  instance: Instance;
}

/**
 * Acquire and manage a media instance after the component commits.
 *
 * Returns `null` during server rendering and until the acquisition layout
 * effect has committed. The acquired instance is attached to the surrounding
 * player and destroyed when its component unmounts or the media class changes.
 *
 * @param MediaClass - Media class to acquire. Pass a stable class reference.
 * @param setup - Optional initialization that runs once for each acquired
 * instance, before it is published to the player. Resources registered with the
 * media are owned and destroyed by that instance.
 */
export function useMediaInstance<Instance extends Media & { destroy(): void }>(
  MediaClass: new () => Instance,
  setup?: (media: Instance) => void
): Instance | null {
  const [acquisition, setAcquisition] = useState<MediaAcquisition<Instance> | null>(null);
  const setMedia = useMediaAttach();
  const setupRef = useLatestRef(setup);

  useLayoutEffect(() => {
    const instance = new MediaClass();

    try {
      setupRef.current?.(instance);
    } catch (error) {
      instance.destroy();
      throw error;
    }

    setAcquisition({ MediaClass, instance });
    setMedia?.(instance);

    return () => {
      setMedia?.((prev) => (prev === instance ? null : prev));
      instance.destroy();
    };
  }, [MediaClass, setMedia]);

  return acquisition?.MediaClass === MediaClass ? acquisition.instance : null;
}
