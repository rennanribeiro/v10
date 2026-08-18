import { audioFeatures, backgroundFeatures, metadataFeature, type PopupGroup, videoFeatures } from '@videojs/core/dom';
import { ContextConsumer } from '@videojs/element/context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MediaAttachMixin } from '../../store/media-attach-mixin';
import { ContainerElement } from '../../ui/container/container-element';
import { UIElement } from '../../ui/ui-element';
import { createPlayer } from '../create-player';
import { popupGroupContext } from '../popup-group-context';

let tagCounter = 0;

function defineTestElement<Element extends CustomElementConstructor>(Base: Element): string {
  const tagName = `test-player-context-${tagCounter++}`;
  customElements.define(tagName, class extends Base {});
  return tagName;
}

describe('createPlayer', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it.each([
    ['video', videoFeatures],
    ['audio', audioFeatures],
    ['background', backgroundFeatures],
  ] as const)('creates a direct %s player class', (_name, features) => {
    const result = createPlayer({ features });

    expect(result.playerContext).toBeDefined();
    expect(result.PlayerElement).toBeInstanceOf(Function);
    expect(result.PlayerController).toBeInstanceOf(Function);
    expect(result).not.toHaveProperty('Player');
    expect(result).not.toHaveProperty('context');
    expect(result).not.toHaveProperty('create');
    expect(result).not.toHaveProperty('ProviderMixin');
    expect(result).not.toHaveProperty('ContainerMixin');
  });

  it('uses display contents as the default player layout', () => {
    const { PlayerElement } = createPlayer({ features: backgroundFeatures });
    const player = document.createElement(defineTestElement(PlayerElement));

    document.body.append(player);

    expect(player.style.display).toBe('contents');
  });

  it('scopes popup coordination to container descendants', async () => {
    const { PlayerElement } = createPlayer({ features: videoFeatures });

    class PopupGroupProbe extends UIElement {
      popupGroup: PopupGroup | undefined;

      constructor() {
        super();
        new ContextConsumer(this, {
          context: popupGroupContext,
          callback: (value) => {
            this.popupGroup = value;
          },
        });
      }
    }

    const playerTag = defineTestElement(PlayerElement);
    const containerTag = defineTestElement(ContainerElement);
    const probeTag = defineTestElement(PopupGroupProbe);
    const player = document.createElement(playerTag);
    const container = document.createElement(containerTag);
    const outsideProbe = document.createElement(probeTag) as PopupGroupProbe;
    const insideProbe = document.createElement(probeTag) as PopupGroupProbe;

    container.append(insideProbe);
    player.append(outsideProbe, container);
    document.body.append(player);

    await Promise.all([
      (player as UIElement).updateComplete,
      (container as UIElement).updateComplete,
      outsideProbe.updateComplete,
      insideProbe.updateComplete,
    ]);

    expect(outsideProbe.popupGroup).toBeUndefined();
    expect(insideProbe.popupGroup).toBeDefined();
  });

  it('keeps container registration identity-safe', async () => {
    const { PlayerElement } = createPlayer({ features: backgroundFeatures });
    const player = document.createElement(defineTestElement(PlayerElement)) as InstanceType<typeof PlayerElement>;
    const first = document.createElement(defineTestElement(ContainerElement));
    const second = document.createElement(defineTestElement(ContainerElement));
    const video = document.createElement('video');

    first.append(video);
    player.append(first, second);
    document.body.append(player);

    await vi.waitFor(() => expect(player.store.target?.container).toBe(second));

    second.remove();
    await vi.waitFor(() => expect(player.store.target?.container).toBe(first));

    first.remove();
    await vi.waitFor(() => expect(player.store.target?.container).toBeNull());
  });

  it('upgrades parser-created containers under a connected player', async () => {
    const { PlayerElement } = createPlayer({ features: backgroundFeatures });
    const player = document.createElement(defineTestElement(PlayerElement)) as InstanceType<typeof PlayerElement>;
    const containerTag = `test-late-container-${tagCounter++}`;

    player.innerHTML = `<${containerTag}><video></video></${containerTag}>`;
    document.body.append(player);

    expect(() => customElements.define(containerTag, class extends ContainerElement {})).not.toThrow();
    await vi.waitFor(() => expect(player.store.target?.container).toBeInstanceOf(ContainerElement));
  });

  it('keeps custom media registration identity-safe', async () => {
    const { PlayerElement } = createPlayer({ features: backgroundFeatures });
    const player = document.createElement(defineTestElement(PlayerElement)) as InstanceType<typeof PlayerElement>;
    const mediaTag = defineTestElement(MediaAttachMixin(HTMLElement));
    const first = document.createElement(mediaTag);
    const second = document.createElement(mediaTag);

    player.append(first, second);
    document.body.append(player);

    await vi.waitFor(() => expect(player.store.target?.media).toBe(second));

    first.remove();
    expect(player.store.target?.media).toBe(second);

    second.remove();
    await vi.waitFor(() => expect(player.store.target).toBeNull());
  });

  it('tracks native media added, removed, and replaced after connection', async () => {
    const { PlayerElement } = createPlayer({ features: backgroundFeatures });
    const player = document.createElement(defineTestElement(PlayerElement)) as InstanceType<typeof PlayerElement>;
    const first = document.createElement('video');
    const second = document.createElement('audio');

    document.body.append(player);
    expect(player.store.target).toBeNull();

    player.append(first);
    await vi.waitFor(() => expect(player.store.target?.media).toBe(first));

    first.replaceWith(second);
    await vi.waitFor(() => expect(player.store.target?.media).toBe(second));

    second.remove();
    await vi.waitFor(() => expect(player.store.target).toBeNull());
  });

  it('maps selected feature inputs to kebab-cased reactive properties and attributes', async () => {
    const { PlayerElement } = createPlayer({ features: [metadataFeature] });
    const tagName = defineTestElement(PlayerElement);
    const player = document.createElement(tagName) as InstanceType<typeof PlayerElement>;

    player.setAttribute('content-title', 'Attribute title');
    player.setAttribute('default-content-title', 'Fallback');
    document.body.append(player);

    expect(player.contentTitle).toBe('Attribute title');
    expect(player.store.contentTitle).toBe('Attribute title');
    expect(PlayerElement.observedAttributes).toContain('default-content-title');

    player.contentTitle = 'Property title';
    await player.updateComplete;
    expect(player.store.contentTitle).toBe('Property title');

    player.removeAttribute('content-title');
    await player.updateComplete;
    expect(player.store.contentTitle).toBe('Fallback');

    player.store.setContentTitle('Imperative title');
    expect(player.store.contentTitle).toBe('Imperative title');
    expect(player.contentTitle).toBeNull();
  });

  it('leaves config attributes inert when their feature is absent', () => {
    const { PlayerElement } = createPlayer({ features: backgroundFeatures });

    expect(PlayerElement.observedAttributes).not.toContain('content-title');
    expect(PlayerElement.prototype).not.toHaveProperty('contentTitle');
  });
});
