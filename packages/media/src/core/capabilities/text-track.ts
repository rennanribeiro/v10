import { defineMediaCapability } from '../capability';
import { EMPTY_TEXT_TRACKS } from '../constants';
import type { MediaTextTrackCapability, TextTrackLike } from '../types';

/** Captions, subtitles, chapters, and metadata tracks. */
export const textTrackCapability = defineMediaCapability<MediaTextTrackCapability>()({
  name: 'text-track',
  events: ['addtrack', 'removetrack', 'change'],
  props: {
    textTracks: { fallback: EMPTY_TEXT_TRACKS, readonly: true },
  },
  methods: {
    // A media that cannot add tracks has nothing to hand back, matching the
    // pre-capability host.
    addTextTrack: { fallback: () => undefined as unknown as TextTrackLike },
  },
});
