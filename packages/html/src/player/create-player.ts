import type {
  AnyPlayerFeature,
  AudioFeatures,
  AudioPlayerStore,
  PlayerStore,
  PlayerTarget,
  UnionProviderProps,
  VideoFeatures,
  VideoPlayerStore,
} from '@videojs/core/dom';
import { collectProviderProps } from '@videojs/core/dom';
import { combine, createStore } from '@videojs/store';

import { type ContainerMixin, createContainerMixin } from '../store/container-mixin';
import { createProviderMixin, type ProviderMixin } from '../store/provider-mixin';
import { containerContext, mediaContext, type PlayerContext, playerContext } from './context';
import { PlayerController } from './player-controller';

export interface CreatePlayerConfig<Features extends AnyPlayerFeature[]> {
  features: Features;
}

export interface CreatePlayerResult<
  Store extends PlayerStore,
  Features extends AnyPlayerFeature[] = AnyPlayerFeature[],
> {
  /** Context for consuming player in controllers. */
  context: PlayerContext<Store>;

  /** Creates a store instance for imperative access. */
  create: () => Store;

  /** Player controller bound to this player's context. */
  PlayerController: PlayerController.Constructor<Store>;

  /** Mixin that provides player context to descendants. */
  ProviderMixin: ProviderMixin<Store, UnionProviderProps<Features>>;

  /** Mixin that consumes player context and registers as the container element. */
  ContainerMixin: ContainerMixin<Store>;
}

/**
 * Creates a player factory with typed store, mixins, and controller.
 *
 * @example
 * ```ts
 * import { createPlayer, MediaElement, selectPlayback } from '@videojs/html';
 * import { videoFeatures } from '@videojs/html/video';
 *
 * const { ProviderMixin, ContainerMixin, PlayerController, context } = createPlayer({
 *   features: videoFeatures,
 * });
 *
 * // Provider element: owns the store, provides context to descendants
 * class VideoPlayer extends ProviderMixin(MediaElement) {}
 * customElements.define('video-player', VideoPlayer);
 *
 * // Control element with selector
 * class PlayButton extends MediaElement {
 *   #playback = new PlayerController(this, context, selectPlayback);
 * }
 * ```
 *
 * @label Video
 * @param config - Player configuration with features.
 */
export function createPlayer(
  config: CreatePlayerConfig<VideoFeatures>
): CreatePlayerResult<VideoPlayerStore, VideoFeatures>;

/**
 * Creates a player factory for audio media.
 *
 * @label Audio
 * @param config - Player configuration with features.
 */
export function createPlayer(
  config: CreatePlayerConfig<AudioFeatures>
): CreatePlayerResult<AudioPlayerStore, AudioFeatures>;

/**
 * Creates a player factory with custom features.
 *
 * @label Generic
 * @param config - Player configuration with features.
 */
export function createPlayer<const Features extends AnyPlayerFeature[]>(
  config: CreatePlayerConfig<Features>
): CreatePlayerResult<PlayerStore<Features>, Features>;

export function createPlayer(config: CreatePlayerConfig<AnyPlayerFeature[]>): CreatePlayerResult<PlayerStore> {
  const slice = combine<PlayerTarget, AnyPlayerFeature[]>(...config.features);

  // Collected once per `createPlayer`, not per element: the feature list is fixed
  // by the time this runs.
  const providerProps = collectProviderProps(config.features);

  function create(): PlayerStore {
    return createStore<PlayerTarget>()(slice) as PlayerStore;
  }

  const ProviderMixin = createProviderMixin<PlayerStore>({
    playerContext,
    mediaContext,
    containerContext,
    factory: create,
    providerProps,
  });

  const ContainerMixin = createContainerMixin<PlayerStore>({
    playerContext,
    containerContext,
  });

  return {
    context: playerContext,
    create,
    PlayerController,
    ProviderMixin,
    ContainerMixin,
  };
}
