import { MenuCore, MenuDataAttrs, type MenuInput, POPUP_HOST_ATTR } from '@videojs/core';
import {
  applyElementProps,
  applyStateDataAttrs,
  createMenu,
  createTransition,
  getRootPositionOptions,
  isMenuNavigationKey,
  type MenuApi,
  type MenuChangeDetails,
  type MenuOpenChangeReason,
  observeMenuHeight,
  type PositioningBoundary,
  selectControls,
  syncMenuHeight,
  type UIFocusEvent,
  type UIKeyboardEvent,
} from '@videojs/core/dom';
import type { PropertyDeclarationMap, PropertyValues } from '@videojs/element';
import { ContextConsumer, ContextProvider } from '@videojs/element/context';
import { SnapshotController } from '@videojs/store/html';
import { tryHidePopover, tryShowPopover } from '@videojs/utils/dom';
import { containerContext, playerContext } from '../../player/context';
import { PlayerController } from '../../player/player-controller';
import { MediaElement } from '../media-element';
import { PositionController } from '../position-controller';
import { type MenuContextValue, menuContext } from './context';

export class MenuElement extends MediaElement {
  static readonly tagName: string = 'media-menu';

  static override properties = {
    open: { type: Boolean },
    defaultOpen: { type: Boolean, attribute: 'default-open' },
    side: { type: String },
    align: { type: String },
    closeOnEscape: { type: Boolean, attribute: 'close-on-escape' },
    closeOnOutsideClick: { type: Boolean, attribute: 'close-on-outside-click' },
    boundary: { type: String },
  } satisfies PropertyDeclarationMap<
    'open' | 'defaultOpen' | 'side' | 'align' | 'closeOnEscape' | 'closeOnOutsideClick' | 'boundary'
  >;

  open = MenuCore.defaultProps.open;
  defaultOpen = MenuCore.defaultProps.defaultOpen;
  side = MenuCore.defaultProps.side;
  align = MenuCore.defaultProps.align;
  closeOnEscape = MenuCore.defaultProps.closeOnEscape;
  closeOnOutsideClick = MenuCore.defaultProps.closeOnOutsideClick;
  boundary: PositioningBoundary = 'container';

  readonly #core = new MenuCore();
  readonly #provider = new ContextProvider(this, { context: menuContext });
  readonly #position = new PositionController(this);
  readonly #controlsState = new PlayerController(this, playerContext, selectControls);
  readonly #containerCtx = new ContextConsumer(this, { context: containerContext, subscribe: true });
  // Consume parent menu context — present when this is a nested (submenu) element.
  readonly #parentCtx = new ContextConsumer(this, { context: menuContext, subscribe: true });
  #menu: MenuApi | null = null;
  #snapshot: SnapshotController<MenuInput> | null = null;
  #submenuActive = false;

  #disconnect: AbortController | null = null;
  #triggerAbort: AbortController | null = null;
  #cleanupHeightObserver: (() => void) | null = null;
  #currentTrigger: HTMLElement | null = null;
  #releaseControlsLock: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.destroyed) return;

    this.setAttribute(POPUP_HOST_ATTR, '');

    this.#disconnect = new AbortController();

    this.#menu = createMenu({
      transition: createTransition(),
      onOpenChange: (nextOpen: boolean, details: MenuChangeDetails) => {
        this.open = nextOpen;
        this.dispatchEvent(new CustomEvent('open-change', { detail: { open: nextOpen, ...details } }));
      },
      closeOnEscape: () => this.closeOnEscape,
      closeOnOutsideClick: () => this.closeOnOutsideClick,
      group: () => (this.#parentCtx.value ? undefined : this.#containerCtx.value?.popupGroup),
    });

    // The element itself is the content (popup) for root menus.
    // Submenu detection happens in update() once parent context is available.
    this.#menu.setContentElement(this);

    applyElementProps(
      this,
      { onKeyDown: this.#handleContentKeyDown, onFocusOut: this.#handleContentFocusOut },
      { signal: this.#disconnect.signal }
    );

    if (this.#snapshot) {
      this.#snapshot.track(this.#menu.input);
    } else {
      this.#snapshot = new SnapshotController(this, this.#menu.input);
    }
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);

    if (this.defaultOpen && !this.open) {
      this.#menu?.open();
    }
  }

  override disconnectedCallback(): void {
    this.#releaseControlsVisibilityLock();
    super.disconnectedCallback();
    this.#cleanupHeightObserver?.();
    this.#cleanupHeightObserver = null;
    this.#cleanupTrigger();
    this.#menu?.destroy();
    this.#menu = null;
    this.#disconnect?.abort();
    this.#disconnect = null;
  }

  close(reason: MenuOpenChangeReason = 'imperative-action'): void {
    this.#menu?.close(reason);
  }

  show(reason: MenuOpenChangeReason = 'imperative-action'): void {
    this.#menu?.open(reason);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);

    const parentCtx = this.#parentCtx.value ?? null;
    const isSubmenu = parentCtx !== null;

    this.#core.setProps({
      open: this.open,
      defaultOpen: this.defaultOpen,
      side: this.side,
      align: this.align,
      closeOnEscape: this.closeOnEscape,
      closeOnOutsideClick: this.closeOnOutsideClick,
      isSubmenu,
    });

    if (this.#menu && changed.has('open')) {
      const { active: interactionOpen } = this.#menu.input.current;
      if (this.open !== interactionOpen) {
        if (this.open) {
          this.#menu.open();
        } else {
          this.#menu.close();
        }
      }
    }
  }

  protected override update(_changed: PropertyValues): void {
    super.update(_changed);
    if (!this.#menu) return;

    const parentCtx = this.#parentCtx.value ?? null;
    const isSubmenu = parentCtx !== null;

    const input = this.#menu.input.current;
    this.#core.setInput(input);
    const state = this.#core.getState();

    if (!isSubmenu && state.open) {
      this.#releaseControlsLock ??= this.#controlsState.value?.requestControlsLock() ?? null;
    } else {
      this.#releaseControlsVisibilityLock();
    }

    if (isSubmenu && parentCtx) {
      this.#updateAsSubmenu(state, parentCtx);
    } else {
      this.#updateAsRoot(state);
    }

    // Provide context to child parts.
    this.#provider.setValue({
      menu: this.#menu,
      state,
      stateAttrMap: MenuDataAttrs,
    });
  }

  #releaseControlsVisibilityLock(): void {
    this.#releaseControlsLock?.();
    this.#releaseControlsLock = null;
  }

  #updateAsRoot(state: ReturnType<MenuCore['getState']>): void {
    if (!this.#menu) return;

    const triggerElement = this.#position.findTrigger();
    this.#syncTrigger(triggerElement);

    applyElementProps(this, {
      ...this.#core.getContentAttrs(state),
    });
    applyStateDataAttrs(this, state, MenuDataAttrs);

    if (state.open) {
      tryShowPopover(this);
    } else {
      tryHidePopover(this);
    }

    if (this.#currentTrigger) {
      applyElementProps(this.#currentTrigger, this.#core.getTriggerAttrs(state, this.id));
    }

    if (!state.open) {
      this.#cleanupHeightObserver?.();
      this.#cleanupHeightObserver = null;
      this.#position.cleanup();
      for (const submenu of this.querySelectorAll<MenuElement>(`:scope > ${MenuElement.tagName}`)) {
        submenu.close();
      }
      return;
    }

    this.#cleanupHeightObserver?.();
    const syncHeight = () => syncMenuHeight(this);
    syncHeight();
    this.#cleanupHeightObserver = observeMenuHeight(this, syncHeight);

    const positionOptions = getRootPositionOptions(state.side, state.align);
    if (!positionOptions || !this.#currentTrigger) return;

    this.#position.sync({
      anchorName: this.id,
      position: positionOptions,
      trigger: this.#currentTrigger,
      boundary: this.boundary,
      container: this.#containerCtx.value?.container ?? null,
      onSideChange: (side) => this.setAttribute(MenuDataAttrs.side, side),
    });
  }

  #updateAsSubmenu(state: ReturnType<MenuCore['getState']>, parentCtx: MenuContextValue): void {
    const isActive = state.open;
    const triggerElement = this.parentElement?.querySelector<HTMLElement>(
      `[data-has-submenu][commandfor="${this.id}"]`
    );

    this.#menu?.setTriggerElement(triggerElement ?? null);
    if (triggerElement) applyElementProps(triggerElement, this.#core.getTriggerAttrs(state, this.id));

    this.removeAttribute(MenuDataAttrs.side);
    this.removeAttribute(MenuDataAttrs.align);

    applyElementProps(this, {
      hidden: !isActive,
      'data-menu-view': '',
      'data-menu-view-state': isActive ? 'active' : 'inactive',
      'data-open': isActive ? '' : undefined,
      role: 'menu',
      tabIndex: -1,
      'data-submenu': '',
    });

    if (isActive && !this.#submenuActive) {
      this.#menu?.highlightFirstItem({ preventScroll: true });
    } else if (!isActive && this.#submenuActive) {
      triggerElement?.focus({ preventScroll: true });
    }

    this.#submenuActive = isActive;
    this.#cleanupHeightObserver?.();
    const syncHeight = () => syncMenuHeight(parentCtx.menu.contentElement);
    syncHeight();
    this.#cleanupHeightObserver = isActive ? observeMenuHeight(parentCtx.menu.contentElement!, syncHeight) : null;
  }

  #handleContentKeyDown = (event: UIKeyboardEvent): void => {
    const isNavigationKey = isMenuNavigationKey(event);
    const defaultPreventedBeforeMenu = event.defaultPrevented;

    this.#menu?.contentProps.onKeyDown(event);

    const parentCtx = this.#parentCtx.value ?? null;

    if (!parentCtx) {
      if (event.key === 'Escape') return;
      if (isNavigationKey) {
        event.stopPropagation();
      }
      return;
    }

    const isBackNavigationKey = event.key === 'ArrowLeft' || event.key === 'Escape';

    if (isBackNavigationKey && !defaultPreventedBeforeMenu) {
      event.preventDefault();
      this.#menu?.close('escape');
    }

    if (isNavigationKey) event.stopPropagation();
  };

  #handleContentFocusOut = (event: UIFocusEvent): void => {
    this.#menu?.contentProps.onFocusOut(event);
  };

  #syncTrigger(triggerElement: HTMLElement | null): void {
    if (triggerElement === this.#currentTrigger) return;

    this.#position.cleanup();
    this.#cleanupTrigger();
    this.#currentTrigger = triggerElement;
    this.#menu?.setTriggerElement(triggerElement);

    if (triggerElement && this.#menu) {
      this.#triggerAbort = new AbortController();
      applyElementProps(triggerElement, this.#menu.triggerProps, { signal: this.#triggerAbort.signal });
    }
  }

  #cleanupTrigger(): void {
    if (this.#currentTrigger) {
      applyElementProps(this.#currentTrigger, {
        'aria-expanded': undefined,
        'aria-haspopup': undefined,
        'aria-controls': undefined,
      });
    }

    this.#triggerAbort?.abort();
    this.#triggerAbort = null;
    this.#currentTrigger = null;
  }
}
