import { defineMediaCapability } from '../capability';
import type { MediaVolumeCapability } from '../types';

/**
 * Volume forwarding.
 *
 * Compose this only into hosts whose media can honor a volume level or a mute. A host that leaves it out has no
 * `volume`, `muted`, or `defaultMuted` at all, so `isMediaVolumeCapable` reports it honestly and the player's volume
 * feature never attaches.
 */
export const volumeCapability = defineMediaCapability<MediaVolumeCapability>()({
  name: 'volume',
  events: ['volumechange'],
  props: {
    volume: { fallback: 1 },
    muted: { fallback: false },
    defaultMuted: { fallback: false },
  },
});
