import type { MediaControlsState, MediaMetadataState, MediaPlaybackState } from '@videojs/media';

/**
 * Media state the title reads, composed by the HTML and React `Title` adapters
 * from the `metadata`, `playback`, and `controls` store slices.
 *
 * Every field is required. A player can leave out `playbackFeature` or
 * `controlsFeature` — the audio presets leave out the latter — so the adapters
 * substitute the neutral value that means "nothing here hides the title".
 */
export type TitleMediaState = Pick<MediaMetadataState, 'contentTitle'> &
  Pick<MediaPlaybackState, 'paused'> &
  Pick<MediaControlsState, 'controlsVisible'>;

export interface TitleState {
  /** The resolved content title. Empty when no source supplied one. */
  title: MediaMetadataState['contentTitle'];
  /** Whether a title is present. */
  hasTitle: boolean;
  /** Whether the title should be displayed. */
  visible: boolean;
}

export class TitleCore {
  #media: TitleMediaState | null = null;

  setMedia(media: TitleMediaState): void {
    this.#media = media;
  }

  getState(): TitleState {
    const media = this.#media!;
    const title = media.contentTitle;
    const hasTitle = title.length > 0;

    return {
      title,
      hasTitle,
      visible: hasTitle && media.controlsVisible && media.paused,
    };
  }
}

export namespace TitleCore {
  export type State = TitleState;
  export type MediaState = TitleMediaState;
}
