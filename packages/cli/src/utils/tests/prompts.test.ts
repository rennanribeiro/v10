import { describe, expect, it } from 'vitest';
import { cdnUnsupportedReason, supportsCdnInstall } from '../prompts.js';

// Mirrors the install page's CDN gating: the preset/skin needs a published CDN
// bundle and, for media renderers, so does the media bundle.
describe('supportsCdnInstall', () => {
  it('returns true for preset renderers', () => {
    expect(supportsCdnInstall('default-video', 'video', 'html5-video')).toBe(true);
    expect(supportsCdnInstall('default-audio', 'audio', 'html5-audio')).toBe(true);
    expect(supportsCdnInstall('background-video', 'video', 'background-video')).toBe(true);
  });

  it('returns true for media renderers with a CDN build', () => {
    expect(supportsCdnInstall('default-video', 'video', 'hls')).toBe(true);
    expect(supportsCdnInstall('default-video', 'video', 'dash')).toBe(true);
    expect(supportsCdnInstall('default-video', 'video', 'mux-video')).toBe(true);
    expect(supportsCdnInstall('default-audio', 'audio', 'mux-audio')).toBe(true);
  });

  it('returns false for vimeo, which has no CDN build', () => {
    expect(supportsCdnInstall('default-video', 'video', 'vimeo')).toBe(false);
  });

  it('returns true for the live video preset, which ships default and minimal CDN bundles', () => {
    expect(supportsCdnInstall('live-video', 'video', 'hls')).toBe(true);
    expect(supportsCdnInstall('live-video', 'minimal-video', 'mux-video')).toBe(true);
  });

  it('returns false for live combinations with no CDN bundle', () => {
    // No `live-video-headless` bundle.
    expect(supportsCdnInstall('live-video', 'none', 'hls')).toBe(false);
    // No `live-audio*` bundles at all.
    expect(supportsCdnInstall('live-audio', 'audio', 'mux-audio')).toBe(false);
    expect(supportsCdnInstall('live-audio', 'minimal-audio', 'mux-audio')).toBe(false);
  });
});

describe('cdnUnsupportedReason', () => {
  it('returns null when the whole configuration ships a CDN build', () => {
    expect(cdnUnsupportedReason('live-video', 'video', 'hls')).toBeNull();
  });

  it('blames the preset when it has no CDN bundle', () => {
    expect(cdnUnsupportedReason('live-audio', 'audio', 'mux-audio')).toBe('preset');
  });

  it('blames the renderer when the preset ships but the media does not', () => {
    expect(cdnUnsupportedReason('default-video', 'video', 'vimeo')).toBe('renderer');
  });

  it('reports the preset first when neither ships', () => {
    expect(cdnUnsupportedReason('live-audio', 'none', 'vimeo')).toBe('preset');
  });
});
