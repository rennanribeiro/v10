import type { WebKitDocument, WebKitPresentationMode, WebKitVideoElement } from '@videojs/utils/dom';
import { isFunction } from '@videojs/utils/predicate';
import type { Constructor } from '@videojs/utils/types';

import { playsInlineCapability, posterCapability, videoDimensionsCapability } from '../../core/capabilities';
import type { Video, VideoEvents, VideoTargetLike } from '../../core/types';
import { fullscreenCapability, pictureInPictureCapability } from '../capabilities';
import { createMediaHost, HTMLMediaElementHost, type HTMLMediaTargetLike } from '../media-host';

export interface HTMLVideoTargetLike extends VideoTargetLike, HTMLMediaTargetLike {}

/** What a video adds to {@link htmlMediaElementCapabilities}. */
export const htmlVideoElementCapabilities = [
  posterCapability,
  playsInlineCapability,
  videoDimensionsCapability,
  pictureInPictureCapability,
  fullscreenCapability,
] as const;

// The media host is generic, and a value cannot carry type arguments into a
// composition, so the video parameterization is stated here instead.
const HTMLVideoElementHostBase = createMediaHost(
  htmlVideoElementCapabilities,
  HTMLMediaElementHost as Constructor<HTMLMediaElementHost<HTMLVideoTargetLike, VideoEvents>>
);

/**
 * A host forwarding the full `HTMLVideoElement` surface.
 *
 * What is left in the class body is what a manifest cannot describe: the current presentation mode, which the document
 * holds with the media as its subject, and Safari's non-standard presentation API.
 */
export class HTMLVideoElementHost extends HTMLVideoElementHostBase implements Video {
  get webkitCurrentPlaybackTargetIsWireless() {
    return (this.target as WebKitVideoElement | null)?.webkitCurrentPlaybackTargetIsWireless;
  }

  get webkitPresentationMode() {
    return (this.target as WebKitVideoElement | null)?.webkitPresentationMode;
  }

  get webkitSetPresentationMode(): ((mode: WebKitPresentationMode) => void) | undefined {
    const target = this.target as unknown as WebKitVideoElement | null;
    const fn = target?.webkitSetPresentationMode;

    return isFunction(fn) ? fn.bind(target) : undefined;
  }

  get isPictureInPicture(): boolean {
    const el = this.target as HTMLVideoElement | null;

    return (
      (!!el && globalThis.document?.pictureInPictureElement === el) ||
      this.webkitPresentationMode === 'picture-in-picture'
    );
  }

  get isFullscreen(): boolean {
    const el = this.target as HTMLVideoElement | null;
    if (!el) return false;

    if (this.webkitPresentationMode === 'fullscreen') return true;

    const doc = globalThis.document as WebKitDocument;

    return doc?.fullscreenElement === el || doc?.webkitFullscreenElement === el;
  }
}
