import {
  assertNoProviderPropCollisions,
  type CollectedProviderProp,
  createPopupGroup,
  type MediaContainer,
  type PlayerStore,
  type PlayerTarget,
  writeProviderProps,
} from '@videojs/core/dom';
import type { PropertyDeclarationMap, PropertyValues, ReactiveElement } from '@videojs/element';
import { ContextProvider } from '@videojs/element/context';
import type { Media } from '@videojs/media/dom';
import { isNull } from '@videojs/utils/predicate';
import type { EmptyObject } from '@videojs/utils/types';
import type { MediaElementConstructor } from '@/ui/media-element';
import type { ContainerContext, MediaContext, PlayerContext } from '../player/context';
import type { PlayerProvider, PlayerProviderConstructor } from './types';

export interface ProviderMixinConfig<Store extends PlayerStore> {
  playerContext: PlayerContext<Store>;
  mediaContext: MediaContext;
  containerContext: ContainerContext;
  factory: () => Store;
  /** Provider props collected from the feature list, keyed by prop name. */
  providerProps: Map<string, CollectedProviderProp>;
}

export type ProviderMixin<Store extends PlayerStore, Props = EmptyObject> = <Class extends MediaElementConstructor>(
  BaseClass: Class
) => Class & PlayerProviderConstructor<Store, Props>;

/**
 * Create a mixin that provides player context to descendant elements and
 * owns the `store.attach()` lifecycle.
 *
 * Media and container elements register themselves via media/container
 * contexts that carry both the current value and a setter. When a media
 * element is available, the provider calls `store.attach({ media, container })`.
 *
 * As a fallback for plain `<video>`/`<audio>` that can't consume context,
 * the provider queries its subtree after a microtask.
 *
 * Fields declared by the composed features become ordinary reactive properties,
 * so `<video-player content-title="…">` works through the attribute engine the
 * element already has rather than a mechanism invented for this.
 *
 * @param config - Provider configuration with contexts, store factory, and props.
 */
export function createProviderMixin<Store extends PlayerStore, Props = EmptyObject>(
  config: ProviderMixinConfig<Store>
): ProviderMixin<Store, Props> {
  const declaredProperties: PropertyDeclarationMap = {};

  for (const { name, attribute, type } of config.providerProps.values()) {
    declaredProperties[name] = { type, attribute };
  }

  return <Class extends MediaElementConstructor>(BaseClass: Class) => {
    if (__DEV__) {
      // Checked against the *base* prototype chain, before this class installs
      // its own accessors, so an inherited DOM property is still visible.
      assertNoProviderPropCollisions(config.providerProps, BaseClass.prototype);
    }

    class PlayerProviderElement extends BaseClass implements PlayerProvider<Store> {
      static properties: PropertyDeclarationMap = {
        ...(BaseClass as unknown as typeof ReactiveElement).properties,
        ...declaredProperties,
      };

      #store: Store | null = config.factory();
      #detach: (() => void) | null = null;
      #media: Media | null = null;
      #container: MediaContainer | null = null;
      #popupGroup = createPopupGroup();
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
          popupGroup: this.#popupGroup,
        });
        this.#tryAttach();
      };

      #playerProvider = new ContextProvider(this, {
        context: config.playerContext,
        initialValue: this.store,
      });

      #mediaProvider = new ContextProvider(this, {
        context: config.mediaContext,
        initialValue: { media: this.#media, setMedia: this.#setMedia },
      });

      #containerProvider = new ContextProvider(this, {
        context: config.containerContext,
        initialValue: {
          container: this.#container,
          setContainer: this.#setContainer,
          popupGroup: this.#popupGroup,
        },
      });

      get store(): Store {
        if (isNull(this.#store)) {
          this.#store = config.factory();
        }

        return this.#store;
      }

      override connectedCallback() {
        super.connectedCallback();
        this.#playerProvider.setValue(this.store);
        this.#mediaProvider.setValue({ media: this.#media, setMedia: this.#setMedia });
        this.#containerProvider.setValue({
          container: this.#container,
          setContainer: this.#setContainer,
          popupGroup: this.#popupGroup,
        });
        // Before `#tryAttach()`, deliberately. Attributes are parsed during
        // upgrade, but the element's first `update()` only runs a microtask after
        // connect — so without this line the store would attach, and the media
        // would report its own metadata, before the developer's values had landed.
        // The ordering lives here because this callback is already the one place a
        // reviewer looks for it.
        this.#syncProviderProps();
        this.#tryAttach();
        this.#queueFallbackDiscovery();
      }

      override disconnectedCallback() {
        super.disconnectedCallback();
        this.#detachStore();
      }

      override destroyCallback() {
        this.#detachStore();
        this.#store?.destroy();
        this.#store = null;
        super.destroyCallback();
      }

      /**
       * Later changes take the ordinary Lit path: setting a declared property, or
       * changing its attribute, requests an update, and the write happens here.
       *
       * Note the property *getter* keeps returning the element's own last-set
       * value rather than the store's resolved value, because `ReactiveElement`'s
       * generated accessor stores it under a symbol. That matters: after
       * `el.contentTitle = undefined` hands control back to the media, reading the
       * property must not report the media's title instead.
       */
      protected override willUpdate(changed: PropertyValues): void {
        super.willUpdate(changed);
        this.#syncProviderProps();
      }

      #syncProviderProps(): void {
        if (!config.providerProps.size) return;

        const store = this.#store;
        if (!store || store.destroyed) return;

        writeProviderProps(store as never, config.providerProps, (name) => (this as Record<string, unknown>)[name]);
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

      #queueFallbackDiscovery(): void {
        if (this.#media || this.#fallbackQueued) return;
        this.#fallbackQueued = true;

        queueMicrotask(() => {
          this.#fallbackQueued = false;

          // Context already registered media — skip fallback.
          if (this.#media) return;

          const media = this.querySelector<HTMLMediaElement>('video, audio');
          if (media) {
            this.#setMedia(media);
          }
        });
      }
    }

    // The declared props exist on the prototype at runtime but are never written
    // as class fields, so the class type cannot see them — hence the assertion
    // rather than a structural match.
    return PlayerProviderElement as unknown as Class & PlayerProviderConstructor<Store, Props>;
  };
}
