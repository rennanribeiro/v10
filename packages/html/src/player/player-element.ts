import {
  type MediaContainer,
  type PlayerFeatureConfig,
  type PlayerStore,
  type PlayerTarget,
  setPlayerConfigValue,
} from '@videojs/core/dom';
import type { PropertyDeclarationMap, PropertyValues } from '@videojs/element';
import { ContextProvider } from '@videojs/element/context';
import type { Media } from '@videojs/media/dom';
import { isNull } from '@videojs/utils/predicate';
import { kebabCase } from '@videojs/utils/string';
import type { PlayerElementConstructor } from '../store/types';
import { MediaElement } from '../ui/media-element';
import type { ContainerContext, MediaContext, PlayerContext } from './context';

export interface CreatePlayerElementOptions<Store extends PlayerStore> {
  playerContext: PlayerContext<Store>;
  mediaContext: MediaContext;
  containerContext: ContainerContext;
  factory: () => Store;
  config: PlayerFeatureConfig;
}

/** Creates a configured player element class that owns the store and attach lifecycle. */
export function createPlayerElement<Store extends PlayerStore>(
  options: CreatePlayerElementOptions<Store>
): PlayerElementConstructor<Store> {
  const configKeys = Object.keys(options.config);

  class ConfiguredPlayerElement extends MediaElement {
    static properties = {
      ...MediaElement.properties,
      ...Object.fromEntries(configKeys.map((key) => [key, { type: String, attribute: kebabCase(key) }])),
    } satisfies PropertyDeclarationMap;

    #store: Store | null = options.factory();
    #configuredStore: Store | null = null;
    #detach: (() => void) | null = null;
    #media: Media | null = null;
    #container: MediaContainer | null = null;
    #fallbackQueued = false;

    #setMedia = (media: Media | null): void => {
      if (this.#media === media) return;
      this.#media = media;
      this.#mediaProvider.setValue({ media, setMedia: this.#setMedia });
      this.#tryAttach();
    };

    #setContainer = (container: MediaContainer | null): void => {
      if (this.#container === container) return;
      this.#container = container;
      this.#containerProvider.setValue({
        container,
        setContainer: this.#setContainer,
      });
      this.#tryAttach();
    };

    #playerProvider = new ContextProvider(this, {
      context: options.playerContext,
      initialValue: this.store,
    });

    #mediaProvider = new ContextProvider(this, {
      context: options.mediaContext,
      initialValue: { media: this.#media, setMedia: this.#setMedia },
    });

    #containerProvider = new ContextProvider(this, {
      context: options.containerContext,
      initialValue: {
        container: this.#container,
        setContainer: this.#setContainer,
      },
    });

    get store(): Store {
      if (isNull(this.#store)) {
        this.#store = options.factory();
      }

      return this.#store;
    }

    override connectedCallback(): void {
      this.style.display ||= 'contents';
      this.#syncInitialConfig();
      super.connectedCallback();
      this.#playerProvider.setValue(this.store);
      this.#mediaProvider.setValue({ media: this.#media, setMedia: this.#setMedia });
      this.#containerProvider.setValue({
        container: this.#container,
        setContainer: this.#setContainer,
      });
      this.#tryAttach();
      this.#queueFallbackDiscovery();
    }

    override disconnectedCallback(): void {
      super.disconnectedCallback();
      this.#detachStore();
    }

    override destroyCallback(): void {
      this.#detachStore();
      this.#store?.destroy();
      this.#store = null;
      super.destroyCallback();
    }

    protected override willUpdate(changed: PropertyValues): void {
      super.willUpdate(changed);

      for (const key of configKeys) {
        if (!changed.has(key)) continue;
        setPlayerConfigValue(this.store, options.config[key]!, (this as unknown as Record<string, unknown>)[key]);
      }
    }

    #tryAttach(): void {
      const store = this.#store;
      if (!store) return;

      if (!this.#media) {
        this.#detachStore();
        return;
      }

      const target: PlayerTarget = {
        media: this.#media,
        container: this.#container,
      };

      const hasMediaChanged = store.target?.media !== target.media;
      const hasContainerChanged = store.target?.container !== target.container;

      if (hasMediaChanged || hasContainerChanged) {
        this.#detachStore();
        this.#detach = store.attach(target);
      }
    }

    #detachStore(): void {
      this.#detach?.();
      this.#detach = null;
    }

    #syncInitialConfig(): void {
      const store = this.store;
      if (this.#configuredStore === store) return;

      for (const key of configKeys) {
        setPlayerConfigValue(store, options.config[key]!, (this as unknown as Record<string, unknown>)[key]);
      }
      this.#configuredStore = store;
    }

    #queueFallbackDiscovery(): void {
      if (this.#media || this.#fallbackQueued) return;
      this.#fallbackQueued = true;

      queueMicrotask(() => {
        this.#fallbackQueued = false;
        if (this.#media) return;

        const media = this.querySelector<HTMLMediaElement>('video, audio');
        if (media) this.#setMedia(media);
      });
    }
  }

  return ConfiguredPlayerElement as unknown as PlayerElementConstructor<Store>;
}
