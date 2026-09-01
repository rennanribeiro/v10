import type { Constructor } from '@videojs/utils/types';
import Hls from 'hls.js';

import { TRACK_LOADED, withReadableCues } from './text-tracks';
import type { HlsEngineHost } from './types';

/**
 * Elements already rebuilt once. A source that legitimately parses to zero cues reads as wiped on every event, so
 * without this the reload would refetch it for the lifetime of the element.
 */
const reloaded = new WeakSet<HTMLTrackElement>();

/**
 * Keeps user-authored `<track kind="metadata|chapters">` elements usable while hls.js is active.
 *
 * Hls.js clears the cues of every text track when it attaches media or starts loading a manifest. On the paths this
 * package drives, `withPreservedTextTracks` puts those cues back, so what is left for this mixin is the wipes it does
 * not wrap: an app calling `recoverMediaError()` or `loadSource()` on the engine directly. Such a track is rebuilt from
 * its `src`, and a `default` track is forced to `hidden` so it loads at all.
 */
export function HlsJsMetadataTracksMixin<Base extends Constructor<HlsEngineHost>>(BaseClass: Base) {
  class HlsJsMetadataTracks extends (BaseClass as Constructor<HlsEngineHost>) {
    constructor(...args: any[]) {
      super(...args);

      // Watch out here, AFTER the manifest is loaded!
      this.engine?.on(Hls.Events.MANIFEST_LOADED, () => this.#forceHiddenTracks());
      this.engine?.on(Hls.Events.MEDIA_ATTACHED, () => this.#forceHiddenTracks());
    }

    #forceHiddenTracks(): void {
      // The hls.js delegate always binds to the real `<video>` element.
      const target = this.target as HTMLVideoElement | null;
      if (!target) return;

      // Walk the elements themselves. A selector rebuilt from the track's kind and label throws on labels that are
      // not valid selector text, and collapses same-kind tracks onto whichever element matches first.
      for (const trackEl of [...target.querySelectorAll('track')]) {
        const { track } = trackEl;
        // A host without a text track implementation exposes no `track`; leave those elements alone.
        if (!track) continue;

        if (!(track.kind === 'metadata' || track.kind === 'chapters')) continue;

        const loaded = trackEl.getAttribute('src') !== null && trackEl.readyState === TRACK_LOADED;

        // `cues` reads as `null` while a track is disabled no matter what it holds, so an emptied track is only told
        // apart from a disabled one by counting through a mode that exposes them.
        const wiped = loaded && !reloaded.has(trackEl) && withReadableCues(track, () => !track.cues?.length);

        const currentTrackEl = wiped ? this.#reload(target, trackEl) : trackEl;

        // Force mode to 'hidden' for default tracks (independent of replacement).
        if (currentTrackEl.default && currentTrackEl.track.mode !== 'hidden') currentTrackEl.track.mode = 'hidden';
      }
    }

    /** Swaps in a fresh element so the source is fetched again, carrying over the mode that was driving playback. */
    #reload(target: HTMLVideoElement, trackEl: HTMLTrackElement): HTMLTrackElement {
      const { mode } = trackEl.track;
      const clonedTrackEl = trackEl.cloneNode() as HTMLTrackElement;

      reloaded.add(clonedTrackEl);
      target.replaceChild(clonedTrackEl, trackEl);

      // The clone starts disabled with a fresh `TextTrack`, and a disabled track is never fetched.
      if (mode !== 'disabled') clonedTrackEl.track.mode = mode;

      return clonedTrackEl;
    }
  }

  return HlsJsMetadataTracks as unknown as Base;
}
