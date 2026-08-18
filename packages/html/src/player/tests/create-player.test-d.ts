import {
  type AudioPlayerStore,
  audioFeatures,
  backgroundFeatures,
  definePlayerFeature,
  features,
  metadataFeature,
  type PlayerStore,
  type PlayerTarget,
  type VideoPlayerStore,
  videoFeatures,
} from '@videojs/core/dom';
import type { Slice } from '@videojs/store';
import { assertType, describe, it } from 'vitest';

import type { MediaElement } from '../../ui/media-element';
import { type CreatePlayerResult, createPlayer } from '../create-player';
import type { PlayerController } from '../player-controller';

describe('createPlayer', () => {
  it('resolves video features to VideoPlayerStore', () => {
    const result = createPlayer({ features: videoFeatures });

    assertType<CreatePlayerResult<VideoPlayerStore>>(result);
    // @ts-expect-error ContainerMixin is no longer part of the HTML API.
    result.ContainerMixin;
    assertType<typeof result.PlayerElement>(result.ProviderMixin(null as unknown as typeof MediaElement));
    // @ts-expect-error Use PlayerElement.
    result.Player;
    assertType<typeof result.playerContext>(result.context);
    // @ts-expect-error The player element owns its store.
    result.create;
  });

  it('resolves audio features to AudioPlayerStore', () => {
    const result = createPlayer({ features: audioFeatures });
    const store = new result.PlayerElement().store;

    assertType<CreatePlayerResult<AudioPlayerStore>>(result);
    assertType<number | undefined>(store.error?.code);
    assertType<string | undefined>(store.error?.message);
    assertType<() => void>(store.dismissError);
  });

  it('resolves custom features to generic PlayerStore', () => {
    interface CustomState {
      custom: boolean;
    }

    const customFeature = definePlayerFeature({
      state: (): CustomState => ({ custom: true }),
    });
    const result = createPlayer({ features: [customFeature] });

    assertType<CreatePlayerResult<PlayerStore<[Slice<PlayerTarget, CustomState>]>>>(result);
  });

  it('infers config properties from selected features', () => {
    const withMetadata = createPlayer({ features: [metadataFeature] });
    const withoutMetadata = createPlayer({ features: [features.playback] });
    const metadataPlayer = new withMetadata.PlayerElement();
    const plainPlayer = new withoutMetadata.PlayerElement();

    assertType<string | null | undefined>(metadataPlayer.contentTitle);
    assertType<string | null | undefined>(metadataPlayer.defaultContentTitle);

    // @ts-expect-error metadata properties are absent when the feature is absent.
    plainPlayer.contentTitle;
  });

  it('returns a controller already bound to the player context', () => {
    const { PlayerController } = createPlayer({ features: videoFeatures });
    const host = null as unknown as MediaElement;

    assertType<PlayerController<VideoPlayerStore>>(new PlayerController(host));
    assertType<PlayerController<VideoPlayerStore, boolean>>(new PlayerController(host, (state) => state.paused));
  });

  it('accepts the orientation lock feature alias with and without config', () => {
    const configuredOrientationLock = features.orientationLock({ type: 'portrait' });
    const defaultResult = createPlayer({ features: [features.orientationLock] });
    const configuredResult = createPlayer({ features: [configuredOrientationLock] });

    assertType<CreatePlayerResult<PlayerStore<[typeof features.orientationLock]>>>(defaultResult);
    assertType<CreatePlayerResult<PlayerStore<[typeof configuredOrientationLock]>>>(configuredResult);
  });

  it('resolves extended video and audio features to generic stores', () => {
    interface AnalyticsState {
      events: string[];
    }

    const analyticsFeature = definePlayerFeature({
      state: (): AnalyticsState => ({ events: [] }),
    });
    const videoResult = createPlayer({ features: [...videoFeatures, analyticsFeature] });
    const audioResult = createPlayer({ features: [...audioFeatures, analyticsFeature] });

    assertType<CreatePlayerResult<PlayerStore<[...typeof videoFeatures, typeof analyticsFeature]>>>(videoResult);
    assertType<boolean>(new videoResult.PlayerElement().store.paused);
    assertType<string[]>(new audioResult.PlayerElement().store.events);
  });

  it('resolves background features to generic PlayerStore', () => {
    const result = createPlayer({ features: backgroundFeatures });

    assertType<CreatePlayerResult<PlayerStore<[]>>>(result);
  });
});
