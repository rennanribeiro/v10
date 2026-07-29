import type {
  Media,
  MediaAudioTrackState,
  MediaBufferState,
  MediaControlsState,
  MediaErrorState,
  MediaFullscreenState,
  MediaLiveState,
  MediaPictureInPictureState,
  MediaPlaybackRateState,
  MediaPlaybackState,
  MediaQualityState,
  MediaRemotePlaybackState,
  MediaSourceState,
  MediaTextTrackState,
  MediaTimeState,
  MediaVolumeState,
} from '@videojs/media';
import type { SliceConfig, Store, UnionSliceState } from '@videojs/store';
import type { EmptyObject } from '@videojs/utils/types';
import type { ProviderPropDeclarations } from './provider-props';
// Type-only import, so the cycle back through `feature.ts` has no runtime edge.
import type {
  ContentMetadataDerived,
  ContentMetadataProviderProps,
  ContentMetadataSource,
} from './store/features/content-metadata';

export interface MediaContainer extends HTMLElement {}

export interface PlayerTarget {
  media: Media;
  container: MediaContainer | null;
}

/**
 * A store slice scoped to a player, optionally declaring fields the developer
 * can set on the provider.
 *
 * `Derived` and `ProviderProps` both default to `{}`, so every existing
 * `PlayerFeature<SomeState>` keeps compiling untouched.
 */
export interface PlayerFeature<State, Derived = EmptyObject, ProviderProps = EmptyObject>
  extends SliceConfig<PlayerTarget, State, Derived> {
  /**
   * Fields this feature exposes on the player provider, as props in React and
   * attributes in HTML.
   *
   * Named `providerProps` rather than `config`: "config" is already taken three
   * times over in this codebase — store lifecycle callbacks, the media host's
   * config bag, and the feature-configuration path this replaces.
   */
  providerProps?: ProviderPropDeclarations<State, ProviderProps>;
}

export type AnyPlayerFeature = PlayerFeature<any, any, any>;

export type PlayerStore<Features extends AnyPlayerFeature[] = []> = Store<PlayerTarget, UnionSliceState<Features>>;

export type AnyPlayerStore = Store<PlayerTarget, object>;

// ----------------------------------------
// Feature Presets
// ----------------------------------------

export type VideoFeatures = [
  PlayerFeature<MediaPlaybackState>,
  PlayerFeature<MediaPlaybackRateState>,
  PlayerFeature<MediaQualityState>,
  PlayerFeature<MediaAudioTrackState>,
  PlayerFeature<MediaVolumeState>,
  PlayerFeature<MediaTimeState>,
  PlayerFeature<MediaSourceState>,
  PlayerFeature<MediaBufferState>,
  PlayerFeature<MediaFullscreenState>,
  PlayerFeature<MediaPictureInPictureState>,
  PlayerFeature<MediaRemotePlaybackState>,
  PlayerFeature<MediaControlsState>,
  PlayerFeature<MediaTextTrackState>,
  PlayerFeature<MediaErrorState>,
  PlayerFeature<ContentMetadataSource, ContentMetadataDerived, ContentMetadataProviderProps>,
];

export type AudioFeatures = [
  PlayerFeature<MediaPlaybackState>,
  PlayerFeature<MediaPlaybackRateState>,
  PlayerFeature<MediaVolumeState>,
  PlayerFeature<MediaTimeState>,
  PlayerFeature<MediaSourceState>,
  PlayerFeature<MediaBufferState>,
  PlayerFeature<MediaErrorState>,
  PlayerFeature<ContentMetadataSource, ContentMetadataDerived, ContentMetadataProviderProps>,
];

// TODO: Define background video features (e.g., playback, source, buffer)
export type BackgroundFeatures = [];

/**
 * Features for a live video player. Mirrors {@link VideoFeatures} but drops
 * the playback-rate feature (not meaningful for live) and adds
 * `PlayerFeature<MediaLiveState>` so the store exposes `liveEdgeStart` and
 * `targetLiveWindow`.
 */
export type LiveVideoFeatures = [
  PlayerFeature<MediaPlaybackState>,
  PlayerFeature<MediaVolumeState>,
  PlayerFeature<MediaTimeState>,
  PlayerFeature<MediaSourceState>,
  PlayerFeature<MediaBufferState>,
  PlayerFeature<MediaFullscreenState>,
  PlayerFeature<MediaPictureInPictureState>,
  PlayerFeature<MediaRemotePlaybackState>,
  PlayerFeature<MediaControlsState>,
  PlayerFeature<MediaTextTrackState>,
  PlayerFeature<MediaErrorState>,
  PlayerFeature<MediaLiveState>,
  PlayerFeature<ContentMetadataSource, ContentMetadataDerived, ContentMetadataProviderProps>,
];

/**
 * Features for a live audio player. Mirrors {@link AudioFeatures} but drops
 * the playback-rate feature (not meaningful for live) and adds
 * `PlayerFeature<MediaLiveState>` so the store exposes `liveEdgeStart` and
 * `targetLiveWindow`.
 */
export type LiveAudioFeatures = [
  PlayerFeature<MediaPlaybackState>,
  PlayerFeature<MediaVolumeState>,
  PlayerFeature<MediaTimeState>,
  PlayerFeature<MediaSourceState>,
  PlayerFeature<MediaBufferState>,
  PlayerFeature<MediaErrorState>,
  PlayerFeature<MediaLiveState>,
  PlayerFeature<ContentMetadataSource, ContentMetadataDerived, ContentMetadataProviderProps>,
];

export type VideoPlayerStore = PlayerStore<VideoFeatures>;

export type AudioPlayerStore = PlayerStore<AudioFeatures>;

export type BackgroundPlayerStore = PlayerStore<BackgroundFeatures>;

export type LiveVideoPlayerStore = PlayerStore<LiveVideoFeatures>;

export type LiveAudioPlayerStore = PlayerStore<LiveAudioFeatures>;
