import type { MediaControlsState } from '@videojs/media';

export interface ControlsState {
  visible: boolean;
  userActive: boolean;
}

export class ControlsCore {
  #media: MediaControlsState | null = null;

  setMedia(media: MediaControlsState | null): void {
    this.#media = media;
  }

  getState(): ControlsState {
    const media = this.#media;
    if (!media) return { visible: true, userActive: true };

    return {
      visible: media.controlsVisible,
      userActive: media.userActive,
    };
  }
}

export namespace ControlsCore {
  export type State = ControlsState;
}
