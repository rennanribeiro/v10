import type { AnyPlayerStore, PlayerTarget } from '@videojs/core/dom';
import { metadataFeature, playbackFeature } from '@videojs/core/dom';
import { ContextProvider } from '@videojs/element/context';
import { combine, createStore } from '@videojs/store';
import { afterEach, describe, expect, it } from 'vitest';

import { playerContext } from '../../../player/context';
import { MediaElement } from '../../media-element';
import { PosterPlaceholderElement } from '../poster-placeholder-element';

function ensureDefined(ctor: CustomElementConstructor & { readonly tagName: string }): void {
  if (!customElements.get(ctor.tagName)) customElements.define(ctor.tagName, ctor);
}

class TestProviderElement extends MediaElement {
  static readonly tagName = 'test-poster-placeholder-provider';

  readonly store = createStore<PlayerTarget>()(combine(playbackFeature, metadataFeature)) as unknown as AnyPlayerStore;

  readonly #provider = new ContextProvider(this, { context: playerContext, initialValue: this.store });

  override connectedCallback(): void {
    super.connectedCallback();
    this.#provider.setValue(this.store);
  }
}

interface Harness {
  provider: TestProviderElement;
  posterPlaceholder: PosterPlaceholderElement;
  setPosterPlaceholder(value: string | null): Promise<void>;
  start(): Promise<void>;
}

async function mount(): Promise<Harness> {
  ensureDefined(TestProviderElement);
  ensureDefined(PosterPlaceholderElement);

  const provider = document.createElement(TestProviderElement.tagName) as TestProviderElement;
  const posterPlaceholder = document.createElement(PosterPlaceholderElement.tagName) as PosterPlaceholderElement;
  provider.appendChild(posterPlaceholder);
  document.body.appendChild(provider);

  const video = document.createElement('video');
  provider.store.attach({ media: video, container: null });

  await posterPlaceholder.updateComplete;

  const settle = async () => {
    posterPlaceholder.requestUpdate();
    await posterPlaceholder.updateComplete;
  };

  return {
    provider,
    posterPlaceholder,
    async setPosterPlaceholder(value) {
      (provider.store as unknown as { setPosterPlaceholder(value: string | null): void }).setPosterPlaceholder(value);
      await settle();
    },
    async start() {
      Object.defineProperty(video, 'paused', { value: false, configurable: true });
      video.dispatchEvent(new Event('play'));
      await settle();
    },
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('PosterPlaceholderElement', () => {
  it('paints the resolved poster placeholder as its background image', async () => {
    const { posterPlaceholder, setPosterPlaceholder } = await mount();

    await setPosterPlaceholder('tiny.jpg');

    expect(posterPlaceholder.style.backgroundImage).toBe('url("tiny.jpg")');
  });

  it('stops painting when the poster placeholder goes away', async () => {
    const { posterPlaceholder, setPosterPlaceholder } = await mount();

    await setPosterPlaceholder('tiny.jpg');
    await setPosterPlaceholder(null);

    expect(posterPlaceholder.style.backgroundImage).toBe('');
  });

  it('paints nothing when nothing supplied a poster placeholder', async () => {
    const { posterPlaceholder } = await mount();

    expect(posterPlaceholder.style.backgroundImage).toBe('');
    expect(posterPlaceholder.hasAttribute('data-visible')).toBe(true);
  });

  it('hides once playback starts', async () => {
    const { posterPlaceholder, setPosterPlaceholder, start } = await mount();

    await setPosterPlaceholder('tiny.jpg');
    expect(posterPlaceholder.hasAttribute('data-visible')).toBe(true);

    await start();

    expect(posterPlaceholder.hasAttribute('data-visible')).toBe(false);
    // The image stays put so the fade-out has something to fade.
    expect(posterPlaceholder.style.backgroundImage).toBe('url("tiny.jpg")');
  });

  it('adds no children of its own', async () => {
    const { posterPlaceholder } = await mount();

    expect(posterPlaceholder.shadowRoot).toBe(null);
    expect(posterPlaceholder.childNodes).toHaveLength(0);
  });
});
