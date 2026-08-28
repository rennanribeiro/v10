import { defineMediaCapability } from '../capability';
import type { MediaSourceCapability } from '../types';

/** Loading a source. */
export const sourceCapability = defineMediaCapability<MediaSourceCapability>()({
  name: 'source',
  events: ['loadstart', 'emptied', 'canplay', 'canplaythrough', 'loadeddata', 'abort', 'stalled', 'suspend'],
  props: {
    src: { fallback: '' },
    currentSrc: { fallback: '', readonly: true },
    readyState: { fallback: 0, readonly: true },
    preload: { fallback: 'metadata' },
    crossOrigin: { fallback: null },
  },
  methods: {
    load: { fallback: () => undefined },
    canPlayType: { fallback: () => '' },
  },
});
