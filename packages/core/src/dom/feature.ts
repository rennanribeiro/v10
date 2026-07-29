import type { EmptyObject } from '@videojs/utils/types';
import type { PlayerFeature } from './player';

/**
 * Defines a player feature: a store slice scoped to {@link PlayerTarget}, plus
 * optional declarations for fields the developer can set on the provider.
 *
 * @param config - The feature's state, derived values, attach behaviour, and
 *   provider prop declarations.
 */
export function definePlayerFeature<State, Derived = EmptyObject, ProviderProps = EmptyObject>(
  config: PlayerFeature<State, Derived, ProviderProps>
): PlayerFeature<State, Derived, ProviderProps> {
  return config;
}
