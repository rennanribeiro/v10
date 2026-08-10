import type { MediaControlsState, MediaMetadataState, MediaPlaybackState } from '@videojs/media';

/**
 * Media state the title reads, composed by the HTML and React `Title` adapters
 * from the `metadata`, `playback`, and `controls` store slices.
 *
 * `controlsVisible` is optional because the audio presets leave out
 * `controlsFeature`: audio chrome never auto-hides, so there is no visibility
 * to follow.
 */
export type TitleMediaState = Pick<MediaMetadataState, 'contentTitle'> &
  Pick<MediaPlaybackState, 'paused'> & {
    controlsVisible?: MediaControlsState['controlsVisible'] | undefined;
  };

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
    const controlsVisible = media.controlsVisible ?? true;

    return {
      title,
      hasTitle,
      visible: hasTitle && controlsVisible && media.paused,
    };
  }
}

export namespace TitleCore {
  export type State = TitleState;
  export type MediaState = TitleMediaState;
}
