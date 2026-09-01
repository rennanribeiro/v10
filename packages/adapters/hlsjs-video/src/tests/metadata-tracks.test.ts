import { HTMLVideoAdapter } from '@videojs/media/dom';
import Hls from 'hls.js';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { HlsJsMetadataTracksMixin } from '../metadata-tracks';
import { TRACK_LOADED, withReadableCues } from '../text-tracks';

/**
 * Jsdom implements no text tracks at all, so the fake supplies what a real media element does: one track object per
 * `<track>` element, a `textTracks` list mirroring them, and `cues` reading as `null` while a track is disabled,
 * exactly as the spec requires.
 */
class FakeTextTrack {
  #mode: TextTrackMode = 'disabled';
  #cues: TextTrackCue[] = [];

  // An accessor rather than a data property, so a spy on the setter still reads back through the getter.
  get mode(): TextTrackMode {
    return this.#mode;
  }

  set mode(mode: TextTrackMode) {
    this.#mode = mode;
  }

  constructor(readonly kind: string) {}

  get cues(): TextTrackCue[] | null {
    return this.#mode === 'disabled' ? null : this.#cues;
  }

  addCue(cue: TextTrackCue) {
    this.#cues.push(cue);
  }

  /**
   * Mirrors hls.js's `clearCurrentCues()`, run on MANIFEST_LOADING and MEDIA_ATTACHING, before the events observed
   * here.
   */
  clearCues() {
    const { mode } = this;

    if (mode === 'disabled') this.mode = 'hidden';

    this.#cues = [];

    if (mode === 'disabled') this.mode = mode;
  }
}

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

function stubTrackSupport(video: HTMLVideoElement): () => void {
  const tracks = new WeakMap<HTMLTrackElement, FakeTextTrack>();
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTrackElement.prototype, 'track');

  Object.defineProperty(HTMLTrackElement.prototype, 'track', {
    configurable: true,
    get(this: HTMLTrackElement) {
      let track = tracks.get(this);

      if (!track) {
        track = new FakeTextTrack(this.getAttribute('kind') ?? 'subtitles');
        tracks.set(this, track);
      }

      return track;
    },
  });

  // A real media element exposes both the elements and the resulting list; the fake keeps that faithful so the same
  // suite can be run against an implementation that reads either one.
  Object.defineProperty(video, 'textTracks', {
    configurable: true,
    get: () => [...video.querySelectorAll('track')].map((trackEl) => trackEl.track),
  });

  return () => {
    if (descriptor) Object.defineProperty(HTMLTrackElement.prototype, 'track', descriptor);
    else Reflect.deleteProperty(HTMLTrackElement.prototype, 'track');
  };
}

function createEngine(): Hls {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();

  return {
    on(event: string, fn: (...args: any[]) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());

      listeners.get(event)!.add(fn);
    },
    off(event: string, fn: (...args: any[]) => void) {
      listeners.get(event)?.delete(fn);
    },
    emit(event: string, ...args: any[]) {
      for (const fn of [...(listeners.get(event) ?? [])]) fn(event, ...args);
    },
  } as unknown as Hls;
}

class FakeHost extends HTMLVideoAdapter {
  engine: Hls | null;

  constructor(engine: Hls | null = null) {
    super();
    this.engine = engine;
  }
}

const MetadataTracksHost = HlsJsMetadataTracksMixin(FakeHost);

interface TrackInit {
  kind?: string;
  label?: string;
  isDefault?: boolean;
  mode?: TextTrackMode;
  cues?: string[];
  readyState?: number;
  src?: string | null;
}

/** A `<track>` element holding the given cues, left in the given mode. */
function addTrack(
  video: HTMLVideoElement,
  {
    kind = 'chapters',
    label,
    isDefault = false,
    mode = 'disabled',
    cues = ['c1'],
    readyState = TRACK_LOADED,
    src = 'chapters.vtt',
  }: TrackInit = {}
) {
  const trackEl = document.createElement('track');

  trackEl.setAttribute('kind', kind);

  if (src !== null) trackEl.setAttribute('src', src);

  if (label !== undefined) trackEl.setAttribute('label', label);

  if (isDefault) trackEl.setAttribute('default', '');

  Object.defineProperty(trackEl, 'readyState', { value: readyState, configurable: true });
  video.append(trackEl);

  const track = trackEl.track as unknown as FakeTextTrack;

  track.mode = 'hidden';

  for (const id of cues) track.addCue({ id } as TextTrackCue);

  track.mode = mode;

  return trackEl;
}

const readableCueIds = (trackEl: HTMLTrackElement) =>
  withReadableCues(trackEl.track, () => Array.from(trackEl.track.cues ?? [], (cue) => cue.id));

function mount() {
  const engine = createEngine();
  const host = new MetadataTracksHost(engine);
  const video = document.createElement('video');

  restore = stubTrackSupport(video);
  host.attach(video);

  return { engine, video };
}

describe('HlsJsMetadataTracksMixin', () => {
  it('keeps a loaded chapters track whose cues are intact while it is disabled', () => {
    const { engine, video } = mount();
    const trackEl = addTrack(video, { mode: 'disabled', cues: ['c1'] });

    (engine as any).emit(Hls.Events.MANIFEST_LOADED);
    (engine as any).emit(Hls.Events.MEDIA_ATTACHED);

    expect(video.querySelector('track')).toBe(trackEl);
    expect(readableCueIds(trackEl)).toEqual(['c1']);
  });

  it('puts the mode back after reading the cues', () => {
    const { engine, video } = mount();
    const trackEl = addTrack(video, { mode: 'disabled' });

    (engine as any).emit(Hls.Events.MANIFEST_LOADED);

    expect(trackEl.track.mode).toBe('disabled');
  });

  it('never writes the mode of a track that is already showing', () => {
    const { engine, video } = mount();
    const trackEl = addTrack(video, { mode: 'showing' });
    const setMode = vi.spyOn(trackEl.track, 'mode', 'set');

    (engine as any).emit(Hls.Events.MANIFEST_LOADED);
    (engine as any).emit(Hls.Events.MEDIA_ATTACHED);

    expect(setMode).not.toHaveBeenCalled();
    expect(trackEl.track.mode).toBe('showing');
  });

  it('reloads a loaded track that hls.js emptied', () => {
    const { engine, video } = mount();
    const trackEl = addTrack(video, { mode: 'hidden' });

    (trackEl.track as unknown as FakeTextTrack).clearCues();
    (engine as any).emit(Hls.Events.MANIFEST_LOADED);

    const current = video.querySelector('track');

    expect(current).not.toBe(trackEl);
    expect(current?.getAttribute('src')).toBe('chapters.vtt');
  });

  it('carries the driving mode onto the replacement so it is fetched again', () => {
    const { engine, video } = mount();
    const trackEl = addTrack(video, { mode: 'showing' });

    (trackEl.track as unknown as FakeTextTrack).clearCues();
    (engine as any).emit(Hls.Events.MANIFEST_LOADED);

    const current = video.querySelector('track');

    expect(current).not.toBe(trackEl);
    expect(current?.track.mode).toBe('showing');
  });

  it('reloads an emptied track even while it is disabled', () => {
    const { engine, video } = mount();
    const trackEl = addTrack(video, { mode: 'disabled' });

    (trackEl.track as unknown as FakeTextTrack).clearCues();
    (engine as any).emit(Hls.Events.MANIFEST_LOADED);

    expect(video.querySelector('track')).not.toBe(trackEl);
  });

  it('rebuilds a track that stays empty only once', () => {
    const { engine, video } = mount();
    const trackEl = addTrack(video, { mode: 'hidden', cues: [] });

    (engine as any).emit(Hls.Events.MANIFEST_LOADED);

    const replacement = video.querySelector('track');

    expect(replacement).not.toBe(trackEl);

    // The replacement parses the same empty resource, so it reads as wiped too.
    Object.defineProperty(replacement!, 'readyState', { value: TRACK_LOADED, configurable: true });
    (engine as any).emit(Hls.Events.MANIFEST_LOADED);
    (engine as any).emit(Hls.Events.MEDIA_ATTACHED);

    expect(video.querySelector('track')).toBe(replacement);
  });

  it('leaves a track that never loaded alone', () => {
    const { engine, video } = mount();
    const trackEl = addTrack(video, { mode: 'disabled', cues: [], readyState: 0 });
    const setMode = vi.spyOn(trackEl.track, 'mode', 'set');

    (engine as any).emit(Hls.Events.MANIFEST_LOADED);

    expect(video.querySelector('track')).toBe(trackEl);
    expect(setMode).not.toHaveBeenCalled();
  });

  it('leaves a track with no src alone', () => {
    const { engine, video } = mount();
    const trackEl = addTrack(video, { mode: 'hidden', cues: [], src: null });

    (engine as any).emit(Hls.Events.MANIFEST_LOADED);

    expect(video.querySelector('track')).toBe(trackEl);
  });

  it('forces a default track to hidden without reloading it', () => {
    const { engine, video } = mount();
    const trackEl = addTrack(video, { isDefault: true, mode: 'disabled' });

    (engine as any).emit(Hls.Events.MANIFEST_LOADED);

    expect(video.querySelector('track')).toBe(trackEl);
    expect(trackEl.track.mode).toBe('hidden');
  });

  it('forces a rebuilt default track to hidden', () => {
    const { engine, video } = mount();
    const trackEl = addTrack(video, { isDefault: true, mode: 'hidden' });

    (trackEl.track as unknown as FakeTextTrack).clearCues();
    (engine as any).emit(Hls.Events.MANIFEST_LOADED);

    const current = video.querySelector('track');

    expect(current).not.toBe(trackEl);
    expect(current?.track.mode).toBe('hidden');
  });

  it('applies to metadata tracks as well as chapters', () => {
    const { engine, video } = mount();
    const trackEl = addTrack(video, { kind: 'metadata', mode: 'hidden' });

    (trackEl.track as unknown as FakeTextTrack).clearCues();
    (engine as any).emit(Hls.Events.MANIFEST_LOADED);

    expect(video.querySelector('track')).not.toBe(trackEl);
  });

  it('leaves kinds it does not own alone', () => {
    const { engine, video } = mount();
    const trackEl = addTrack(video, { kind: 'subtitles', mode: 'disabled', cues: [] });

    (engine as any).emit(Hls.Events.MANIFEST_LOADED);

    expect(video.querySelector('track')).toBe(trackEl);
    expect(trackEl.track.mode).toBe('disabled');
  });

  it('survives a label that is not valid selector text', () => {
    const { engine, video } = mount();
    const trackEl = addTrack(video, { label: 'Capítulos "PT-BR" [beta]' });

    expect(() => (engine as any).emit(Hls.Events.MANIFEST_LOADED)).not.toThrow();
    expect(video.querySelector('track')).toBe(trackEl);
  });

  it('handles two unlabeled tracks of the same kind independently', () => {
    const { engine, video } = mount();
    const intact = addTrack(video, { mode: 'disabled' });
    const emptied = addTrack(video, { mode: 'hidden' });

    (emptied.track as unknown as FakeTextTrack).clearCues();
    (engine as any).emit(Hls.Events.MANIFEST_LOADED);

    const current = [...video.querySelectorAll('track')];

    expect(current[0]).toBe(intact);
    expect(current[1]).not.toBe(emptied);
    expect(current).toHaveLength(2);
  });

  it('stays inert on a host with no text track support', () => {
    const { engine, video } = mount();

    restore?.();
    restore = undefined;

    const trackEl = document.createElement('track');

    trackEl.setAttribute('kind', 'chapters');
    trackEl.setAttribute('src', 'chapters.vtt');
    video.append(trackEl);

    expect(() => (engine as any).emit(Hls.Events.MANIFEST_LOADED)).not.toThrow();
    expect(video.querySelector('track')).toBe(trackEl);
  });
});
