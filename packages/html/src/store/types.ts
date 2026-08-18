import type { InferPlayerConfig, PlayerStore } from '@videojs/core/dom';
import type { Constructor } from '@videojs/utils/types';
import type { UIElement } from '@/ui/ui-element';

// ----------------------------------------
// PlayerElement
// ----------------------------------------

type PlayerProperties<Store extends PlayerStore> = {
  -readonly [Key in keyof InferPlayerConfig<Store>]?: InferPlayerConfig<Store>[Key] | undefined;
};

export type PlayerElement<Store extends PlayerStore> = UIElement &
  PlayerProperties<Store> & {
    readonly store: Store;
  };

export type PlayerElementConstructor<Store extends PlayerStore> = typeof UIElement & Constructor<PlayerElement<Store>>;
