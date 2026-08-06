import type { MediaContentValue, MediaMetadataState } from '@videojs/media';
import { isMediaContentDataCapable } from '@videojs/media';
import { listen } from '@videojs/utils/dom';
import { definePlayerFeature } from '../../feature';
import type { PlayerFeatureConfig } from '../../player';

const MEDIA_CONTENT_TITLE = Symbol('@videojs/media-content-title');
const USER_CONTENT_TITLE = Symbol('@videojs/user-content-title');
const USER_DEFAULT_CONTENT_TITLE = Symbol('@videojs/user-default-content-title');
const SET_USER_CONTENT_TITLE = Symbol('@videojs/set-user-content-title');
const SET_USER_DEFAULT_CONTENT_TITLE = Symbol('@videojs/set-user-default-content-title');
const DEFAULT_CONTENT_TITLE = '';

const MEDIA_CONTENT_POSTER = Symbol('@videojs/media-content-poster');
const USER_CONTENT_POSTER = Symbol('@videojs/user-content-poster');
const USER_DEFAULT_CONTENT_POSTER = Symbol('@videojs/user-default-content-poster');
const SET_USER_CONTENT_POSTER = Symbol('@videojs/set-user-content-poster');
const SET_USER_DEFAULT_CONTENT_POSTER = Symbol('@videojs/set-user-default-content-poster');
const DEFAULT_CONTENT_POSTER = '';

interface MetadataSourceState extends Omit<MediaMetadataState, 'contentTitle' | 'contentPoster'> {
  [MEDIA_CONTENT_TITLE]: MediaContentValue;
  [USER_CONTENT_TITLE]: MediaContentValue;
  [USER_DEFAULT_CONTENT_TITLE]: MediaContentValue;
  [SET_USER_CONTENT_TITLE](value: MediaContentValue): void;
  [SET_USER_DEFAULT_CONTENT_TITLE](value: MediaContentValue): void;
  [MEDIA_CONTENT_POSTER]: MediaContentValue;
  [USER_CONTENT_POSTER]: MediaContentValue;
  [USER_DEFAULT_CONTENT_POSTER]: MediaContentValue;
  [SET_USER_CONTENT_POSTER](value: MediaContentValue): void;
  [SET_USER_DEFAULT_CONTENT_POSTER](value: MediaContentValue): void;
}

/**
 * Resolves user, media, and fallback content metadata into player state.
 * Included in the standard audio, video, and live presets.
 */
export const metadataFeature = definePlayerFeature({
  name: 'metadata',
  config: {
    contentTitle: {
      action: SET_USER_CONTENT_TITLE,
      state: USER_CONTENT_TITLE,
    },
    defaultContentTitle: {
      action: SET_USER_DEFAULT_CONTENT_TITLE,
      state: USER_DEFAULT_CONTENT_TITLE,
    },
    contentPoster: {
      action: SET_USER_CONTENT_POSTER,
      state: USER_CONTENT_POSTER,
    },
    defaultContentPoster: {
      action: SET_USER_DEFAULT_CONTENT_POSTER,
      state: USER_DEFAULT_CONTENT_POSTER,
    },
  } satisfies PlayerFeatureConfig<MetadataSourceState>,
  state: ({ set }): MetadataSourceState => ({
    [MEDIA_CONTENT_TITLE]: undefined,
    [USER_CONTENT_TITLE]: undefined,
    [USER_DEFAULT_CONTENT_TITLE]: undefined,
    [SET_USER_CONTENT_TITLE]: (value) => set({ [USER_CONTENT_TITLE]: value }),
    [SET_USER_DEFAULT_CONTENT_TITLE]: (value) => set({ [USER_DEFAULT_CONTENT_TITLE]: value }),
    [MEDIA_CONTENT_POSTER]: undefined,
    [USER_CONTENT_POSTER]: undefined,
    [USER_DEFAULT_CONTENT_POSTER]: undefined,
    [SET_USER_CONTENT_POSTER]: (value) => set({ [USER_CONTENT_POSTER]: value }),
    [SET_USER_DEFAULT_CONTENT_POSTER]: (value) => set({ [USER_DEFAULT_CONTENT_POSTER]: value }),
    setContentTitle: (value) => set({ [USER_CONTENT_TITLE]: value }),
    setDefaultContentTitle: (value) => set({ [USER_DEFAULT_CONTENT_TITLE]: value }),
    setContentPoster: (value) => set({ [USER_CONTENT_POSTER]: value }),
    setDefaultContentPoster: (value) => set({ [USER_DEFAULT_CONTENT_POSTER]: value }),
  }),
  derived: {
    contentTitle: ({ get }) =>
      get()[USER_CONTENT_TITLE] ??
      get()[MEDIA_CONTENT_TITLE] ??
      get()[USER_DEFAULT_CONTENT_TITLE] ??
      DEFAULT_CONTENT_TITLE,
    contentPoster: ({ get }) =>
      get()[USER_CONTENT_POSTER] ??
      get()[MEDIA_CONTENT_POSTER] ??
      get()[USER_DEFAULT_CONTENT_POSTER] ??
      DEFAULT_CONTENT_POSTER,
  },
  attach({ target, signal, set }) {
    const { media } = target;

    if (!isMediaContentDataCapable(media)) return;

    const sync = () =>
      set({
        [MEDIA_CONTENT_TITLE]: media.contentData?.title,
        [MEDIA_CONTENT_POSTER]: media.contentData?.poster,
      });
    sync();
    listen(media, 'contentdatachange', sync, { signal });
  },
});
