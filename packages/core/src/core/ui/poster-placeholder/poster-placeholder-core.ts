import type { MediaMetadataState, MediaPlaybackState } from '@videojs/media';

/**
 * The slices the poster placeholder composes: `playback` decides whether it
 * shows, `metadata` resolves what it shows. Composed here rather than in each
 * binding so the resolution is written and tested once.
 */
export type PosterPlaceholderMediaState = Pick<MediaPlaybackState, 'started'> &
  Pick<MediaMetadataState, 'posterPlaceholder'>;

export interface PosterPlaceholderState {
  visible: boolean;
  /** Resolved poster placeholder URL, empty when nothing supplied one. */
  src: string;
}

export class PosterPlaceholderCore {
  #media: PosterPlaceholderMediaState | null = null;

  setMedia(media: PosterPlaceholderMediaState): void {
    this.#media = media;
  }

  getState(): PosterPlaceholderState {
    const media = this.#media!;
    return {
      visible: !media.started,
      src: media.posterPlaceholder,
    };
  }
}

export namespace PosterPlaceholderCore {
  export type State = PosterPlaceholderState;
  export type MediaState = PosterPlaceholderMediaState;
}
