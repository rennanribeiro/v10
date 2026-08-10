'use client';

import { PosterPlaceholderCore, PosterPlaceholderDataAttrs } from '@videojs/core';
import { logMissingFeature, selectMetadata, selectPlayback } from '@videojs/core/dom';
import { cssUrl } from '@videojs/utils/style';
import type { ForwardedRef } from 'react';
import { forwardRef, useState } from 'react';

import { usePlayer } from '../../player/context';
import type { UIComponentProps } from '../../utils/types';
import { renderElement } from '../../utils/use-render';

export interface PosterPlaceholderProps extends UIComponentProps<'div', PosterPlaceholderCore.State> {}

/**
 * Displays a low-resolution stand-in behind the poster while the poster loads,
 * producing the blur-up effect. Shows before playback starts, hides after.
 *
 * Renders one empty element with `background-image` set from the player's
 * resolved `posterPlaceholder`, so set it on the provider rather than here.
 * Sizing, position, and blur come from CSS.
 *
 * Render it before the poster so the poster paints on top.
 *
 * @example
 * ```tsx
 * <Player.Provider poster="poster.jpg" posterPlaceholder="tiny.jpg">
 *   <PosterPlaceholder />
 *   <Poster />
 * </Player.Provider>
 * ```
 */
export const PosterPlaceholder = forwardRef(function PosterPlaceholder(
  componentProps: PosterPlaceholderProps,
  forwardedRef: ForwardedRef<HTMLDivElement>
) {
  const { render, className, style, ...elementProps } = componentProps;

  const playback = usePlayer(selectPlayback);
  const metadata = usePlayer(selectMetadata);

  const [core] = useState(() => new PosterPlaceholderCore());

  if (!playback) {
    if (__DEV__) logMissingFeature('PosterPlaceholder', 'playback');
    return null;
  }

  // The metadata feature is optional. Without it nothing resolves a URL and
  // this component paints nothing.
  core.setMedia({ started: playback.started, posterPlaceholder: metadata?.posterPlaceholder ?? '' });

  const state = core.getState();

  return renderElement(
    'div',
    { render, className, style },
    {
      state,
      stateAttrMap: PosterPlaceholderDataAttrs,
      ref: [forwardedRef],
      props: [elementProps, ...(state.src === '' ? [] : [{ style: { backgroundImage: cssUrl(state.src) } }])],
    }
  );
});

export namespace PosterPlaceholder {
  export type Props = PosterPlaceholderProps;
  export type State = PosterPlaceholderCore.State;
}
