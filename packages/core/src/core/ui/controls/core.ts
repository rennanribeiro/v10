import type { MediaControlsState } from '@videojs/media';

export interface ControlsState {
  /** Name of the grouped popup currently open within the player. */
  activePopup: string | null;
  visible: boolean;
  userActive: boolean;
}

export class ControlsCore {
  #activePopup: string | null = null;
  #media: MediaControlsState | null = null;

  setActivePopup(activePopup: string | null): void {
    this.#activePopup = activePopup;
  }

  setMedia(media: MediaControlsState): void {
    this.#media = media;
  }

  getState(): ControlsState {
    const media = this.#media!;

    return {
      activePopup: this.#activePopup,
      visible: media.controlsVisible,
      userActive: media.userActive,
    };
  }
}

export namespace ControlsCore {
  export type State = ControlsState;
}
