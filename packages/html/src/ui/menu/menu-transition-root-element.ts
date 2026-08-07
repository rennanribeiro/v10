import { MenuTransitionDataAttrs } from '@videojs/core';
import {
  createMenuTransition,
  type MenuTransitionApi,
  type MenuTransitionViewApi,
} from '@videojs/core/dom/menu-transition';
import type { PropertyDeclarationMap, PropertyValues } from '@videojs/element';
import { MediaElement } from '../media-element';
import { MenuElement } from './menu-element';
import { MenuTransitionViewElement } from './menu-transition-view-element';

interface RegisteredView {
  element: MenuTransitionViewElement;
  menu: MenuElement;
  trigger: HTMLElement;
  view: MenuTransitionViewApi;
}

/** Binds one direct root menu to explicit child menu destination views. */
export class MenuTransitionRootElement extends MediaElement {
  static readonly tagName = 'media-menu-transition-root';

  static override properties = {
    rootViewClass: { type: String, attribute: 'root-view-class' },
  } satisfies PropertyDeclarationMap<'rootViewClass'>;

  /** Class applied to the generated root panel. */
  rootViewClass = '';

  readonly #controller: MenuTransitionApi = createMenuTransition();
  readonly #views = new Map<MenuTransitionViewElement, RegisteredView>();
  #rootMenu: MenuElement | null = null;
  #rootPanel: HTMLDivElement | null = null;
  #unsubscribeRoot: (() => void) | null = null;
  #observer: MutationObserver | null = null;
  #abort: AbortController | null = null;
  #syncQueued = false;
  #movingChildren = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.#abort = new AbortController();
    this.addEventListener('select', this.#handleSelect as EventListener, { signal: this.#abort.signal });
    this.addEventListener('keydown', this.#handleKeyDown, { signal: this.#abort.signal });

    if (typeof MutationObserver === 'function') {
      this.#observer = new MutationObserver(() => {
        if (!this.#movingChildren) this.#scheduleSync();
      });
      this.#observer.observe(this, { childList: true, subtree: true });
    }
    this.#scheduleSync();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#observer = null;
    this.#abort?.abort();
    this.#abort = null;
    this.#clearViews();
    this.#controller.destroy();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.#scheduleSync();
  }

  #scheduleSync(): void {
    if (this.#syncQueued) return;
    this.#syncQueued = true;
    queueMicrotask(() => {
      this.#syncQueued = false;
      if (this.isConnected) void this.#sync();
    });
  }

  async #sync(): Promise<void> {
    const rootMenu =
      Array.from(this.children).find((child): child is MenuElement => child instanceof MenuElement) ?? null;
    if (!rootMenu) {
      this.#clearViews();
      return;
    }

    if (this.#rootMenu !== rootMenu) {
      this.#clearViews();
      this.#rootMenu = rootMenu;
      this.#rootPanel = document.createElement('div');
      this.#rootPanel.setAttribute(MenuTransitionDataAttrs.rootView, '');
      this.#rootPanel.setAttribute(MenuTransitionDataAttrs.view, '');
      rootMenu.prepend(this.#rootPanel);
      this.#controller.setContainerElement(rootMenu);
      this.#controller.setRootPanelElement(this.#rootPanel);
    }

    const rootPanel = this.#rootPanel;
    if (!rootPanel) return;
    rootPanel.className = this.rootViewClass;

    this.#groupRootChildren(rootMenu);
    await rootMenu.updateComplete;

    const authoredViews = Array.from(rootMenu.children).filter(
      (child): child is MenuTransitionViewElement => child instanceof MenuTransitionViewElement
    );

    for (const [element, registered] of this.#views) {
      if (authoredViews.includes(element)) continue;
      registered.view.destroy();
      registered.menu.setInlineTrigger(null);
      this.#views.delete(element);
    }

    for (const element of authoredViews) {
      if (this.#views.has(element)) continue;
      const menu = Array.from(element.children).find((child): child is MenuElement => child instanceof MenuElement);
      if (!menu?.id) continue;
      const trigger = Array.from(this.#rootPanel?.querySelectorAll<HTMLElement>('[commandfor]') ?? []).find(
        (candidate) => candidate.getAttribute('commandfor') === menu.id
      );
      if (!trigger) continue;

      await menu.updateComplete;
      const menuApi = menu.menuApi;
      if (!menuApi || !this.isConnected) continue;

      menu.setInlineTrigger(trigger);
      const view = this.#controller.registerView(menuApi);
      view.setTriggerElement(trigger);
      view.setPanelElement(menu);
      this.#views.set(element, { element, menu, trigger, view });
    }

    if (!this.#unsubscribeRoot && rootMenu.menuApi) {
      const input = rootMenu.menuApi.input;
      this.#unsubscribeRoot = input.subscribe(() => {
        const current = input.current;
        if (!current.active || current.status === 'ending') this.#controller.reset();
      });
    }
  }

  #groupRootChildren(rootMenu: MenuElement): void {
    const rootPanel = this.#rootPanel;
    if (!rootPanel) return;
    const children = Array.from(rootMenu.children).filter(
      (child) => child !== rootPanel && !(child instanceof MenuTransitionViewElement)
    );
    if (!children.length) return;

    this.#movingChildren = true;
    try {
      rootPanel.append(...children);
    } finally {
      this.#movingChildren = false;
    }
  }

  #handleSelect = (event: CustomEvent): void => {
    const item = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[commandfor]') : null;
    if (!item) return;
    const registered = Array.from(this.#views.values()).find((view) => view.trigger === item);
    if (!registered) return;
    event.preventDefault();
    registered.menu.openMenu('click');
  };

  #handleKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;

    if (event.key === 'ArrowRight') {
      const item = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[commandfor]') : null;
      const registered = item ? Array.from(this.#views.values()).find((view) => view.trigger === item) : undefined;
      if (!registered) return;
      event.preventDefault();
      event.stopPropagation();
      registered.menu.openMenu('click');
      return;
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'Escape') return;
    const active = this.#controller.activeView;
    if (!active) return;
    event.preventDefault();
    event.stopPropagation();
    active.menu.close(event.key === 'Escape' ? 'escape' : 'click');
  };

  #clearViews(): void {
    for (const registered of this.#views.values()) {
      registered.view.destroy();
      registered.menu.setInlineTrigger(null);
    }
    this.#views.clear();
    this.#unsubscribeRoot?.();
    this.#unsubscribeRoot = null;
    this.#controller.setRootPanelElement(null);
    this.#controller.setContainerElement(null);
    this.#rootPanel?.replaceWith(...this.#rootPanel.childNodes);
    this.#rootMenu = null;
    this.#rootPanel = null;
  }
}
