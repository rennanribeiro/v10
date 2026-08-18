import type { InferPlayerConfig, PlayerStore } from '@videojs/core/dom';
import type { Constructor } from '@videojs/utils/types';
import type { MediaElement } from '@/ui/media-element';

// ----------------------------------------
// PlayerElement
// ----------------------------------------

type PlayerProperties<Store extends PlayerStore> = {
  -readonly [Key in keyof InferPlayerConfig<Store>]?: InferPlayerConfig<Store>[Key] | undefined;
};

export type PlayerElement<Store extends PlayerStore> = MediaElement &
  PlayerProperties<Store> & {
    readonly store: Store;
  };

export type PlayerElementConstructor<Store extends PlayerStore> = typeof MediaElement &
  Constructor<PlayerElement<Store>>;

// ----------------------------------------
// PlayerConsumer
// ----------------------------------------

export interface PlayerConsumer<Store extends PlayerStore> extends MediaElement {
  readonly store: Store | null;
}

export interface PlayerConsumerConstructor<Store extends PlayerStore> extends Constructor<PlayerConsumer<Store>> {}
