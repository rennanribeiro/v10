import type { MediaContentMetadataState, MediaContentValue } from '@videojs/media';
import {
  isMediaContentPosterAltCapable,
  isMediaContentPosterCapable,
  isMediaContentTitleCapable,
} from '@videojs/media';
import { listen } from '@videojs/utils/dom';

import { definePlayerFeature } from '../../feature';

/**
 * Value at the end of every resolve chain.
 *
 * A plain constant rather than a fourth slot, so it cannot be overwritten. A
 * developer who set and then cleared a `default-content-title` would otherwise
 * wipe the library's value too, leaving the chain ending in nothing and breaking
 * the always-a-string guarantee at the worst possible moment.
 *
 * Empty string is also the right answer for each of these fields: nothing to
 * render for a title or poster, and a decorative image for poster alt text.
 */
const LIBRARY_DEFAULT = '';

// ----------------------------------------
// Tier slots
// ----------------------------------------

/**
 * Each field is three slots, not one, and they resolve in a fixed order:
 * `user ?? media ?? developerDefault ?? LIBRARY_DEFAULT`.
 *
 * Separate slots rather than one slot with write-time precedence: a single slot
 * would have to track where its value came from anyway in order to decide
 * whether the media's write wins, could not recover when the developer cleared
 * their value, and would be order-dependent — and write order genuinely differs
 * by platform and by timing. Separate slots resolve identically however the
 * writes arrive.
 *
 * Keys are symbols so they get no getter on the store (`createStore` installs
 * accessors from `Object.keys`, which skips symbols) and never appear in
 * selector output. They are *internal*, not secret: `Reflect.ownKeys` on a state
 * snapshot will list them, which is what makes them debuggable.
 *
 * Which slots are seeded in `state()` is load-bearing, so do not "tidy" it.
 * Media slots are seeded, so `detach`'s reset clears them — the media left, so
 * its donated value should leave with it. User and default slots are left out,
 * so the reset cannot reach them; they belong to the player, not the media.
 */
const USER_CONTENT_TITLE = Symbol('vjs.contentTitle.user');
const MEDIA_CONTENT_TITLE = Symbol('vjs.contentTitle.media');
const DEFAULT_CONTENT_TITLE = Symbol('vjs.contentTitle.default');

const USER_CONTENT_POSTER = Symbol('vjs.contentPoster.user');
const MEDIA_CONTENT_POSTER = Symbol('vjs.contentPoster.media');
const DEFAULT_CONTENT_POSTER = Symbol('vjs.contentPoster.default');

const USER_CONTENT_POSTER_ALT = Symbol('vjs.contentPosterAlt.user');
const MEDIA_CONTENT_POSTER_ALT = Symbol('vjs.contentPosterAlt.media');
const DEFAULT_CONTENT_POSTER_ALT = Symbol('vjs.contentPosterAlt.default');

// ----------------------------------------
// Types
// ----------------------------------------

/** The keys of {@link MediaContentMetadataState} the store computes rather than stores. */
type ResolvedKey = 'contentTitle' | 'contentPoster' | 'contentPosterAlt';

/**
 * The feature's source state: its actions, plus symbol-keyed tier slots.
 *
 * The slots are typed through a symbol index signature rather than named keys so
 * the symbols themselves stay module-private — naming them in the type would
 * force them to be exported for declaration emit, making a private mechanism
 * public API.
 */
export interface ContentMetadataSource extends Omit<MediaContentMetadataState, ResolvedKey> {
  [tier: symbol]: MediaContentValue;
}

/** The resolved values, computed by the store and read-only to everyone else. */
export type ContentMetadataDerived = Pick<MediaContentMetadataState, ResolvedKey>;

/**
 * Two provider inputs per field: an override and a fallback.
 *
 * This is how one fixed precedence chain expresses both of the product
 * requirements that look opposite. "Override whatever the host provides" writes
 * the override; "set a default unless the host provides one" writes the
 * fallback. Two slots on one chain, not two precedences — so React's
 * `value`/`defaultValue` framing is not needed.
 *
 * `null` is admissible because removing an HTML attribute yields `null`, and the
 * generated prop type should not be narrower than the documented contract.
 */
export interface ContentMetadataProviderProps {
  contentTitle?: string | null | undefined;
  defaultContentTitle?: string | null | undefined;
  contentPoster?: string | null | undefined;
  defaultContentPoster?: string | null | undefined;
  contentPosterAlt?: string | null | undefined;
  defaultContentPosterAlt?: string | null | undefined;
}

// ----------------------------------------
// Feature
// ----------------------------------------

/**
 * Reconciles content metadata the developer supplies with content metadata the
 * media reports.
 *
 * One feature holds every field rather than one feature per field: they share
 * the machinery, a selector, and a declaration group. The trade is that feature
 * granularity is opt-in granularity — a player wanting only a title still gets
 * every field's props and state keys. Cost is types and a few state keys, not
 * runtime work.
 *
 * On the media side this stays per-field: three capabilities, three events,
 * three predicates. One feature consuming several capabilities is already the
 * `streamType` pattern.
 */
export const contentMetadataFeature = definePlayerFeature<
  ContentMetadataSource,
  ContentMetadataDerived,
  ContentMetadataProviderProps
>({
  name: 'contentMetadata',

  state: ({ set }): ContentMetadataSource => ({
    // Media slots only — see the tier-slot note above.
    [MEDIA_CONTENT_TITLE]: undefined,
    [MEDIA_CONTENT_POSTER]: undefined,
    [MEDIA_CONTENT_POSTER_ALT]: undefined,

    // Two plain actions per field rather than one parameterised by tier, so both
    // appear in the imperative API where they are discoverable. These are
    // state-only and never touch `target()`, which throws when nothing is
    // attached — the developer can set metadata before any media exists.
    setContentTitle: (value) => set({ [USER_CONTENT_TITLE]: value }),
    setDefaultContentTitle: (value) => set({ [DEFAULT_CONTENT_TITLE]: value }),
    setContentPoster: (value) => set({ [USER_CONTENT_POSTER]: value }),
    setDefaultContentPoster: (value) => set({ [DEFAULT_CONTENT_POSTER]: value }),
    setContentPosterAlt: (value) => set({ [USER_CONTENT_POSTER_ALT]: value }),
    setDefaultContentPosterAlt: (value) => set({ [DEFAULT_CONTENT_POSTER_ALT]: value }),
  }),

  // `??` treats `null` and `undefined` alike, so a cleared attribute and an
  // absent one both fall through — while an empty string, being neither, wins.
  // That is the whole reason suppression works: `content-title=""` means the
  // developer wants no title shown, and it beats whatever the media reports.
  derived: {
    contentTitle: ({ get }) =>
      get(USER_CONTENT_TITLE) ?? get(MEDIA_CONTENT_TITLE) ?? get(DEFAULT_CONTENT_TITLE) ?? LIBRARY_DEFAULT,
    contentPoster: ({ get }) =>
      get(USER_CONTENT_POSTER) ?? get(MEDIA_CONTENT_POSTER) ?? get(DEFAULT_CONTENT_POSTER) ?? LIBRARY_DEFAULT,
    contentPosterAlt: ({ get }) =>
      get(USER_CONTENT_POSTER_ALT) ??
      get(MEDIA_CONTENT_POSTER_ALT) ??
      get(DEFAULT_CONTENT_POSTER_ALT) ??
      LIBRARY_DEFAULT,
  },

  providerProps: {
    contentTitle: { type: String, attribute: 'content-title', action: 'setContentTitle' },
    defaultContentTitle: { type: String, attribute: 'default-content-title', action: 'setDefaultContentTitle' },
    contentPoster: { type: String, attribute: 'content-poster', action: 'setContentPoster' },
    defaultContentPoster: { type: String, attribute: 'default-content-poster', action: 'setDefaultContentPoster' },
    contentPosterAlt: { type: String, attribute: 'content-poster-alt', action: 'setContentPosterAlt' },
    defaultContentPosterAlt: {
      type: String,
      attribute: 'default-content-poster-alt',
      action: 'setDefaultContentPosterAlt',
    },
  },

  /**
   * Fills the media tier from whatever the media reports.
   *
   * No `emptied` listener. A media that reports a metadata field is expected to
   * clear it on source change and dispatch the change event — the same contract
   * the stream-type feature already assumes, and which `hls-js` already honours
   * by resetting itself on `MANIFEST_LOADING` and `DESTROYING`. Worth knowing
   * that the contract's two halves are not equally enforced: dispatching is
   * structural, because assigning through the host setter always fires the
   * event, while clearing on a new source is pure convention.
   */
  attach({ target, signal, set }) {
    const { media } = target;

    if (isMediaContentTitleCapable(media)) {
      const sync = () => set({ [MEDIA_CONTENT_TITLE]: media.contentTitle });
      sync();
      listen(media, 'contenttitlechange', sync, { signal });
    }

    if (isMediaContentPosterCapable(media)) {
      const sync = () => set({ [MEDIA_CONTENT_POSTER]: media.contentPoster });
      sync();
      listen(media, 'contentposterchange', sync, { signal });
    }

    if (isMediaContentPosterAltCapable(media)) {
      const sync = () => set({ [MEDIA_CONTENT_POSTER_ALT]: media.contentPosterAlt });
      sync();
      listen(media, 'contentposteraltchange', sync, { signal });
    }
  },
});
