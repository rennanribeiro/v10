import type { WebKitDocument, WebKitVideoElement } from '@videojs/utils/dom';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import type { MediaFullscreenControlCapability } from '../../core/types';
import { addMediaComponent, type MediaComponent } from '../media-host';
import { HTMLVideoElementHost, type HTMLVideoTargetLike } from '../video-host';

/**
 * A media component that takes over leaving fullscreen, the way a media managing its own presentation would.
 *
 * An override supplies members of the composed media surface, which is wider than the target's own properties —
 * `exitFullscreen` is a capability command no media element holds.
 */
class SelfExitingOverride implements MediaComponent<HTMLVideoTargetLike & MediaFullscreenControlCapability> {
  exitFullscreen = vi.fn(async () => undefined);

  get targetOverride(): Partial<HTMLVideoTargetLike & MediaFullscreenControlCapability> {
    return { exitFullscreen: this.exitFullscreen };
  }
}

function stub(owner: object, prop: string, value: unknown) {
  Object.defineProperty(owner, prop, { value, writable: true, configurable: true });
}

afterEach(() => {
  document.body.innerHTML = '';
  Object.defineProperty(document, 'pictureInPictureElement', {
    value: null,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    value: null,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(document, 'webkitFullscreenElement', {
    value: null,
    writable: true,
    configurable: true,
  });
});

describe('HTMLVideoElementHost', () => {
  describe('isPictureInPicture', () => {
    it('returns false when no target is attached', () => {
      const host = new HTMLVideoElementHost();

      expect(host.isPictureInPicture).toBe(false);
    });

    it('returns true when target is the PiP element', () => {
      const video = document.createElement('video');
      const host = new HTMLVideoElementHost();

      host.attach(video);

      Object.defineProperty(document, 'pictureInPictureElement', {
        value: video,
        writable: true,
        configurable: true,
      });

      expect(host.isPictureInPicture).toBe(true);
    });

    it('reflects target swaps', () => {
      const a = document.createElement('video');
      const b = document.createElement('video');
      const host = new HTMLVideoElementHost();

      Object.defineProperty(document, 'pictureInPictureElement', {
        value: b,
        writable: true,
        configurable: true,
      });

      host.attach(a);
      expect(host.isPictureInPicture).toBe(false);

      host.detach();
      host.attach(b);
      expect(host.isPictureInPicture).toBe(true);
    });

    it('detects WebKit picture-in-picture presentation mode', () => {
      const video = document.createElement('video') as HTMLVideoElement & WebKitVideoElement;

      video.webkitPresentationMode = 'picture-in-picture';

      const host = new HTMLVideoElementHost();

      host.attach(video);

      expect(host.isPictureInPicture).toBe(true);
    });

    it('returns false when WebKit presentation mode is inline', () => {
      const video = document.createElement('video') as HTMLVideoElement & WebKitVideoElement;

      video.webkitPresentationMode = 'inline';

      const host = new HTMLVideoElementHost();

      host.attach(video);

      expect(host.isPictureInPicture).toBe(false);
    });
  });

  describe('isFullscreen', () => {
    it('returns false when no target is attached', () => {
      const host = new HTMLVideoElementHost();

      expect(host.isFullscreen).toBe(false);
    });

    it('returns true when document.fullscreenElement matches the target', () => {
      const video = document.createElement('video');
      const host = new HTMLVideoElementHost();

      host.attach(video);

      Object.defineProperty(document, 'fullscreenElement', {
        value: video,
        writable: true,
        configurable: true,
      });

      expect(host.isFullscreen).toBe(true);
    });

    it('returns true when webkitFullscreenElement matches the target', () => {
      const video = document.createElement('video');
      const host = new HTMLVideoElementHost();

      host.attach(video);

      Object.defineProperty(document as WebKitDocument, 'webkitFullscreenElement', {
        value: video,
        writable: true,
        configurable: true,
      });

      expect(host.isFullscreen).toBe(true);
    });

    it('returns false when fullscreen element is something else', () => {
      const video = document.createElement('video');
      const other = document.createElement('div');
      const host = new HTMLVideoElementHost();

      host.attach(video);

      Object.defineProperty(document, 'fullscreenElement', {
        value: other,
        writable: true,
        configurable: true,
      });

      expect(host.isFullscreen).toBe(false);
    });

    it('detects WebKit fullscreen presentation mode', () => {
      const video = document.createElement('video') as HTMLVideoElement & WebKitVideoElement;

      video.webkitPresentationMode = 'fullscreen';

      const host = new HTMLVideoElementHost();

      host.attach(video);

      expect(host.isFullscreen).toBe(true);
    });

    it('returns false when WebKit presentation mode is inline', () => {
      const video = document.createElement('video') as HTMLVideoElement & WebKitVideoElement;

      video.webkitPresentationMode = 'inline';

      const host = new HTMLVideoElementHost();

      host.attach(video);

      expect(host.isFullscreen).toBe(false);
    });
  });

  describe('presentation commands', () => {
    it('forwards a command the media holds', async () => {
      const video = document.createElement('video');
      const requestFullscreen = vi.fn(async () => undefined);
      const requestPictureInPicture = vi.fn(async () => undefined);

      stub(video, 'requestFullscreen', requestFullscreen);
      stub(video, 'requestPictureInPicture', requestPictureInPicture);

      const host = new HTMLVideoElementHost();

      host.attach(video);

      await host.requestFullscreen();
      await host.requestPictureInPicture();

      expect(requestFullscreen).toHaveBeenCalled();
      expect(requestPictureInPicture).toHaveBeenCalled();
    });

    it('asks the document to leave, because no media holds that command', async () => {
      const exitFullscreen = vi.fn(async () => undefined);
      const exitPictureInPicture = vi.fn(async () => undefined);

      stub(document, 'exitFullscreen', exitFullscreen);
      stub(document, 'exitPictureInPicture', exitPictureInPicture);

      const host = new HTMLVideoElementHost();

      host.attach(document.createElement('video'));

      await host.exitFullscreen();
      await host.exitPictureInPicture();

      expect(exitFullscreen).toHaveBeenCalled();
      expect(exitPictureInPicture).toHaveBeenCalled();
    });

    it('prefers a media that leaves fullscreen itself over the document', async () => {
      const exitFullscreen = vi.fn(async () => undefined);

      stub(document, 'exitFullscreen', exitFullscreen);

      const host = new HTMLVideoElementHost();

      host.attach(document.createElement('video'));

      const override = new SelfExitingOverride();

      addMediaComponent(host, override);

      await host.exitFullscreen();

      expect(override.exitFullscreen).toHaveBeenCalled();
      expect(exitFullscreen).not.toHaveBeenCalled();
    });

    it('rejects every command while no media is attached', async () => {
      const host = new HTMLVideoElementHost();

      await expect(host.requestFullscreen()).rejects.toThrow('No media is attached.');
      await expect(host.exitFullscreen()).rejects.toThrow('No media is attached.');
      await expect(host.requestPictureInPicture()).rejects.toThrow('No media is attached.');
      await expect(host.exitPictureInPicture()).rejects.toThrow('No media is attached.');
    });
  });
});
