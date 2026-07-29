import type { ErrorLike, MediaContentValue, MediaFeatureAvailability, MediaStreamType, TextTrackKind } from './types';

export type { TextTrackKind };

export interface MediaPlaybackState {
  /**
   * Whether playback is paused.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/paused
   */
  paused: boolean;
  /**
   * Whether playback has reached the end.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/ended
   */
  ended: boolean;
  /**
   * Whether playback has started (played or seeked).
   */
  started: boolean;
  /**
   * Whether playback is stalled waiting for data.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/waiting_event
   */
  waiting: boolean;
  /**
   * Start playback.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play
   */
  play(): Promise<void>;
  /**
   * Pause playback.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/pause
   */
  pause(): void;
  /** Toggle play/pause. Returns `true` if playback started. */
  togglePaused(): boolean;
}

export interface MediaVolumeState {
  /**
   * Volume level from 0 (silent) to 1 (max).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume
   */
  volume: number;
  /**
   * Whether audio is muted.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/muted
   */
  muted: boolean;
  /**
   * Whether volume can be programmatically set on this platform.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume
   */
  volumeAvailability: MediaFeatureAvailability;
  /**
   * Set volume (clamped 0-1). Returns the clamped value.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume
   */
  setVolume(volume: number): number;
  /**
   * Toggle mute state. Returns the new muted value.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/muted
   */
  toggleMuted(): boolean;
}

export interface MediaTimeState {
  /**
   * Current playback position in seconds.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime
   */
  currentTime: number;
  /**
   * Total duration in seconds (0 if unknown).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/duration
   */
  duration: number;
  /**
   * Whether a seek operation is in progress.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeking
   */
  seeking: boolean;
  /**
   * Seek to a time in seconds. Returns the actual position after seek.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime
   */
  seek(time: number): Promise<number>;
}

export interface MediaSourceState {
  /**
   * Current media source URL (null if none).
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentSrc
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/src
   */
  source: string | null;
  /**
   * Whether enough data is loaded to begin playback.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/readyState
   */
  canPlay: boolean;
  /**
   * Load a new media source. Returns the new source URL.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/src
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/load
   */
  loadSource(src: string): string;
}

export interface MediaStreamTypeState {
  /**
   * Current stream delivery type.
   *
   * Components use this to toggle live-specific UI (e.g. a live indicator,
   * a "jump to live edge" affordance, or hiding the time display).
   *
   * @see {@link MediaStreamTypes} for the canonical string values.
   * @see https://github.com/video-dev/media-ui-extensions/blob/main/proposals/0010-stream-type.md
   */
  streamType: MediaStreamType;
}

export interface MediaLiveState {
  /**
   * Presentation time marking the start of the Live Edge Window.
   *
   * Playing at the live edge when `currentTime >= liveEdgeStart`. `NaN`
   * when the stream isn't live or the value is unknown.
   *
   * @see https://github.com/video-dev/media-ui-extensions/blob/main/proposals/0007-live-edge.md
   */
  liveEdgeStart: number;
  /**
   * Offset representing the seekable range size for live content.
   *
   * `0` for standard latency live, `Infinity` for DVR, `NaN` for on-demand
   * or unknown.
   */
  targetLiveWindow: number;
}

export interface MediaBufferState {
  /**
   * Buffered time ranges as [start, end] tuples.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/buffered
   */
  buffered: [number, number][];
  /**
   * Seekable time ranges as [start, end] tuples.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seekable
   */
  seekable: [number, number][];
}

export interface MediaFullscreenState {
  /**
   * Whether fullscreen mode is currently active.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
   */
  fullscreen: boolean;
  /**
   * Whether fullscreen can be requested on this platform.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/fullscreenEnabled
   */
  fullscreenAvailability: MediaFeatureAvailability;
  /**
   * Enter fullscreen mode. Tries container first, falls back to media element.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen
   */
  requestFullscreen(): Promise<void>;
  /**
   * Exit fullscreen mode.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/exitFullscreen
   */
  exitFullscreen(): Promise<void>;
  /** Toggle fullscreen mode. */
  toggleFullscreen(): Promise<void>;
}

export interface MediaControlsState {
  /** Whether the user has recently interacted with the player. */
  userActive: boolean;
  /** Whether controls should be visible (userActive || paused). */
  controlsVisible: boolean;
  /** Toggle controls visibility. Returns the new `controlsVisible` value. */
  toggleControls(): boolean;
}

export interface MediaPlaybackRateState {
  /**
   * Available playback rates.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate
   */
  readonly playbackRates: readonly number[];
  /**
   * Current playback rate.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate
   */
  playbackRate: number;
  /**
   * Set the playback rate.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate
   */
  setPlaybackRate(rate: number): void;
}

export interface MediaVideoRendition {
  id?: string;
  width?: number;
  height?: number;
  bitrate?: number;
  frameRate?: number;
  codec?: string;
  selected: boolean;
}

export interface MediaQualityState {
  /** Video renditions available for manual quality selection. */
  videoRenditionList: MediaVideoRendition[];
  /** Video rendition currently playing, including when automatic ABR is selected. */
  activeVideoRendition: MediaVideoRendition | null;
  /** Select a video rendition by menu value, or automatic ABR with `"auto"`. */
  selectVideoRendition(value: string): void;
}

export interface MediaAudioTrack {
  id?: string;
  kind?: string;
  label: string;
  language: string;
  enabled: boolean;
}

export interface MediaAudioTrackState {
  /** Audio tracks available for manual track selection. */
  audioTrackList: MediaAudioTrack[];
  /** Select an audio track by menu value. */
  selectAudioTrack(value: string): void;
}

/**
 * A text cue.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/VTTCue
 */
export interface MediaTextCue {
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * The mode of a text track.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/TextTrack/mode
 */
export type TextTrackMode = 'showing' | 'disabled' | 'hidden';

/**
 * A text track.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/TextTrack
 */
export interface MediaTextTrack<Kind extends string = TextTrackKind> {
  id?: string;
  kind: Kind;
  label: string;
  language: string;
  mode: TextTrackMode;
}

export interface MediaTextTrackState {
  /** Cues from the first `kind="chapters"` track. */
  chaptersCues: MediaTextCue[];
  /** Cues from the first `kind="metadata" label="thumbnails"` track. */
  thumbnailCues: MediaTextCue[];
  /** The `<track>` element's `src` for resolving relative cue text URLs. */
  thumbnailTrackSrc: string | null;
  /** All text tracks available on the media element. */
  textTrackList: MediaTextTrack[];
  /** Whether captions/subtitles are currently enabled. */
  subtitlesShowing: boolean;
  /** Toggle captions/subtitles visibility. Returns the new enabled value. */
  toggleSubtitles(forceShow?: boolean): boolean;
  /** Select a captions/subtitles track by menu value, or disable with `"off"`. */
  selectSubtitlesTrack(value: string): void;
}

export interface MediaErrorState {
  /**
   * The current media error, or null if none.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/error
   */
  error: ErrorLike | null;
  /** Dismiss the current error by clearing it. */
  dismissError(): void;
}

export type RemotePlaybackConnectionState = 'disconnected' | 'connecting' | 'connected';

export interface MediaRemotePlaybackState {
  /**
   * Current remote playback connection state.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/RemotePlayback/state
   */
  remotePlaybackState: RemotePlaybackConnectionState;
  /**
   * Whether remote playback can be requested on this platform.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/RemotePlayback
   */
  remotePlaybackAvailability: MediaFeatureAvailability;
  /** Toggle the remote playback connection. */
  toggleRemotePlayback(): Promise<void>;
}

export interface MediaPictureInPictureState {
  /**
   * Whether picture-in-picture mode is currently active.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API
   */
  pip: boolean;
  /**
   * Whether picture-in-picture can be requested on this platform.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/pictureInPictureEnabled
   */
  pipAvailability: MediaFeatureAvailability;
  /**
   * Enter picture-in-picture mode.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestPictureInPicture
   */
  requestPictureInPicture(): Promise<void>;
  /**
   * Exit picture-in-picture mode.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Document/exitPictureInPicture
   */
  exitPictureInPicture(): Promise<void>;
  /** Toggle picture-in-picture mode. */
  togglePictureInPicture(): Promise<void>;
}

/**
 * Content metadata resolved by the player, plus the setters that feed it.
 *
 * `contentTitle`, `contentPoster`, and `contentPosterAlt` are computed from the
 * developer's override, whatever the media reports, and the developer's
 * fallback, in that order. Each is a plain `string`, so consumers never handle a
 * missing value, and an **empty string means "render nothing"** — no title text,
 * no poster element — rather than an element with an empty source. A component
 * piping `contentPoster` straight into `src` must guard, because `<img src="">`
 * requests the current page.
 *
 * The setters come in pairs. `setX` writes the developer's **override**, which
 * beats anything the media reports; `setDefaultX` writes the developer's
 * **fallback**, used only when the media reports nothing. These write the same
 * two slots as the provider's `content-title` and `default-content-title`
 * attributes, so the imperative and declarative paths cannot drift. Passing
 * `null` or `undefined` clears a slot and lets resolution fall through; passing
 * an empty string sets it to deliberately blank.
 */
export interface MediaContentMetadataState {
  /** Title of the content. Empty string when nothing should be shown. */
  contentTitle: string;
  /** URL of a poster image for the content. Empty string when there is none. */
  contentPoster: string;
  /**
   * Alternative text describing the content poster.
   *
   * Empty string is the correct default: it marks the image decorative, which
   * is what an empty `alt` already means in HTML, rather than leaving an image
   * with no accessible name.
   */
  contentPosterAlt: string;
  setContentTitle(value: MediaContentValue): void;
  setDefaultContentTitle(value: MediaContentValue): void;
  setContentPoster(value: MediaContentValue): void;
  setDefaultContentPoster(value: MediaContentValue): void;
  setContentPosterAlt(value: MediaContentValue): void;
  setDefaultContentPosterAlt(value: MediaContentValue): void;
}
