import {
  AudioTrackRadioGroupCore,
  CAPTIONS_OFF_VALUE,
  CaptionsRadioGroupCore,
  PlaybackRateRadioGroupCore,
  QUALITY_AUTO_VALUE,
  QualityRadioGroupCore,
} from '@videojs/core';
import {
  type AnyPlayerStore,
  selectAudioTrack,
  selectPlaybackRate,
  selectQuality,
  selectTextTrack,
} from '@videojs/core/dom';
import { type Text, type TextParams, translateText } from '@videojs/core/i18n';
import { autoText, offText } from '@videojs/core/i18n/text/menu';
import type { ReactiveController, ReactiveControllerHost } from '@videojs/element';
import type {
  MediaAudioTrackState,
  MediaPlaybackRateState,
  MediaQualityState,
  MediaTextTrackState,
} from '@videojs/media';

import { i18nContext } from '../i18n/context';
import { I18nController } from '../i18n/controller';
import { playerContext } from '../player/context';
import { PlayerController } from '../player/player-controller';

type VideoMenuSetting = 'playback-rate' | 'quality' | 'audio-track' | 'captions';
type VideoSkinHost = ReactiveControllerHost & HTMLElement;

interface VideoMenuSettingState {
  label: Text | string;
  labelParams?: TextParams | undefined;
  availability: 'available' | 'unavailable';
}

const settings: readonly VideoMenuSetting[] = ['quality', 'audio-track', 'playback-rate', 'captions'];
type VideoMenuMediaState = MediaAudioTrackState & MediaPlaybackRateState & MediaQualityState & MediaTextTrackState;

const selectVideoMenuSettings = Object.assign(
  (state: object): Partial<VideoMenuMediaState> => ({
    ...selectAudioTrack(state),
    ...selectPlaybackRate(state),
    ...selectQuality(state),
    ...selectTextTrack(state),
  }),
  { displayName: 'videoMenuSettings' }
);

class VideoMenuSettingsController implements ReactiveController {
  readonly #host: VideoSkinHost;
  readonly #playbackRateCore = new PlaybackRateRadioGroupCore();
  readonly #qualityCore = new QualityRadioGroupCore();
  readonly #audioTrackCore = new AudioTrackRadioGroupCore();
  readonly #captionsCore = new CaptionsRadioGroupCore();
  #i18n: I18nController | null = null;
  #media: PlayerController<AnyPlayerStore, Partial<VideoMenuMediaState>> | null = null;

  constructor(host: VideoSkinHost) {
    this.#host = host;
    host.addController(this);
  }

  hostConnected(): void {
    if (this.#i18n) return;
    this.#i18n = new I18nController(this.#host, i18nContext);
    this.#media = new PlayerController(this.#host, playerContext, selectVideoMenuSettings);
  }

  hostUpdated(): void {
    for (const setting of settings) this.#updateSetting(setting);
  }

  #updateSetting(setting: VideoMenuSetting): void {
    const item = this.#host.shadowRoot?.querySelector<HTMLElement>(`[data-setting="${setting}"]`);
    const value = item?.querySelector<HTMLElement>('[data-setting-value]');
    if (!item || !value) return;

    const state = this.#getSettingState(setting);
    if (!state) {
      item.removeAttribute('data-availability');
      if (!item.hasAttribute('disabled')) item.removeAttribute('aria-disabled');
      if (value.textContent) value.textContent = '';
      return;
    }

    item.setAttribute('data-availability', state.availability);
    if (state.availability === 'unavailable') {
      item.setAttribute('aria-disabled', 'true');
    } else if (!item.hasAttribute('disabled')) {
      item.removeAttribute('aria-disabled');
    }

    if (!this.#i18n) return;
    const label = translateText(state.label, this.#i18n.value, state.labelParams);
    if (value.textContent !== label) value.textContent = label;
  }

  #getSettingState(setting: VideoMenuSetting): VideoMenuSettingState | undefined {
    if (setting === 'playback-rate') {
      const media = this.#media?.value;
      if (!media?.playbackRates) return;
      this.#playbackRateCore.setMedia(media as MediaPlaybackRateState);
      const state = this.#playbackRateCore.getState();
      return {
        label: this.#playbackRateCore.getRateLabel(state.rate),
        availability: state.availability,
      };
    }

    if (setting === 'quality') {
      const media = this.#media?.value;
      if (!media?.videoRenditionList) return;
      this.#qualityCore.setMedia(media as MediaQualityState);
      const state = this.#qualityCore.getState();

      if (state.value === QUALITY_AUTO_VALUE) {
        return {
          label: state.autoLabel,
          labelParams: state.autoLabelParams,
          availability: state.availability,
        };
      }

      return {
        label: state.renditions.find((rendition) => rendition.value === state.value)?.label ?? autoText,
        availability: state.availability,
      };
    }

    if (setting === 'audio-track') {
      const media = this.#media?.value;
      if (!media?.audioTrackList) return;
      this.#audioTrackCore.setMedia(media as MediaAudioTrackState);
      const state = this.#audioTrackCore.getState();
      return {
        label: state.tracks.find((track) => track.value === state.value)?.label ?? '',
        availability: state.availability,
      };
    }

    const media = this.#media?.value;
    if (!media?.textTrackList) return;
    this.#captionsCore.setMedia(media as MediaTextTrackState);
    const state = this.#captionsCore.getState();

    if (state.value === CAPTIONS_OFF_VALUE) {
      return { label: offText, availability: state.availability };
    }

    return {
      label: state.tracks.find((track) => track.value === state.value)?.label ?? offText,
      availability: state.availability,
    };
  }
}

export function installVideoMenuSettings(host: VideoSkinHost): void {
  new VideoMenuSettingsController(host);
}
