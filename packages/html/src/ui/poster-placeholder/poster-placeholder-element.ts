import { PosterPlaceholderCore, PosterPlaceholderDataAttrs } from '@videojs/core';
import { applyStateDataAttrs, logMissingFeature, selectMetadata, selectPlayback } from '@videojs/core/dom';
import type { PropertyValues } from '@videojs/element';
import { cssUrl } from '@videojs/utils/style';

import { playerContext } from '../../player/context';
import { PlayerController } from '../../player/player-controller';
import { MediaElement } from '../media-element';

/**
 * `<media-poster-placeholder>` — paints the stand-in behind the poster and
 * hides it once playback starts.
 *
 * An empty element with no children of its own. It sets `background-image`
 * from the resolved `posterPlaceholder` and leaves the rest of the painting —
 * sizing, position, blur — to CSS, so a skin styles it the same way on both
 * platforms.
 *
 * Composes `playback` for visibility and `metadata` for the URL, so it doesn't
 * extend `MediaUIElement`: that base couples an element to a single feature
 * selector.
 */
export class PosterPlaceholderElement extends MediaElement {
  static readonly tagName = 'media-poster-placeholder';

  readonly #core = new PosterPlaceholderCore();

  readonly #playback = new PlayerController(this, playerContext, selectPlayback);
  readonly #metadata = new PlayerController(this, playerContext, selectMetadata);

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.destroyed) return;

    if (__DEV__ && !this.#playback.value) {
      logMissingFeature(this.localName, this.#playback.displayName ?? 'playback');
    }
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed);

    const playback = this.#playback.value;
    if (!playback) return;

    // The metadata feature is optional. Without it nothing resolves a URL and
    // this element paints nothing.
    this.#core.setMedia({
      started: playback.started,
      posterPlaceholder: this.#metadata.value?.posterPlaceholder ?? '',
    });

    const state = this.#core.getState();
    applyStateDataAttrs(this, state, PosterPlaceholderDataAttrs);

    if (state.src === '') {
      this.style.removeProperty('background-image');
    } else {
      this.style.setProperty('background-image', cssUrl(state.src));
    }
  }
}
