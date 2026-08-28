import { isFunction, isObject, isUndefined } from '@videojs/utils/predicate';

import { EMPTY_REMOTE, EMPTY_TEXT_TRACKS, EMPTY_TIME_RANGES } from './constants';
import type {
  MediaAudioTrackCapability,
  MediaBufferCapability,
  MediaContentDataCapability,
  MediaErrorCapability,
  MediaLiveCapability,
  MediaPauseCapability,
  MediaPictureInPictureCapability,
  MediaPlaybackRateCapability,
  MediaRemotePlaybackCapability,
  MediaSeekCapability,
  MediaSourceCapability,
  MediaStreamTypeCapability,
  MediaTextTrackCapability,
  MediaVideoDimensionsCapability,
  MediaVideoRenditionCapability,
  MediaVolumeCapability,
} from './types';

export function hasMetadata(media: MediaSourceCapability): boolean {
  return media.readyState >= 1;
}

/*
 * A media declares a capability by carrying its members, so these ask whether the member is there rather than what it
 * currently holds. A value is state — `paused` is `true` before playback, `error` is `null` without one — and reading
 * state as support made any media that had not started look incapable.
 *
 * Two things are still read as values rather than presence: the `EMPTY_*` constants, which a media returns to say it
 * has none of something it could otherwise report, and `contentData`, whose contract gives `undefined` that meaning.
 */

export function isMediaPauseCapable(value: unknown): value is MediaPauseCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return 'paused' in media && 'ended' in media && isFunction(media.pause);
}

export function isMediaSeekCapable(value: unknown): value is MediaSeekCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return 'currentTime' in media && 'duration' in media && 'seeking' in media;
}

export function isMediaSourceCapable(value: unknown): value is MediaSourceCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return 'src' in media && 'currentSrc' in media && 'readyState' in media && isFunction(media.load);
}

export function isMediaVolumeCapable(value: unknown): value is MediaVolumeCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return 'volume' in media && 'muted' in media;
}

/**
 * Whether the media reports a mute at all, which is a narrower question than `isMediaVolumeCapable`: an embed can take
 * a mute command while offering no way to set a level.
 */
export function isMediaMutedCapable(value: unknown): value is Pick<MediaVolumeCapability, 'muted'> {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return 'muted' in media;
}

export function isMediaPlaybackRateCapable(value: unknown): value is MediaPlaybackRateCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return 'playbackRate' in media;
}

/**
 * Only `requestPictureInPicture` is required. A native video element carries it but leaves exiting to `document`, so
 * demanding the pair would rule out the one media that most certainly can.
 */
export function isMediaPictureInPictureCapable(value: unknown): value is MediaPictureInPictureCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return isFunction(media.requestPictureInPicture);
}

export function isMediaBufferCapable(value: unknown): value is MediaBufferCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return (
    'buffered' in media &&
    media.buffered !== EMPTY_TIME_RANGES &&
    'seekable' in media &&
    media.seekable !== EMPTY_TIME_RANGES
  );
}

export function isMediaErrorCapable(value: unknown): value is MediaErrorCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return 'error' in media;
}

export function isMediaTextTrackCapable(value: unknown): value is MediaTextTrackCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return 'textTracks' in media && media.textTracks !== EMPTY_TEXT_TRACKS;
}

export function isMediaVideoRenditionCapable(value: unknown): value is MediaVideoRenditionCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return 'videoRenditions' in media;
}

export function isMediaAudioTrackCapable(value: unknown): value is MediaAudioTrackCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return 'audioTracks' in media;
}

export function isMediaVideoDimensionsCapable(value: unknown): value is MediaVideoDimensionsCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return 'videoWidth' in media && 'videoHeight' in media;
}

export function isMediaRemotePlaybackCapable(value: unknown): value is MediaRemotePlaybackCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return isObject(media.remote) && media.remote !== EMPTY_REMOTE;
}

export function isMediaStreamTypeCapable(value: unknown): value is MediaStreamTypeCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return 'streamType' in media;
}

/**
 * The exception to the rule above: `undefined` is a value {@link MediaContentDataCapability} gives meaning to, not an
 * absent member. A host composing the capability always carries `contentData`, and reports `undefined` for a media that
 * does not report metadata, so presence answers a question nobody asked.
 */
export function isMediaContentDataCapable(value: unknown): value is MediaContentDataCapability {
  if (!isObject(value)) return false;

  return !isUndefined((value as Record<string, unknown>).contentData);
}

export function isMediaLiveCapable(value: unknown): value is MediaLiveCapability {
  if (!isObject(value)) return false;

  const media = value as Record<string, unknown>;

  return 'liveEdgeStart' in media && 'targetLiveWindow' in media;
}

/** Framework-agnostic `NodeList`-like shape returned by `querySelectorAll`. */
export interface NodeListLike<Element> {
  readonly length: number;
  readonly [index: number]: Element;
  item(index: number): Element | null;
  [Symbol.iterator](): Iterator<Element>;
}

export function isQuerySelectorAllCapable<Element = unknown>(
  value: unknown
): value is { querySelectorAll: (selectors: string) => NodeListLike<Element> } {
  return (
    isObject(value) && 'querySelectorAll' in value && isFunction((value as Record<string, unknown>).querySelectorAll)
  );
}
