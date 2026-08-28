import { defineMediaCapability } from '../capability';
import { EMPTY_TEXT_TRACKS } from '../constants';
import type { MediaTextTrackCapability, TextTrackLike } from '../types';

/**
 * Captions, subtitles, chapters, and metadata tracks.
 *
 * `addtrack`, `removetrack`, and `change` belong to the track list rather than the media, so a listener goes on
 * `textTracks` and this capability announces nothing of its own.
 */
export const textTrackCapability = defineMediaCapability<MediaTextTrackCapability>()({
  name: 'text-track',
  events: [],
  props: {
    textTracks: { fallback: EMPTY_TEXT_TRACKS, readonly: true },
  },
  methods: {
    // A media that cannot add a track has none to hand back, and the contract
    // has no room to say so, so this answers with nothing rather than inventing
    // a track the caller would then hold on to.
    addTextTrack: { fallback: () => undefined as unknown as TextTrackLike },
  },
});
