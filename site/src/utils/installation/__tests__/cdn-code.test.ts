import { describe, expect, it } from 'vitest';
import {
  generateCdnCode,
  getCdnUnsupportedReason,
  getPresetLabel,
  presetSupportsCdn,
  rendererSupportsCdn,
} from '../cdn-code';

describe('generateCdnCode', () => {
  // Media subpaths that ship a CDN build. The media script is emitted only for
  // renderers whose subpath is in this set.
  const manifest = ['hlsjs-video', 'dash-video', 'mux-video', 'mux-audio'];

  it('generates video preset CDN tags for html5-video', () => {
    expect(generateCdnCode('default-video', 'video', 'html5-video', manifest)).toEqual(
      `<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/video.js"></script>`
    );
  });

  it('includes hls media bundle when renderer is hls', () => {
    expect(generateCdnCode('default-video', 'minimal-video', 'hls', manifest)).toEqual(
      `<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/video-minimal.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/media/hlsjs-video.js"></script>`
    );
  });

  it('includes the dash media bundle when renderer is dash', () => {
    expect(generateCdnCode('default-video', 'video', 'dash', manifest)).toEqual(
      `<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/video.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/media/dash-video.js"></script>`
    );
  });

  it('includes the mux media bundle when renderer is mux-video', () => {
    expect(generateCdnCode('default-video', 'video', 'mux-video', manifest)).toEqual(
      `<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/video.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/media/mux-video.js"></script>`
    );
  });

  it('omits the media script for a media renderer absent from the manifest', () => {
    expect(generateCdnCode('default-video', 'video', 'vimeo', manifest)).toEqual(
      `<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/video.js"></script>`
    );
  });

  it('generates background preset CDN tags', () => {
    expect(generateCdnCode('background-video', 'video', 'background-video', manifest)).toEqual(
      `<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/background.js"></script>`
    );
  });

  it('generates headless video CDN tag when skin is none', () => {
    expect(generateCdnCode('default-video', 'none', 'html5-video', manifest)).toEqual(
      `<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/video-headless.js"></script>`
    );
  });

  it('generates headless audio CDN tag when skin is none', () => {
    expect(generateCdnCode('default-audio', 'none', 'html5-audio', manifest)).toEqual(
      `<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/audio-headless.js"></script>`
    );
  });

  it('generates live video CDN tags alongside the media bundle', () => {
    expect(generateCdnCode('live-video', 'video', 'hls', manifest)).toEqual(
      `<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/live-video.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/media/hlsjs-video.js"></script>`
    );
  });

  it('generates the minimal live video CDN tag', () => {
    expect(generateCdnCode('live-video', 'minimal-video', 'mux-video', manifest)).toEqual(
      `<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/live-video-minimal.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html/cdn/media/mux-video.js"></script>`
    );
  });

  it('returns null for headless live video, which ships no CDN bundle', () => {
    expect(generateCdnCode('live-video', 'none', 'hls', manifest)).toBeNull();
  });

  it('returns null for live audio, which ships no CDN bundle', () => {
    expect(generateCdnCode('live-audio', 'audio', 'mux-audio', manifest)).toBeNull();
    expect(generateCdnCode('live-audio', 'minimal-audio', 'mux-audio', manifest)).toBeNull();
  });
});

describe('presetSupportsCdn', () => {
  it('returns true for the preset and skin combinations that ship bundles', () => {
    expect(presetSupportsCdn('default-video', 'video')).toBe(true);
    expect(presetSupportsCdn('default-video', 'minimal-video')).toBe(true);
    expect(presetSupportsCdn('default-video', 'none')).toBe(true);
    expect(presetSupportsCdn('default-audio', 'audio')).toBe(true);
    expect(presetSupportsCdn('background-video', 'video')).toBe(true);
    expect(presetSupportsCdn('live-video', 'video')).toBe(true);
    expect(presetSupportsCdn('live-video', 'minimal-video')).toBe(true);
  });

  it('returns false for the live combinations without bundles', () => {
    expect(presetSupportsCdn('live-video', 'none')).toBe(false);
    expect(presetSupportsCdn('live-audio', 'audio')).toBe(false);
    expect(presetSupportsCdn('live-audio', 'minimal-audio')).toBe(false);
    expect(presetSupportsCdn('live-audio', 'none')).toBe(false);
  });
});

describe('getCdnUnsupportedReason', () => {
  const manifest = ['hlsjs-video', 'dash-video', 'mux-video', 'mux-audio'];

  it('returns null when preset and renderer both ship bundles', () => {
    expect(getCdnUnsupportedReason('live-video', 'video', 'hls', manifest)).toBeNull();
  });

  it('blames the preset when it ships no bundle', () => {
    expect(getCdnUnsupportedReason('live-audio', 'audio', 'mux-audio', manifest)).toBe('preset');
  });

  it('blames the renderer when only the media bundle is missing', () => {
    expect(getCdnUnsupportedReason('default-video', 'video', 'vimeo', manifest)).toBe('renderer');
  });

  it('reports the preset first when neither ships', () => {
    expect(getCdnUnsupportedReason('live-video', 'none', 'vimeo', manifest)).toBe('preset');
  });
});

describe('getPresetLabel', () => {
  it('labels the live presets', () => {
    expect(getPresetLabel('live-video', 'video')).toBe('live video');
    expect(getPresetLabel('live-video', 'minimal-video')).toBe('minimal live video');
    expect(getPresetLabel('live-video', 'none')).toBe('headless live video');
    expect(getPresetLabel('live-audio', 'audio')).toBe('live audio');
    expect(getPresetLabel('live-audio', 'minimal-audio')).toBe('minimal live audio');
  });

  it('labels the non-live presets', () => {
    expect(getPresetLabel('default-video', 'video')).toBe('video');
    expect(getPresetLabel('default-audio', 'minimal-audio')).toBe('minimal audio');
    expect(getPresetLabel('background-video', 'video')).toBe('background video');
  });
});

describe('rendererSupportsCdn', () => {
  // Mirrors the manifest entries that ship a CDN build.
  const manifest = ['hlsjs-video', 'dash-video', 'mux-video', 'mux-audio'];

  it('returns true for preset renderers (covered by the preset bundle, no media subpath)', () => {
    expect(rendererSupportsCdn('html5-video', manifest)).toBe(true);
    expect(rendererSupportsCdn('html5-audio', manifest)).toBe(true);
    expect(rendererSupportsCdn('background-video', manifest)).toBe(true);
  });

  it('returns true for media renderers whose subpath is in the manifest', () => {
    expect(rendererSupportsCdn('hls', manifest)).toBe(true);
    expect(rendererSupportsCdn('dash', manifest)).toBe(true);
    expect(rendererSupportsCdn('mux-video', manifest)).toBe(true);
    expect(rendererSupportsCdn('mux-audio', manifest)).toBe(true);
  });

  it('returns false for vimeo, which has no CDN build', () => {
    expect(rendererSupportsCdn('vimeo', manifest)).toBe(false);
  });
});
