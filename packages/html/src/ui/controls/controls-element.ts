import { ControlsCore, ControlsDataAttrs, POPUP_HOST_SELECTOR } from '@videojs/core';
import { applyStateDataAttrs, logMissingFeature, type PopupGroup, selectControls } from '@videojs/core/dom';
import type { PropertyValues } from '@videojs/element';
import { ContextConsumer, ContextProvider } from '@videojs/element/context';
import { isFunction } from '@videojs/utils/predicate';

import { playerContext } from '../../player/context';
import { PlayerController } from '../../player/player-controller';
import { popupGroupContext } from '../../player/popup-group-context';
import { UIElement } from '../ui-element';
import { controlsContext } from './context';

export class ControlsElement extends UIElement {
  static readonly tagName = 'media-controls';

  readonly #core = new ControlsCore();
  readonly #mediaState = new PlayerController(this, playerContext, selectControls);
  readonly #provider = new ContextProvider(this, { context: controlsContext });
  readonly #popupGroupContext = new ContextConsumer(this, { context: popupGroupContext, subscribe: true });
  #popupGroup: PopupGroup | undefined;
  #unsubscribePopupGroup = () => {};
  #visible = true;

  override connectedCallback(): void {
    super.connectedCallback();

    this.setAttribute('data-interactive', '');

    if (__DEV__ && !this.#mediaState.value && this.#mediaState.displayName) {
      logMissingFeature(this.localName, this.#mediaState.displayName);
    }
  }

  protected override update(_changed: PropertyValues): void {
    super.update(_changed);
    this.#syncPopupGroup();

    const media = this.#mediaState.value;
    if (!media) return;

    this.#core.setMedia(media);
    this.#core.setActivePopup(this.#popupGroup?.activeName ?? null);
    const state = this.#core.getState();

    applyStateDataAttrs(this, state, ControlsDataAttrs);

    this.#provider.setValue({
      state,
      stateAttrMap: ControlsDataAttrs,
    });

    const wasVisible = this.#visible;

    this.#visible = state.visible;

    if (wasVisible && !state.visible) {
      this.#closeOwnedOverlays();
    }
  }

  override disconnectedCallback(): void {
    this.#unsubscribePopupGroup();
    this.#unsubscribePopupGroup = () => {};
    this.#popupGroup = undefined;
    super.disconnectedCallback();
  }

  #syncPopupGroup(): void {
    const popupGroup = this.#popupGroupContext.value;
    if (popupGroup === this.#popupGroup) return;

    this.#unsubscribePopupGroup();
    this.#popupGroup = popupGroup;
    this.#unsubscribePopupGroup = popupGroup?.subscribe(() => this.requestUpdate()) ?? (() => {});
  }

  #closeOwnedOverlays(): void {
    for (const element of this.querySelectorAll(POPUP_HOST_SELECTOR)) {
      const host = element as Element & { close?: unknown };
      if (!isFunction(host.close)) continue;

      host.close('imperative-action');
    }
  }
}
