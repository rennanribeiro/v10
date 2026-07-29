import type { PlayerStore } from '@videojs/core/dom';
import type { Constructor, EmptyObject } from '@videojs/utils/types';
import type { MediaElement } from '@/ui/media-element';

// ----------------------------------------
// PlayerProvider
// ----------------------------------------

export interface PlayerProvider<Store extends PlayerStore> extends MediaElement {
  readonly store: Store;
}

/**
 * `Props` carries the fields declared by the composed features, so a provider
 * element's type gains an instance property only when the feature that declares
 * it is present. They are declared in types but never written as real class
 * fields — `ReactiveElement` installs them on the prototype at runtime.
 */
export interface PlayerProviderConstructor<Store extends PlayerStore, Props = EmptyObject>
  extends Constructor<PlayerProvider<Store> & Props> {}

// ----------------------------------------
// PlayerConsumer
// ----------------------------------------

export interface PlayerConsumer<Store extends PlayerStore> extends MediaElement {
  readonly store: Store | null;
}

export interface PlayerConsumerConstructor<Store extends PlayerStore> extends Constructor<PlayerConsumer<Store>> {}
