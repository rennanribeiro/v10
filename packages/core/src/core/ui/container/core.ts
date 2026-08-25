import type { MediaControlsState } from '@videojs/media';

export interface ContainerState {
  /** Name of the grouped popup currently open within the container. */
  activePopupName: string | null;
  /** Whether the player controls are currently visible. */
  controlsVisible: boolean;
}

export class ContainerCore {
  #activePopupName: string | null = null;
  #media: MediaControlsState | null = null;

  setActivePopupName(activePopupName: string | null): void {
    this.#activePopupName = activePopupName;
  }

  setMedia(media: MediaControlsState | null): void {
    this.#media = media;
  }

  getState(): ContainerState {
    return {
      activePopupName: this.#activePopupName,
      controlsVisible: this.#media?.controlsVisible ?? false,
    };
  }
}

export namespace ContainerCore {
  export type State = ContainerState;
}
