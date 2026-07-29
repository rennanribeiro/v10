import { PosterCore, PosterDataAttrs } from '@videojs/core';
import { selectContentMetadata, selectPlayback } from '@videojs/core/dom';
import type { PropertyValues } from '@videojs/element';

import { playerContext } from '../../player/context';
import { PlayerController } from '../../player/player-controller';
import { MediaUIElement } from '../media-ui-element';

/**
 * Wrapper around a poster image.
 *
 * The author supplies the image element; this element supplies the URL from the
 * store when the image has none. It never creates an image and never overwrites
 * a `src` the author set, so a bare `<media-poster>` with no image inside renders
 * nothing — by design. The element is a wrapper around *your* image, which keeps
 * `srcset`, `loading="lazy"`, `<picture>`, and framework image components
 * available.
 *
 * This is deliberately not symmetric with React's `<Poster>`, which owns its own
 * image element. User-visible behaviour is identical; each side follows its
 * platform's grain, and bringing this element to parity would mean adding a
 * shadow root to an element family that deliberately has none.
 */
export class PosterElement extends MediaUIElement<PosterCore> {
  static readonly tagName = 'media-poster';

  static get observedAttributes(): string[] {
    // biome-ignore lint/complexity/noThisInStatic: intentional use of super
    return [...super.observedAttributes, 'placeholdersrc'];
  }

  protected readonly core = new PosterCore();
  protected readonly stateAttrMap = PosterDataAttrs;
  protected readonly mediaState = new PlayerController(this, playerContext, selectPlayback);
  readonly #contentMetadata = new PlayerController(this, playerContext, selectContentMetadata);

  override attributeChangedCallback(attr: string, oldValue: string | null, newValue: string | null): void {
    super.attributeChangedCallback(attr, oldValue, newValue);

    if (attr === 'placeholdersrc') {
      if (newValue) {
        this.style.setProperty('--media-poster-placeholder', `url(${newValue})`);
      } else {
        this.style.removeProperty('--media-poster-placeholder');
      }
    }
  }

  protected override update(changed: PropertyValues): void {
    super.update(changed);
    this.#fillImage();
  }

  /**
   * Whether the author supplied each attribute themselves, snapshotted the first
   * time an image is seen.
   *
   * Ownership has to be remembered rather than re-derived, because after the
   * first fill the attribute is present either way. Re-checking presence would
   * freeze the poster on whatever the store happened to hold at that moment —
   * so a playlist advancing to the next video would keep the previous poster.
   */
  #authorOwnsSrc: boolean | undefined;
  #authorOwnsAlt: boolean | undefined;

  /**
   * Fills the `src` and `alt` the author left for us on the image they supplied,
   * and keeps them in step with the store afterwards.
   *
   * `alt` ownership is decided by *presence*, never emptiness: an author writing
   * `alt=""` is deliberately marking the image decorative, and overwriting that
   * would be an accessibility bug rather than a cosmetic one.
   */
  #fillImage(): void {
    const metadata = this.#contentMetadata.value;
    if (!metadata) return;

    // Reaches through a slot so a default skin's fallback image is found too.
    const image = this.#findImage();
    if (!image) return;

    this.#authorOwnsSrc ??= !!image.getAttribute('src');
    this.#authorOwnsAlt ??= image.hasAttribute('alt');

    if (!this.#authorOwnsSrc) {
      // A resolved empty string means render nothing, so the attribute is removed
      // rather than set to `""` — which would request the current page.
      if (metadata.contentPoster) {
        image.setAttribute('src', metadata.contentPoster);
      } else {
        image.removeAttribute('src');
      }
    }

    if (!this.#authorOwnsAlt) {
      image.setAttribute('alt', metadata.contentPosterAlt);
    }
  }

  #findImage(): HTMLImageElement | null {
    // Anything the author assigned to a slot wins over a skin's fallback image.
    // `assignedNodes()` is deliberately un-flattened: it returns nothing when the
    // slot is empty, which is how "the author supplied an image" is detected.
    // Flattening would return the fallback here and conflate the two cases.
    for (const slot of this.querySelectorAll('slot')) {
      for (const node of slot.assignedNodes()) {
        if (node instanceof HTMLImageElement) return node;
        if (node instanceof Element) {
          const nested = node.querySelector('img');
          if (nested) return nested;
        }
      }
    }

    // Hand-composed markup, or a skin's fallback image sitting inside an empty
    // slot — both are ordinary descendants from here.
    return this.querySelector('img');
  }
}
