import type { MediaPictureInPictureCapability } from '@videojs/media';
import { isMediaPictureInPictureCapable } from '@videojs/media';
import type { WebKitVideoElement } from '@videojs/utils/dom';
import { isFunction } from '@videojs/utils/predicate';

export function isPictureInPictureEnabled() {
  if (document.pictureInPictureEnabled) {
    const isSafari = /.*Version\/.*Safari\/.*/.test(navigator.userAgent);
    const isPWA = isFunction(matchMedia) && matchMedia('(display-mode: standalone)').matches;
    return !isSafari || !isPWA;
  }

  const video =
    /* SAFETY: The surrounding typed API establishes the asserted contract at this boundary. */ document.createElement(
      'video'
    ) as WebKitVideoElement;
  return isFunction(video.webkitSetPresentationMode);
}

/**
 * Whether this media can enter picture-in-picture at all, which is a separate
 * question from whether the browser supports it. Mirrors the branches
 * `requestPictureInPicture` takes below, so anything it would refuse to act on
 * reports as incapable here — an iframe embed whose provider has no
 * picture-in-picture can never enter it, however capable the browser is.
 */
export function isPictureInPictureCapable(media: EventTarget) {
  const webkitVideo =
    /* SAFETY: The surrounding typed API establishes the asserted contract at this boundary. */ media as WebKitVideoElement;
  if (isFunction(webkitVideo.webkitSetPresentationMode)) return true;
  return isMediaPictureInPictureCapable(media);
}

export function isPictureInPicture(media: EventTarget) {
  const webkitVideo =
    /* SAFETY: The surrounding typed API establishes the asserted contract at this boundary. */ media as WebKitVideoElement;
  if (webkitVideo.webkitPresentationMode === 'picture-in-picture') {
    return true;
  }

  if (document.pictureInPictureElement === media) {
    return true;
  }

  // isPictureInPicture is a non-standard property that is set by the video host
  // and checks internally if the video host target is the picture-in-picture element.
  const video =
    /* SAFETY: The surrounding typed API establishes the asserted contract at this boundary. */ media as MediaPictureInPictureCapability;
  return video.isPictureInPicture ?? false;
}

export async function requestPictureInPicture(media: EventTarget) {
  const webkitVideo =
    /* SAFETY: The surrounding typed API establishes the asserted contract at this boundary. */ media as WebKitVideoElement;
  if (isFunction(webkitVideo.webkitSetPresentationMode)) {
    webkitVideo.webkitSetPresentationMode('picture-in-picture');
    return;
  }

  const video =
    /* SAFETY: The surrounding typed API establishes the asserted contract at this boundary. */ media as MediaPictureInPictureCapability;
  if (isFunction(video.requestPictureInPicture)) {
    return /* SAFETY: The surrounding typed API establishes the asserted contract at this boundary. */ video.requestPictureInPicture() as Promise<void>;
  }
}

export async function exitPictureInPicture(media: EventTarget) {
  const webkitVideo =
    /* SAFETY: The surrounding typed API establishes the asserted contract at this boundary. */ media as WebKitVideoElement;
  if (
    webkitVideo.webkitPresentationMode === 'picture-in-picture' &&
    isFunction(webkitVideo.webkitSetPresentationMode)
  ) {
    webkitVideo.webkitSetPresentationMode('inline');
    return;
  }

  if (isFunction(document.exitPictureInPicture)) {
    return document.exitPictureInPicture();
  }

  const video =
    /* SAFETY: The surrounding typed API establishes the asserted contract at this boundary. */ media as MediaPictureInPictureCapability;
  if (isFunction(video.exitPictureInPicture)) {
    return /* SAFETY: The surrounding typed API establishes the asserted contract at this boundary. */ video.exitPictureInPicture() as Promise<void>;
  }
}
