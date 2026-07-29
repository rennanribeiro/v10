import {
  type AudioPlayerStore,
  audioFeatures,
  definePlayerFeature,
  features,
  type PlayerStore,
  type PlayerTarget,
  type VideoPlayerStore,
  videoFeatures,
} from '@videojs/core/dom';
import type { Slice } from '@videojs/store';
import type { ReactNode } from 'react';
import { assertType, describe, it } from 'vitest';

import { type CreatePlayerResult, createPlayer } from '../create-player';

describe('createPlayer', () => {
  it('resolves video features to VideoPlayerStore', () => {
    const result = createPlayer({ features: videoFeatures });

    assertType<CreatePlayerResult<VideoPlayerStore>>(result);
  });

  it('resolves audio features to AudioPlayerStore', () => {
    const result = createPlayer({ features: audioFeatures });

    assertType<CreatePlayerResult<AudioPlayerStore>>(result);
  });

  it('resolves spread video features to VideoPlayerStore', () => {
    const result = createPlayer({ features: videoFeatures });

    assertType<CreatePlayerResult<VideoPlayerStore>>(result);
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

  it('accepts the orientation lock feature alias', () => {
    const result = createPlayer({ features: [features.orientationLock] });

    assertType<CreatePlayerResult<PlayerStore<[typeof features.orientationLock]>>>(result);
  });

  it('resolves extended video features to generic PlayerStore', () => {
    interface AnalyticsState {
      events: string[];
    }

    const analyticsFeature = definePlayerFeature({
      state: (): AnalyticsState => ({ events: [] }),
    });

    const result = createPlayer({
      features: [...videoFeatures, analyticsFeature],
    });

    // Extended features fall through to the generic overload
    assertType<CreatePlayerResult<PlayerStore<[...typeof videoFeatures, typeof analyticsFeature]>>>(result);
  });

  it('resolves extended audio features to generic PlayerStore', () => {
    interface AnalyticsState {
      events: string[];
    }

    const analyticsFeature = definePlayerFeature({
      state: (): AnalyticsState => ({ events: [] }),
    });

    const result = createPlayer({
      features: [...audioFeatures, analyticsFeature],
    });

    assertType<CreatePlayerResult<PlayerStore<[...typeof audioFeatures, typeof analyticsFeature]>>>(result);
  });
});

describe('Provider props are gated on composition', () => {
  it('accepts declared props when the owning feature is composed', () => {
    const { Provider } = createPlayer({ features: videoFeatures });

    assertType<ReactNode>(
      <Provider contentTitle="A title" contentPoster="poster.jpg" contentPosterAlt="A description">
        {null}
      </Provider>
    );
  });

  it('accepts both the override and the fallback for every field', () => {
    const { Provider } = createPlayer({ features: videoFeatures });

    assertType<ReactNode>(
      <Provider
        defaultContentTitle="A fallback title"
        defaultContentPoster="fallback.jpg"
        defaultContentPosterAlt="A fallback description"
      >
        {null}
      </Provider>
    );
  });

  it('accepts null, since removing an HTML attribute yields null', () => {
    const { Provider } = createPlayer({ features: videoFeatures });

    assertType<ReactNode>(<Provider contentTitle={null}>{null}</Provider>);
  });

  it('rejects a declared prop when its feature is absent', () => {
    // This assertion is the entire point of the design: a prop must not exist
    // when the feature that declares it is not composed.
    const { Provider } = createPlayer({ features: [features.playback] });

    assertType<ReactNode>(
      // @ts-expect-error — contentMetadataFeature is not composed
      <Provider contentTitle="A title">{null}</Provider>
    );
  });

  it('rejects a prop no feature declares', () => {
    const { Provider } = createPlayer({ features: videoFeatures });

    assertType<ReactNode>(
      // @ts-expect-error — no feature declares `nonsense`
      <Provider nonsense="value">{null}</Provider>
    );
  });
});

describe('store state types', () => {
  it('exposes resolved content metadata as readonly strings', () => {
    const { usePlayer } = createPlayer({ features: videoFeatures });
    const store = usePlayer();

    assertType<string>(store.contentTitle);
    assertType<string>(store.contentPoster);
    assertType<string>(store.contentPosterAlt);
  });

  it('marks derived keys readonly on the store', () => {
    const { usePlayer } = createPlayer({ features: videoFeatures });
    const store = usePlayer();

    // Regression test for the readonly marking surviving `BaseStore`'s
    // `[key: string]: unknown` index signature.
    // @ts-expect-error — contentTitle is derived, so the formula is its only writer
    store.contentTitle = 'nope';
  });

  it('exposes the imperative setters', () => {
    const { usePlayer } = createPlayer({ features: videoFeatures });
    const store = usePlayer();

    assertType<void>(store.setContentTitle('A title'));
    assertType<void>(store.setDefaultContentTitle(null));
    assertType<void>(store.setContentPoster(undefined));
  });
});
