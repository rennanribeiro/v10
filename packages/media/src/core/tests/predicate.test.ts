import { describe, expect, it } from 'vite-plus/test';

import { EMPTY_REMOTE, EMPTY_TEXT_TRACKS, EMPTY_TIME_RANGES } from '../constants';
import {
  isMediaBufferCapable,
  isMediaContentDataCapable,
  isMediaErrorCapable,
  isMediaMutedCapable,
  isMediaPauseCapable,
  isMediaRemotePlaybackCapable,
  isMediaSeekCapable,
  isMediaTextTrackCapable,
  isMediaVolumeCapable,
} from '../predicate';

describe('capability presence', () => {
  it('reads a declared member rather than the value it currently holds', () => {
    // A media that has not loaded holds initial values, which a value check
    // used to read as unsupported.
    expect(isMediaSeekCapable({ currentTime: undefined, duration: undefined, seeking: undefined })).toBe(true);
    expect(isMediaVolumeCapable({ volume: undefined, muted: undefined })).toBe(true);
    expect(isMediaErrorCapable({ error: undefined })).toBe(true);
  });

  it('is false for a media that does not declare the member', () => {
    expect(isMediaSeekCapable({ currentTime: 0, duration: 0 })).toBe(false);
    expect(isMediaVolumeCapable({ muted: false })).toBe(false);
    expect(isMediaErrorCapable({})).toBe(false);
  });

  it('still separates a mute from a volume level', () => {
    // An embed can take a mute command while offering no way to set a level.
    expect(isMediaMutedCapable({ muted: false })).toBe(true);
    expect(isMediaVolumeCapable({ muted: false })).toBe(false);
  });

  it('follows the prototype, where a composed host carries its members', () => {
    class PauseMedia {
      get paused() {
        return true;
      }
      get ended() {
        return false;
      }
      pause() {}
    }

    expect(isMediaPauseCapable(new PauseMedia())).toBe(true);
    expect(isMediaPauseCapable(new (class {})())).toBe(false);
  });
});

describe('isMediaContentDataCapable', () => {
  it('uses undefined as the unsupported sentinel', () => {
    expect(isMediaContentDataCapable({})).toBe(false);
    expect(isMediaContentDataCapable({ contentData: undefined })).toBe(false);
    expect(isMediaContentDataCapable({ contentData: {} })).toBe(true);
    expect(isMediaContentDataCapable({ contentData: { poster: 'poster.jpg' } })).toBe(true);
    expect(isMediaContentDataCapable({ contentData: { title: undefined } })).toBe(true);
    expect(isMediaContentDataCapable({ contentData: { title: null } })).toBe(true);
    expect(isMediaContentDataCapable({ contentData: { title: '' } })).toBe(true);
  });
});

describe('isMediaBufferCapable', () => {
  it('rejects empty time range stubs', () => {
    expect(isMediaBufferCapable({ buffered: EMPTY_TIME_RANGES, seekable: EMPTY_TIME_RANGES })).toBe(false);
  });

  it('accepts defined non-stub time ranges', () => {
    const range = { length: 1, start: () => 0, end: () => 10 };

    expect(isMediaBufferCapable({ buffered: range, seekable: range })).toBe(true);
  });
});

describe('isMediaTextTrackCapable', () => {
  it('rejects the empty text tracks stub', () => {
    expect(isMediaTextTrackCapable({ textTracks: EMPTY_TEXT_TRACKS })).toBe(false);
  });

  it('accepts defined non-stub text tracks', () => {
    expect(isMediaTextTrackCapable({ textTracks: Object.assign(new EventTarget(), { length: 0 }) })).toBe(true);
  });
});

describe('isMediaRemotePlaybackCapable', () => {
  it('rejects the empty remote playback stub', () => {
    expect(isMediaRemotePlaybackCapable({ remote: EMPTY_REMOTE })).toBe(false);
  });

  it('accepts defined non-stub remote playback', () => {
    expect(isMediaRemotePlaybackCapable({ remote: new EventTarget() })).toBe(true);
  });
});
