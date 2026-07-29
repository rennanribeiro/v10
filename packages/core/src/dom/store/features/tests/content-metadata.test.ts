import { createStore } from '@videojs/store';
import { describe, expect, it } from 'vitest';
import type { PlayerTarget } from '../../../player';
import { createMockVideo } from '../../../tests/test-helpers';
import { contentMetadataFeature } from '../content-metadata';

type ContentValue = string | null | undefined;

/**
 * A media that reports content metadata, standing in for something like
 * `mux-video`. Assigning dispatches the change event, which is what lets a donor
 * stay ignorant of the store.
 */
function createDonorMedia(initial: { title?: ContentValue; poster?: ContentValue; posterAlt?: ContentValue } = {}) {
  const media = createMockVideo() as HTMLVideoElement & {
    contentTitle: ContentValue;
    contentPoster: ContentValue;
    contentPosterAlt: ContentValue;
  };

  let title: ContentValue = initial.title ?? null;
  let poster: ContentValue = initial.poster ?? null;
  let posterAlt: ContentValue = initial.posterAlt ?? null;

  Object.defineProperties(media, {
    contentTitle: {
      get: () => title,
      set: (value: ContentValue) => {
        title = value ?? null;
        media.dispatchEvent(new Event('contenttitlechange'));
      },
      configurable: true,
    },
    contentPoster: {
      get: () => poster,
      set: (value: ContentValue) => {
        poster = value ?? null;
        media.dispatchEvent(new Event('contentposterchange'));
      },
      configurable: true,
    },
    contentPosterAlt: {
      get: () => posterAlt,
      set: (value: ContentValue) => {
        posterAlt = value ?? null;
        media.dispatchEvent(new Event('contentposteraltchange'));
      },
      configurable: true,
    },
  });

  return media;
}

function createFeatureStore() {
  return createStore<PlayerTarget>()(contentMetadataFeature);
}

describe('contentMetadataFeature', () => {
  describe('library default', () => {
    it('resolves every field to an empty string before anything is set', () => {
      const store = createFeatureStore();

      expect(store.contentTitle).toBe('');
      expect(store.contentPoster).toBe('');
      expect(store.contentPosterAlt).toBe('');
    });

    it('resolves to a string even with no media attached', () => {
      const store = createFeatureStore();

      store.setContentTitle('Set before any media');

      expect(store.contentTitle).toBe('Set before any media');
    });

    it('exposes only resolved values and actions as state keys', () => {
      const store = createFeatureStore();

      // Tier slots are symbol-keyed, so they never surface here.
      expect(Object.keys(store.state).sort()).toEqual([
        'contentPoster',
        'contentPosterAlt',
        'contentTitle',
        'setContentPoster',
        'setContentPosterAlt',
        'setContentTitle',
        'setDefaultContentPoster',
        'setDefaultContentPosterAlt',
        'setDefaultContentTitle',
      ]);
    });
  });

  describe('precedence', () => {
    it('prefers the developer override over the media', () => {
      const store = createFeatureStore();
      store.attach({ media: createDonorMedia({ title: 'From the backend' }), container: null });

      expect(store.contentTitle).toBe('From the backend');

      store.setContentTitle('From the developer');
      expect(store.contentTitle).toBe('From the developer');
    });

    it('prefers the media over the developer fallback', () => {
      const store = createFeatureStore();
      store.setDefaultContentTitle('A fallback');
      store.attach({ media: createDonorMedia({ title: 'From the backend' }), container: null });

      expect(store.contentTitle).toBe('From the backend');
    });

    it('uses the developer fallback when the media reports nothing', () => {
      const store = createFeatureStore();
      store.setDefaultContentTitle('A fallback');
      store.attach({ media: createDonorMedia(), container: null });

      expect(store.contentTitle).toBe('A fallback');
    });

    it('resolves identically whichever order the tiers are written in', () => {
      const overrideFirst = createFeatureStore();
      overrideFirst.setContentTitle('Override');
      overrideFirst.attach({ media: createDonorMedia({ title: 'Media' }), container: null });

      const mediaFirst = createFeatureStore();
      mediaFirst.attach({ media: createDonorMedia({ title: 'Media' }), container: null });
      mediaFirst.setContentTitle('Override');

      expect(overrideFirst.contentTitle).toBe('Override');
      expect(mediaFirst.contentTitle).toBe('Override');
    });

    it('falls back through the chain when the override is cleared', () => {
      const store = createFeatureStore();
      store.setDefaultContentTitle('A fallback');
      store.attach({ media: createDonorMedia({ title: 'From the backend' }), container: null });
      store.setContentTitle('From the developer');

      store.setContentTitle(undefined);
      expect(store.contentTitle).toBe('From the backend');
    });
  });

  describe('empty string suppresses, absence falls through', () => {
    it('lets an empty override beat a media-provided value', () => {
      const store = createFeatureStore();
      store.attach({ media: createDonorMedia({ title: 'From the backend' }), container: null });

      store.setContentTitle('');

      expect(store.contentTitle).toBe('');
    });

    it('treats null as absence, so a removed attribute falls through', () => {
      const store = createFeatureStore();
      store.attach({ media: createDonorMedia({ title: 'From the backend' }), container: null });

      store.setContentTitle('');
      store.setContentTitle(null);

      expect(store.contentTitle).toBe('From the backend');
    });

    it('lets an empty poster alt mean deliberately decorative', () => {
      const store = createFeatureStore();
      store.attach({ media: createDonorMedia({ posterAlt: 'A description' }), container: null });

      store.setContentPosterAlt('');

      expect(store.contentPosterAlt).toBe('');
    });
  });

  describe('media reporting', () => {
    it('picks up a value that arrives after attach', () => {
      const media = createDonorMedia();
      const store = createFeatureStore();
      store.attach({ media, container: null });

      expect(store.contentTitle).toBe('');

      // A backend fetch resolving later. The listener was wired at attach even
      // though there was no value then, which is what `empty: null` buys.
      media.contentTitle = 'Arrived late';

      expect(store.contentTitle).toBe('Arrived late');
    });

    it('tracks each field through its own event', () => {
      const media = createDonorMedia();
      const store = createFeatureStore();
      store.attach({ media, container: null });

      media.contentPoster = 'poster.jpg';
      media.contentPosterAlt = 'A description';

      expect(store.contentPoster).toBe('poster.jpg');
      expect(store.contentPosterAlt).toBe('A description');
      expect(store.contentTitle).toBe('');
    });

    it('supports a media reporting some fields but not others', () => {
      const media = createMockVideo() as HTMLVideoElement & { contentTitle: ContentValue };
      media.contentTitle = 'Only a title';

      const store = createFeatureStore();
      store.setDefaultContentPoster('fallback.jpg');
      store.attach({ media, container: null });

      expect(store.contentTitle).toBe('Only a title');
      expect(store.contentPoster).toBe('fallback.jpg');
    });

    it('falls through when the media clears its own value', () => {
      const media = createDonorMedia({ title: 'First video' });
      const store = createFeatureStore();
      store.setDefaultContentTitle('A fallback');
      store.attach({ media, container: null });

      expect(store.contentTitle).toBe('First video');

      // The media is expected to clear itself on source change and dispatch.
      // The feature wires no `emptied` backstop.
      media.contentTitle = null;

      expect(store.contentTitle).toBe('A fallback');
    });

    it('ignores a media that does not report content metadata at all', () => {
      const store = createFeatureStore();
      store.setContentTitle('From the developer');
      store.attach({ media: createMockVideo(), container: null });

      expect(store.contentTitle).toBe('From the developer');
    });
  });

  describe('lifecycle', () => {
    it('keeps developer values and drops media values on detach', () => {
      const store = createFeatureStore();
      store.setContentTitle('From the developer');
      store.setDefaultContentPoster('fallback.jpg');

      const detach = store.attach({
        media: createDonorMedia({ title: 'From the backend', poster: 'backend.jpg' }),
        container: null,
      });

      expect(store.contentPoster).toBe('backend.jpg');

      detach();

      expect(store.contentTitle).toBe('From the developer');
      expect(store.contentPoster).toBe('fallback.jpg');
    });

    it('re-resolves against the new media after a swap', () => {
      const store = createFeatureStore();

      const detach = store.attach({ media: createDonorMedia({ title: 'First' }), container: null });
      expect(store.contentTitle).toBe('First');
      detach();

      store.attach({ media: createDonorMedia({ title: 'Second' }), container: null });
      expect(store.contentTitle).toBe('Second');
    });

    it('leaves a developer override winning across a media swap', () => {
      const store = createFeatureStore();
      store.setContentTitle('Always this');

      const detach = store.attach({ media: createDonorMedia({ title: 'First' }), container: null });
      detach();
      store.attach({ media: createDonorMedia({ title: 'Second' }), container: null });

      expect(store.contentTitle).toBe('Always this');
    });

    it('stops listening to a detached media', () => {
      const media = createDonorMedia({ title: 'First' });
      const store = createFeatureStore();

      const detach = store.attach({ media, container: null });
      detach();

      media.contentTitle = 'Changed after detach';

      expect(store.contentTitle).toBe('');
    });
  });

  describe('provider prop declarations', () => {
    it('declares an override and a fallback for every field', () => {
      expect(Object.keys(contentMetadataFeature.providerProps ?? {}).sort()).toEqual([
        'contentPoster',
        'contentPosterAlt',
        'contentTitle',
        'defaultContentPoster',
        'defaultContentPosterAlt',
        'defaultContentTitle',
      ]);
    });

    it('gives every declaration an explicit kebab-case attribute', () => {
      for (const [name, declaration] of Object.entries(contentMetadataFeature.providerProps ?? {})) {
        expect(declaration.attribute).toBe(
          name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^-/, '')
        );
      }
    });

    it('names an action the store actually exposes', () => {
      const store = createFeatureStore();

      for (const declaration of Object.values(contentMetadataFeature.providerProps ?? {})) {
        expect(typeof store[declaration.action]).toBe('function');
      }
    });
  });
});
