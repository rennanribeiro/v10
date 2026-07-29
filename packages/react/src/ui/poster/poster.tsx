'use client';

import { PosterCore, PosterDataAttrs } from '@videojs/core';
import { logMissingFeature, selectContentMetadata, selectPlayback } from '@videojs/core/dom';
import { isUndefined } from '@videojs/utils/predicate';
import type { ForwardedRef, SyntheticEvent } from 'react';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';

import { usePlayer } from '../../player/context';
import type { UIComponentProps } from '../../utils/types';
import { renderElement } from '../../utils/use-render';

export interface PosterProps extends UIComponentProps<'img', PosterCore.State> {}

/**
 * Displays the video poster image. Shows before playback starts, hides after.
 *
 * With no `src`, reads the resolved `contentPoster` and `contentPosterAlt` from
 * the store, so `<video-player content-poster="…">` reaches the screen with no
 * prop threading. A local `src` short-circuits that and the store is not
 * consulted at all — the component only decides *whether to ask*, which is why
 * this is not a fourth precedence tier. `srcSet`, `loading`, and the `render`
 * prop keep working either way.
 *
 * @example
 * ```tsx
 * <Poster src="poster.jpg" alt="Video description" />
 *
 * <Poster
 *   src="poster.jpg"
 *   alt="Video description"
 *   className={(state) => state.visible ? 'visible' : 'hidden'}
 * />
 * ```
 */
export const Poster = forwardRef(function Poster(
  componentProps: PosterProps,
  forwardedRef: ForwardedRef<HTMLImageElement>
) {
  const { render, className, style, ...elementProps } = componentProps;

  const playback = usePlayer(selectPlayback);
  const contentMetadata = usePlayer(selectContentMetadata);

  const [core] = useState(() => new PosterCore());

  const localSrc = (elementProps as { src?: string }).src;
  const localAlt = (elementProps as { alt?: string }).alt;

  // An absent `src` means nothing was provided, so the store wins. A resolved
  // empty string means render nothing rather than an image whose empty `src`
  // would request the current page.
  const resolvedSrc = isUndefined(localSrc) ? contentMetadata?.contentPoster || undefined : localSrc;

  // Presence, never emptiness: an author writing `alt=""` is deliberately
  // marking the image decorative, and overwriting that would be an
  // accessibility regression rather than a cosmetic one.
  const resolvedAlt = isUndefined(localAlt) ? contentMetadata?.contentPosterAlt : localAlt;

  // Track when the current src has finished loading so the CSS blur-up
  // sequence can show the placeholder first, then crossfade to the full image.
  const src = resolvedSrc;
  const [loadedSrc, setLoadedSrc] = useState<string | undefined>(undefined);
  const loaded = loadedSrc === src;
  const imgRef = useRef<HTMLImageElement | null>(null);

  // A cached image may already be complete when the element mounts, in which
  // case onLoad never fires. Check synchronously after mount and on src change.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0 && img.getAttribute('src') === src) {
      setLoadedSrc(src);
    }
  }, [src]);

  const handleLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    setLoadedSrc(event.currentTarget.getAttribute('src') ?? undefined);
  }, []);

  if (!playback) {
    if (__DEV__) logMissingFeature('Poster', 'playback');
    return null;
  }

  core.setMedia(playback);

  return renderElement(
    'img',
    { render, className, style },
    {
      state: core.getState(),
      stateAttrMap: PosterDataAttrs,
      ref: [forwardedRef, imgRef],
      props: [
        elementProps,
        { src: resolvedSrc, alt: resolvedAlt },
        { 'data-loaded': loaded ? '' : undefined, onLoad: handleLoad },
      ],
    }
  );
});

export namespace Poster {
  export type Props = PosterProps;
  export type State = PosterCore.State;
}
