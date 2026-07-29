'use client';

import {
  type AnyPlayerFeature,
  type AnyPlayerStore,
  type AudioFeatures,
  type AudioPlayerStore,
  assertNoProviderPropCollisions,
  collectProviderProps,
  createPopupGroup,
  type PlayerStore,
  type PlayerTarget,
  type UnionProviderProps,
  type VideoFeatures,
  type VideoPlayerStore,
  writeProviderProps,
} from '@videojs/core/dom';
import type { Media } from '@videojs/media/dom';
import type { InferStoreState } from '@videojs/store';
import { combine, createStore } from '@videojs/store';
import { useStore } from '@videojs/store/react';
import type { FC, ReactNode } from 'react';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { useDestroy } from '../utils/use-destroy';
import { Container } from './container';
import { PlayerContextProvider, useMedia, usePlayerContext } from './context';

export interface CreatePlayerConfig<Features extends AnyPlayerFeature[]> {
  features: Features;
  displayName?: string;
}

/**
 * Props every provider accepts, plus one per field declared by the composed
 * features — so a prop exists only when the feature that owns it is composed.
 */
export type ProviderProps<Features extends AnyPlayerFeature[] = AnyPlayerFeature[]> = UnionProviderProps<Features> & {
  children: ReactNode;
};

export interface CreatePlayerResult<
  Store extends PlayerStore,
  Features extends AnyPlayerFeature[] = AnyPlayerFeature[],
> {
  Provider: FC<ProviderProps<Features>>;
  Container: typeof Container;
  usePlayer: UsePlayerHook<Store>;
  useMedia: () => Media | null;
}

export type UsePlayerHook<Store extends PlayerStore> = {
  (): Store;
  <R>(selector: (state: InferStoreState<Store>) => R): R;
};

/**
 * Create a player instance with typed store, Provider component, Container, and hooks.
 *
 * @label Video
 * @param config - Player configuration with features and optional display name.
 */
export function createPlayer(
  config: CreatePlayerConfig<VideoFeatures>
): CreatePlayerResult<VideoPlayerStore, VideoFeatures>;

/**
 * Create a player for audio media.
 *
 * @label Audio
 * @param config - Player configuration with features and optional display name.
 */
export function createPlayer(
  config: CreatePlayerConfig<AudioFeatures>
): CreatePlayerResult<AudioPlayerStore, AudioFeatures>;

/**
 * Create a player with custom features.
 *
 * @label Generic
 * @param config - Player configuration with features and optional display name.
 */
export function createPlayer<const Features extends AnyPlayerFeature[]>(
  config: CreatePlayerConfig<Features>
): CreatePlayerResult<PlayerStore<Features>, Features>;

export function createPlayer(
  config: CreatePlayerConfig<AnyPlayerFeature[]>
): CreatePlayerResult<AnyPlayerStore, AnyPlayerFeature[]> {
  // Collected once at factory scope: the feature list is fixed by the time
  // `createPlayer` runs, so there is nothing to recompute per mount.
  const providerProps = collectProviderProps(config.features);

  if (__DEV__) {
    assertNoProviderPropCollisions(providerProps);
  }

  // Defined out here rather than inside the component so the attach effect below
  // can reference it without taking a per-render binding as a dependency.
  const createPlayerStore = () => createStore<PlayerTarget>()(combine(...config.features));

  function Provider({ children, ...props }: ProviderProps): ReactNode {
    const readProp = (name: string) => (props as Record<string, unknown>)[name];

    // Seeded during construction rather than written during render. The store
    // built here has no subscribers yet, so a render React throws away — a
    // sibling suspending, a transition abandoned — discards the store along with
    // the seeded values. Seeding still happens during render, including on the
    // server, so server HTML carries the right values and there is no hydration
    // flash.
    const [store, setStore] = useState(() => {
      const created = createPlayerStore();
      if (providerProps.size) writeProviderProps(created as never, providerProps, readProp);
      return created;
    });
    const [popupGroup] = useState(() => createPopupGroup());
    const [media, setMedia] = useState<Media | null>(null);
    const [container, setContainer] = useState<HTMLElement | null>(null);

    useDestroy(store);

    // Later prop changes go through a layout effect, not the render body: a
    // committed consumer must never observe a value written by a render that
    // never committed. The cost is that on the render where a prop changes,
    // children render the stale value first — children render and run their
    // layout effects before the parent's. Nothing flashes, because
    // `scheduleFlush` drains its microtask before paint. A passive effect would
    // be worse: it permits a paint in between, turning an invisible stale pass
    // into a visible one-frame flash of the old value.
    //
    // Called unconditionally, including during a server render, where React warns
    // about `useLayoutEffect`. That warning is about the call being made, not
    // about this design: seeding covers the server, and a server render happens
    // once, so there are no later changes to miss.
    useLayoutEffect(() => {
      if (!providerProps.size || store.destroyed) return;
      writeProviderProps(store as never, providerProps, readProp);
    });

    useEffect(() => {
      if (!media) return;

      // The store may have been destroyed during an asynchronous gap between React
      // effect cleanup and re-setup (e.g., React <Activity> hide → reveal). The
      // useState initializer does not re-run in this case.
      // Not seeded here: replacing the store re-renders, and the layout effect
      // above then writes the current props into it before the browser paints.
      if (store.destroyed) {
        setStore(createPlayerStore);
        return;
      }

      return store.attach({ media, container });
    }, [media, container, store]);

    const value = useMemo(
      () => ({ store, media, setMedia, container, setContainer, popupGroup }),
      [store, media, container, popupGroup]
    );

    return <PlayerContextProvider value={value}>{children}</PlayerContextProvider>;
  }

  if (__DEV__ && config.displayName) {
    Provider.displayName = `${config.displayName}.Provider`;
  }

  function usePlayer<R>(selector?: (state: object) => R): AnyPlayerStore | R {
    const { store } = usePlayerContext();
    return useStore(store, selector as any);
  }

  return {
    Provider,
    Container,
    usePlayer,
    useMedia,
  };
}
