import { defineMediaCapability } from '../../core/capability';
import { EMPTY_TEXT_TRACKS } from '../../core/constants';
import type { MediaTextTrackCapability, TextTrackLike } from '../../core/types';

/** DOM-shaped {@link MediaTextTrackCapability}: browser hosts hand back a real `TextTrackList`. */
export interface HTMLMediaTextTrackCapability extends MediaTextTrackCapability {
  readonly textTracks: TextTrackList;
}

/** Captions, subtitles, chapters, and metadata tracks. */
export const textTrackCapability = defineMediaCapability<HTMLMediaTextTrackCapability>()({
  name: 'text-track',
  events: ['addtrack', 'removetrack', 'change'],
  props: {
    textTracks: { fallback: EMPTY_TEXT_TRACKS as unknown as TextTrackList, readonly: true },
  },
  methods: {
    // A media that cannot add tracks has nothing to hand back, matching the
    // pre-capability host.
    addTextTrack: { fallback: () => undefined as unknown as TextTrackLike },
  },
});
