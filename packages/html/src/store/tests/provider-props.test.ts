import { type AnyPlayerFeature, contentMetadataFeature, features } from '@videojs/core/dom';
import { afterEach, describe, expect, it } from 'vitest';

import { createPlayer } from '../../player/create-player';
import { MediaElement } from '../../ui/media-element';

let tagCounter = 0;

interface ProviderElement extends HTMLElement {
  readonly store: Record<string, unknown>;
  contentTitle?: string | null | undefined;
  contentPoster?: string | null | undefined;
  contentPosterAlt?: string | null | undefined;
  defaultContentTitle?: string | null | undefined;
}

function defineProvider(featureList: AnyPlayerFeature[] = [features.playback, contentMetadataFeature]) {
  const { ProviderMixin } = createPlayer({ features: featureList });
  const tag = `test-provider-${++tagCounter}`;
  const Ctor = ProviderMixin(MediaElement);
  customElements.define(tag, Ctor as never);
  return { tag, Ctor };
}

/** Parses markup so attributes land before `connectedCallback`, as in a real page. */
function mount(tag: string, attributes = ''): ProviderElement {
  const host = document.createElement('div');
  host.innerHTML = `<${tag} ${attributes}></${tag}>`;
  document.body.appendChild(host);
  return host.firstElementChild as ProviderElement;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('provider props on an HTML provider', () => {
  it('observes an attribute for every declared field', () => {
    const { Ctor } = defineProvider();
    const observed = (Ctor as unknown as { observedAttributes: string[] }).observedAttributes;

    expect(observed).toContain('content-title');
    expect(observed).toContain('content-poster');
    expect(observed).toContain('content-poster-alt');
    expect(observed).toContain('default-content-title');
  });

  it('reaches the store from an attribute present at parse time', () => {
    const { tag } = defineProvider();
    const el = mount(tag, 'content-title="A title"');

    // Synchronously after connect, before any update cycle has run — the sync in
    // `connectedCallback` is what makes this true, and it is what puts the value
    // in place before the store attaches to any media.
    expect(el.store.contentTitle).toBe('A title');
  });

  it('reaches the store for every declared field', () => {
    const { tag } = defineProvider();
    const el = mount(tag, 'content-title="A title" content-poster="poster.jpg" content-poster-alt="A description"');

    expect(el.store.contentTitle).toBe('A title');
    expect(el.store.contentPoster).toBe('poster.jpg');
    expect(el.store.contentPosterAlt).toBe('A description');
  });

  it('writes the fallback tier from a default- attribute', () => {
    const { tag } = defineProvider();
    const el = mount(tag, 'default-content-title="A fallback"');

    expect(el.store.contentTitle).toBe('A fallback');
  });

  it('keeps an empty attribute as a suppressing value', () => {
    const { tag } = defineProvider();
    const el = mount(tag, 'content-title=""');

    expect(el.store.contentTitle).toBe('');
  });

  it('updates the store when an attribute changes', async () => {
    const { tag } = defineProvider();
    const el = mount(tag, 'content-title="First"');

    el.setAttribute('content-title', 'Second');
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

    expect(el.store.contentTitle).toBe('Second');
  });

  it('falls back when an attribute is removed', async () => {
    const { tag } = defineProvider();
    const el = mount(tag, 'content-title="First" default-content-title="A fallback"');

    el.removeAttribute('content-title');
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

    // Removing an attribute yields null, which the resolve chain treats as absent.
    expect(el.store.contentTitle).toBe('A fallback');
  });

  it('updates the store when a property is set', async () => {
    const { tag } = defineProvider();
    const el = mount(tag);

    el.contentTitle = 'From a property';
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

    expect(el.store.contentTitle).toBe('From a property');
  });

  it('reports the element’s own last-set value from the property, not the store’s', async () => {
    const { tag } = defineProvider();
    const el = mount(tag, 'content-title="From the developer"');

    el.contentTitle = undefined;
    await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

    // The property must keep reporting what was assigned to it. If it read the
    // store's resolved value instead, handing control back to the media would make
    // the property start reporting the media's title and stop round-tripping.
    expect(el.contentTitle).toBeUndefined();
  });

  it('declares no properties when no composed feature declares any', () => {
    const { Ctor } = defineProvider([features.playback]);
    const observed = (Ctor as unknown as { observedAttributes: string[] }).observedAttributes;

    expect(observed).not.toContain('content-title');
  });

  it('preserves developer values across a disconnect and reconnect', () => {
    const { tag } = defineProvider();
    const el = mount(tag, 'content-title="A title"');
    const host = el.parentElement!;

    el.remove();
    host.appendChild(el);

    expect(el.store.contentTitle).toBe('A title');
  });

  it('exposes the imperative setters on the store', () => {
    const { tag } = defineProvider();
    const el = mount(tag);

    expect(typeof el.store.setContentTitle).toBe('function');

    (el.store.setContentTitle as (value: string) => void)('From the setter');
    expect(el.store.contentTitle).toBe('From the setter');
  });
});

describe('orientation lock as a provider prop', () => {
  it('observes orientation-lock and resolves it on the store', () => {
    const { tag, Ctor } = defineProvider([features.orientationLock]);
    const observed = (Ctor as unknown as { observedAttributes: string[] }).observedAttributes;

    expect(observed).toContain('orientation-lock');

    const el = mount(tag, 'orientation-lock="portrait"');
    expect(el.store.orientationLock).toBe('portrait');
  });

  it('falls back to landscape when the attribute is absent', () => {
    const { tag } = defineProvider([features.orientationLock]);
    const el = mount(tag);

    expect(el.store.orientationLock).toBe('landscape');
  });
});
