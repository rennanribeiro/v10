export interface HtmlSkinDef {
  id: string;
  name: string;
  platform: 'html';
  style: 'css' | 'tailwind';
  template: string;
  css?: string;
  iconSet: 'default' | 'minimal';
}

export interface ReactSkinDef {
  id: string;
  name: string;
  platform: 'react';
  style: 'css' | 'tailwind';
  source: string;
  css?: string;
}

export type SkinDef = HtmlSkinDef | ReactSkinDef;
export type MediaType = 'video' | 'audio';

export const HTML_CDN_BASE = 'https://cdn.jsdelivr.net/npm/@videojs/html/cdn';
export const DEMO_VIDEO_SRC = 'https://stream.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/highest.mp4';
export const DEMO_POSTER_SRC = 'https://image.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/thumbnail.webp';
// Live skins need a live source, or their Live button renders in a permanently
// "behind live" state. A live presentation is HLS, and a bare `<video>` only
// plays HLS in Safari — so live snippets use a media element plus its CDN media
// script, mirroring the install guide's defaults for the live presets
// (`hlsjs-video` for live video, `mux-audio` for live audio).
export const DEMO_LIVE_SRC = 'https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8';
export const DEMO_LIVE_POSTER_SRC =
  'https://image.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM/thumbnail.webp';
export const LIVE_MEDIA_SUBPATH: Record<MediaType, string> = { video: 'hlsjs-video', audio: 'mux-audio' };
export const LIVE_MEDIA_TAG: Record<MediaType, string> = { video: 'hlsjs-video', audio: 'mux-audio' };
export const LIVE_MEDIA_COMPONENT: Record<MediaType, string> = { video: 'HlsJsVideo', audio: 'MuxAudio' };

export interface EjectedSkinEntry {
  id: string;
  name: string;
  platform: 'html' | 'react';
  style: 'css' | 'tailwind';
  html?: string;
  tsx?: Record<string, string>;
  jsx?: Record<string, string>;
  css?: string;
}

export function getSkinMediaType(skin: SkinDef): MediaType {
  return skin.id.includes('audio') ? 'audio' : 'video';
}

/**
 * Whether the skin belongs to a live preset. Live skins share the icon set of
 * their non-live counterpart but use the `live-video` / `live-audio` package
 * subpaths, tags, and feature sets, and play a live source.
 */
export function isLiveSkin(skin: Pick<SkinDef, 'id'>): boolean {
  return skin.id.includes('live-');
}

/** Package subpath / tag prefix for a skin: `video`, `audio`, `live-video`, or `live-audio`. */
export function getSkinGroup(skin: SkinDef): string {
  const mediaType = getSkinMediaType(skin);
  return isLiveSkin(skin) ? `live-${mediaType}` : mediaType;
}

export const SKINS: SkinDef[] = [
  {
    id: 'default-video',
    name: 'Default Video',
    platform: 'html',
    style: 'css',
    template: 'packages/html/src/define/video/skin.ts',
    css: 'packages/html/src/define/video/skin.css',
    iconSet: 'default',
  },
  {
    id: 'default-audio',
    name: 'Default Audio',
    platform: 'html',
    style: 'css',
    template: 'packages/html/src/define/audio/skin.ts',
    css: 'packages/html/src/define/audio/skin.css',
    iconSet: 'default',
  },
  {
    id: 'minimal-video',
    name: 'Minimal Video',
    platform: 'html',
    style: 'css',
    template: 'packages/html/src/define/video/minimal-skin.ts',
    css: 'packages/html/src/define/video/minimal-skin.css',
    iconSet: 'minimal',
  },
  {
    id: 'minimal-audio',
    name: 'Minimal Audio',
    platform: 'html',
    style: 'css',
    template: 'packages/html/src/define/audio/minimal-skin.ts',
    css: 'packages/html/src/define/audio/minimal-skin.css',
    iconSet: 'minimal',
  },
  {
    id: 'default-live-video',
    name: 'Default Live Video',
    platform: 'html',
    style: 'css',
    template: 'packages/html/src/define/live-video/skin.ts',
    css: 'packages/html/src/define/live-video/skin.css',
    iconSet: 'default',
  },
  {
    id: 'default-live-audio',
    name: 'Default Live Audio',
    platform: 'html',
    style: 'css',
    template: 'packages/html/src/define/live-audio/skin.ts',
    css: 'packages/html/src/define/live-audio/skin.css',
    iconSet: 'default',
  },
  {
    id: 'minimal-live-video',
    name: 'Minimal Live Video',
    platform: 'html',
    style: 'css',
    template: 'packages/html/src/define/live-video/minimal-skin.ts',
    css: 'packages/html/src/define/live-video/minimal-skin.css',
    iconSet: 'minimal',
  },
  {
    id: 'minimal-live-audio',
    name: 'Minimal Live Audio',
    platform: 'html',
    style: 'css',
    template: 'packages/html/src/define/live-audio/minimal-skin.ts',
    css: 'packages/html/src/define/live-audio/minimal-skin.css',
    iconSet: 'minimal',
  },
  {
    id: 'default-video-tailwind',
    name: 'Default Video (Tailwind)',
    platform: 'html',
    style: 'tailwind',
    template: 'packages/html/src/define/video/skin.tailwind.ts',
    iconSet: 'default',
  },
  {
    id: 'default-audio-tailwind',
    name: 'Default Audio (Tailwind)',
    platform: 'html',
    style: 'tailwind',
    template: 'packages/html/src/define/audio/skin.tailwind.ts',
    iconSet: 'default',
  },
  {
    id: 'minimal-video-tailwind',
    name: 'Minimal Video (Tailwind)',
    platform: 'html',
    style: 'tailwind',
    template: 'packages/html/src/define/video/minimal-skin.tailwind.ts',
    iconSet: 'minimal',
  },
  {
    id: 'minimal-audio-tailwind',
    name: 'Minimal Audio (Tailwind)',
    platform: 'html',
    style: 'tailwind',
    template: 'packages/html/src/define/audio/minimal-skin.tailwind.ts',
    iconSet: 'minimal',
  },
  {
    id: 'default-live-video-tailwind',
    name: 'Default Live Video (Tailwind)',
    platform: 'html',
    style: 'tailwind',
    template: 'packages/html/src/define/live-video/skin.tailwind.ts',
    iconSet: 'default',
  },
  {
    id: 'default-live-audio-tailwind',
    name: 'Default Live Audio (Tailwind)',
    platform: 'html',
    style: 'tailwind',
    template: 'packages/html/src/define/live-audio/skin.tailwind.ts',
    iconSet: 'default',
  },
  {
    id: 'minimal-live-video-tailwind',
    name: 'Minimal Live Video (Tailwind)',
    platform: 'html',
    style: 'tailwind',
    template: 'packages/html/src/define/live-video/minimal-skin.tailwind.ts',
    iconSet: 'minimal',
  },
  {
    id: 'minimal-live-audio-tailwind',
    name: 'Minimal Live Audio (Tailwind)',
    platform: 'html',
    style: 'tailwind',
    template: 'packages/html/src/define/live-audio/minimal-skin.tailwind.ts',
    iconSet: 'minimal',
  },
  {
    id: 'default-video-react',
    name: 'Default Video (React)',
    platform: 'react',
    style: 'css',
    source: 'packages/react/src/presets/video/skin.tsx',
    css: 'packages/react/src/presets/video/skin.css',
  },
  {
    id: 'default-audio-react',
    name: 'Default Audio (React)',
    platform: 'react',
    style: 'css',
    source: 'packages/react/src/presets/audio/skin.tsx',
    css: 'packages/react/src/presets/audio/skin.css',
  },
  {
    id: 'minimal-video-react',
    name: 'Minimal Video (React)',
    platform: 'react',
    style: 'css',
    source: 'packages/react/src/presets/video/minimal-skin.tsx',
    css: 'packages/react/src/presets/video/minimal-skin.css',
  },
  {
    id: 'minimal-audio-react',
    name: 'Minimal Audio (React)',
    platform: 'react',
    style: 'css',
    source: 'packages/react/src/presets/audio/minimal-skin.tsx',
    css: 'packages/react/src/presets/audio/minimal-skin.css',
  },
  {
    id: 'default-live-video-react',
    name: 'Default Live Video (React)',
    platform: 'react',
    style: 'css',
    source: 'packages/react/src/presets/live-video/skin.tsx',
    css: 'packages/react/src/presets/live-video/skin.css',
  },
  {
    id: 'default-live-audio-react',
    name: 'Default Live Audio (React)',
    platform: 'react',
    style: 'css',
    source: 'packages/react/src/presets/live-audio/skin.tsx',
    css: 'packages/react/src/presets/live-audio/skin.css',
  },
  {
    id: 'minimal-live-video-react',
    name: 'Minimal Live Video (React)',
    platform: 'react',
    style: 'css',
    source: 'packages/react/src/presets/live-video/minimal-skin.tsx',
    css: 'packages/react/src/presets/live-video/minimal-skin.css',
  },
  {
    id: 'minimal-live-audio-react',
    name: 'Minimal Live Audio (React)',
    platform: 'react',
    style: 'css',
    source: 'packages/react/src/presets/live-audio/minimal-skin.tsx',
    css: 'packages/react/src/presets/live-audio/minimal-skin.css',
  },
  {
    id: 'default-video-react-tailwind',
    name: 'Default Video (React + Tailwind)',
    platform: 'react',
    style: 'tailwind',
    source: 'packages/react/src/presets/video/skin.tailwind.tsx',
  },
  {
    id: 'default-audio-react-tailwind',
    name: 'Default Audio (React + Tailwind)',
    platform: 'react',
    style: 'tailwind',
    source: 'packages/react/src/presets/audio/skin.tailwind.tsx',
  },
  {
    id: 'minimal-video-react-tailwind',
    name: 'Minimal Video (React + Tailwind)',
    platform: 'react',
    style: 'tailwind',
    source: 'packages/react/src/presets/video/minimal-skin.tailwind.tsx',
  },
  {
    id: 'minimal-audio-react-tailwind',
    name: 'Minimal Audio (React + Tailwind)',
    platform: 'react',
    style: 'tailwind',
    source: 'packages/react/src/presets/audio/minimal-skin.tailwind.tsx',
  },
  {
    id: 'default-live-video-react-tailwind',
    name: 'Default Live Video (React + Tailwind)',
    platform: 'react',
    style: 'tailwind',
    source: 'packages/react/src/presets/live-video/skin.tailwind.tsx',
  },
  {
    id: 'default-live-audio-react-tailwind',
    name: 'Default Live Audio (React + Tailwind)',
    platform: 'react',
    style: 'tailwind',
    source: 'packages/react/src/presets/live-audio/skin.tailwind.tsx',
  },
  {
    id: 'minimal-live-video-react-tailwind',
    name: 'Minimal Live Video (React + Tailwind)',
    platform: 'react',
    style: 'tailwind',
    source: 'packages/react/src/presets/live-video/minimal-skin.tailwind.tsx',
  },
  {
    id: 'minimal-live-audio-react-tailwind',
    name: 'Minimal Live Audio (React + Tailwind)',
    platform: 'react',
    style: 'tailwind',
    source: 'packages/react/src/presets/live-audio/minimal-skin.tailwind.tsx',
  },
];
