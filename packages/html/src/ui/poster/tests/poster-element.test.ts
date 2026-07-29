import { contentMetadataFeature, features } from '@videojs/core/dom';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createPlayer } from '../../../player/create-player';
import { MediaElement } from '../../media-element';
import { PosterElement } from '../poster-element';

const { ProviderMixin } = createPlayer({ features: [features.playback, contentMetadataFeature] });

class TestProviderElement extends ProviderMixin(MediaElement) {
  static readonly tagName = 'test-poster-provider';
}

beforeAll(() => {
  customElements.define(TestProviderElement.tagName, TestProviderElement as never);
  customElements.define(PosterElement.tagName, PosterElement);
});

afterEach(() => {
  document.body.innerHTML = '';
});

/**
 * Lets the whole chain settle: the provider's update writes to the store, the
 * store notifies on a microtask, the controller requests an update, and the
 * poster updates.
 */
async function settle(poster: PosterElement) {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await (poster as unknown as { updateComplete: Promise<boolean> }).updateComplete;
}

/** Mounts a provider wrapping `<media-poster>` and waits for the element's update cycle. */
async function mount(providerAttrs: string, posterInner: string) {
  const host = document.createElement('div');
  host.innerHTML = `
    <${TestProviderElement.tagName} ${providerAttrs}>
      <media-poster>${posterInner}</media-poster>
    </${TestProviderElement.tagName}>
  `;
  document.body.appendChild(host);

  const poster = host.querySelector('media-poster') as PosterElement;
  await (poster as unknown as { updateComplete: Promise<boolean> }).updateComplete;

  return { poster, image: poster.querySelector('img') };
}

describe('PosterElement content metadata', () => {
  it('fills an empty src on the image the author supplied', async () => {
    const { image } = await mount('content-poster="poster.jpg"', '<img />');

    expect(image?.getAttribute('src')).toBe('poster.jpg');
  });

  it('never overwrites a src the author set', async () => {
    const { image } = await mount('content-poster="from-store.jpg"', '<img src="mine.jpg" />');

    expect(image?.getAttribute('src')).toBe('mine.jpg');
  });

  it('renders nothing when there is no image to fill', async () => {
    const { poster } = await mount('content-poster="poster.jpg"', '');

    // By design: the element is a wrapper around your image, and it never creates
    // one.
    expect(poster.querySelector('img')).toBeNull();
  });

  it('leaves the src alone when the resolved poster is empty', async () => {
    const { image } = await mount('', '<img />');

    // Not `src=""`, which would request the current page.
    expect(image?.hasAttribute('src')).toBe(false);
  });

  it('fills a missing alt from the resolved alt text', async () => {
    const { image } = await mount('content-poster="poster.jpg" content-poster-alt="A description"', '<img />');

    expect(image?.getAttribute('alt')).toBe('A description');
  });

  it('fills a missing alt with an empty string, marking the image decorative', async () => {
    const { image } = await mount('content-poster="poster.jpg"', '<img />');

    // An image with no accessible name is an accessibility fault; an empty alt is
    // the platform's marker for decorative, which is the right default.
    expect(image?.getAttribute('alt')).toBe('');
  });

  it('never overwrites an author’s empty alt', async () => {
    const { image } = await mount('content-poster="poster.jpg" content-poster-alt="A description"', '<img alt="" />');

    // Presence, never emptiness. An author writing `alt=""` is deliberately
    // marking the image decorative.
    expect(image?.getAttribute('alt')).toBe('');
  });

  it('never overwrites an author’s alt text', async () => {
    const { image } = await mount(
      'content-poster="poster.jpg" content-poster-alt="From the store"',
      '<img alt="Mine" />'
    );

    expect(image?.getAttribute('alt')).toBe('Mine');
  });

  it('fills an image nested inside a wrapper element', async () => {
    const { poster } = await mount('content-poster="poster.jpg"', '<picture><img /></picture>');

    expect(poster.querySelector('img')?.getAttribute('src')).toBe('poster.jpg');
  });

  it('follows the store when the resolved poster changes', async () => {
    const { poster, image } = await mount('content-poster="first.jpg"', '<img />');
    expect(image?.getAttribute('src')).toBe('first.jpg');

    poster.closest(TestProviderElement.tagName)?.setAttribute('content-poster', 'second.jpg');
    await settle(poster);

    // Once filled, the attribute is present either way — so re-deriving ownership
    // from presence would leave a playlist stuck on the first video's poster.
    expect(image?.getAttribute('src')).toBe('second.jpg');
  });

  it('still refuses to touch an author’s src when the store changes', async () => {
    const { poster, image } = await mount('content-poster="first.jpg"', '<img src="mine.jpg" />');

    poster.closest(TestProviderElement.tagName)?.setAttribute('content-poster', 'second.jpg');
    await settle(poster);

    expect(image?.getAttribute('src')).toBe('mine.jpg');
  });

  it('keeps working when the content metadata feature is absent', async () => {
    const bare = createPlayer({ features: [features.playback] });
    class BareProvider extends bare.ProviderMixin(MediaElement) {}
    const tag = 'test-poster-bare-provider';
    customElements.define(tag, BareProvider as never);

    const host = document.createElement('div');
    host.innerHTML = `<${tag}><media-poster><img src="mine.jpg" /></media-poster></${tag}>`;
    document.body.appendChild(host);

    const poster = host.querySelector('media-poster') as PosterElement;
    await (poster as unknown as { updateComplete: Promise<boolean> }).updateComplete;

    expect(poster.querySelector('img')?.getAttribute('src')).toBe('mine.jpg');
  });
});
