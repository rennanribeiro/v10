import { describe, expect, it } from 'vite-plus/test';

import {
  defineMediaCapability,
  getMediaCapabilities,
  getMediaCapabilityAttributes,
  getMediaCapabilityEvents,
  type MediaCapabilityDescriptor,
  type MediaCapabilityManifest,
  supportsMediaCapability,
} from '../capability';

const volumeCapability = defineMediaCapability<{ volume: number; muted: boolean }>()({
  name: 'volume',
  events: ['volumechange'],
  attributes: { muted: { type: Boolean } },
  props: { volume: { fallback: 1 }, muted: { fallback: false } },
});

const seekCapability = defineMediaCapability<{ currentTime: number }>()({
  name: 'seek',
  events: ['timeupdate', 'seeked'],
  props: { currentTime: { fallback: 0 } },
});

class ComposedMedia {
  static readonly capabilities: MediaCapabilityManifest['capabilities'] = new Map<
    string,
    MediaCapabilityDescriptor<any>
  >([
    ['volume', volumeCapability],
    ['seek', seekCapability],
  ]);
}

describe('defineMediaCapability', () => {
  it('hands back the descriptor it was given', () => {
    expect(volumeCapability.name).toBe('volume');
    expect(volumeCapability.props.volume.fallback).toBe(1);
  });
});

describe('getMediaCapabilities', () => {
  it('reads the manifest from a class or an instance', () => {
    expect([...getMediaCapabilities(ComposedMedia).keys()]).toEqual(['volume', 'seek']);
    expect([...getMediaCapabilities(new ComposedMedia()).keys()]).toEqual(['volume', 'seek']);
  });

  it('is empty for a media that declares nothing', () => {
    expect(getMediaCapabilities({ volume: 1 }).size).toBe(0);
    expect(getMediaCapabilities(null).size).toBe(0);
    expect(getMediaCapabilities(undefined).size).toBe(0);
  });
});

describe('supportsMediaCapability', () => {
  it('answers from the manifest', () => {
    expect(supportsMediaCapability(new ComposedMedia(), 'volume')).toBe(true);
    expect(supportsMediaCapability(new ComposedMedia(), 'text-track')).toBe(false);
    // A media that declares nothing supports nothing, so callers needing to
    // cover foreign media fall back to the `isMedia*Capable` predicates.
    expect(supportsMediaCapability({ volume: 1 }, 'volume')).toBe(false);
  });
});

describe('getMediaCapabilityEvents', () => {
  it('collects the events of every composed capability', () => {
    expect(getMediaCapabilityEvents(ComposedMedia)).toEqual(['volumechange', 'timeupdate', 'seeked']);
  });
});

describe('getMediaCapabilityAttributes', () => {
  it('collects the attributes of every composed capability', () => {
    expect(getMediaCapabilityAttributes(ComposedMedia)).toEqual({ muted: { type: Boolean } });
  });
});
