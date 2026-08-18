import { audioFeatures, backgroundFeatures, metadataFeature, type PopupGroup, videoFeatures } from '@videojs/core/dom';
import { ContextConsumer } from '@videojs/element/context';
import { afterEach, describe, expect, it } from 'vitest';

import { ContainerMixin } from '../../store/container-mixin';
import { MediaElement } from '../../ui/media-element';
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
    expect(result.context).toBe(result.playerContext);
    expect(result).not.toHaveProperty('create');
    expect(result.ProviderMixin(MediaElement)).toBe(result.PlayerElement);
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

    class PopupGroupProbe extends MediaElement {
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
    const containerTag = defineTestElement(ContainerMixin(MediaElement));
    const probeTag = defineTestElement(PopupGroupProbe);
    const player = document.createElement(playerTag);
    const container = document.createElement(containerTag);
    const outsideProbe = document.createElement(probeTag) as PopupGroupProbe;
    const insideProbe = document.createElement(probeTag) as PopupGroupProbe;

    container.append(insideProbe);
    player.append(outsideProbe, container);
    document.body.append(player);

    await Promise.all([
      (player as MediaElement).updateComplete,
      (container as MediaElement).updateComplete,
      outsideProbe.updateComplete,
      insideProbe.updateComplete,
    ]);

    expect(outsideProbe.popupGroup).toBeUndefined();
    expect(insideProbe.popupGroup).toBeDefined();
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
