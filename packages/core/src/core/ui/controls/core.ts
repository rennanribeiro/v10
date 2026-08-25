import type { MediaControlsState } from '@videojs/media';

export interface ControlsState {
  /** Whether the controls are currently visible. */
  visible: boolean;
  /** Whether recent user interaction is keeping the controls active. */
  userActive: boolean;
}

export class ControlsCore {
  #media: MediaControlsState | null = null;

  setMedia(media: MediaControlsState): void {
    this.#media = media;
  }

  getState(): ControlsState {
    const media = this.#media!;

    return {
      visible: media.controlsVisible,
      userActive: media.userActive,
    };
  }
}

export namespace ControlsCore {
  export type State = ControlsState;
}
