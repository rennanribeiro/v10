import { resolveCSSLength } from '@videojs/utils/dom';
import { MenuCSSVars } from '../../../core/ui/menu/menu-css-vars';
import { MenuTransitionDataAttrs } from '../../../core/ui/menu/menu-data-attrs';
import { PopoverCSSVars } from '../../../core/ui/popover/popover-css-vars';
import { TransitionDataAttrs } from '../../../core/ui/transition';
import { forceLayout } from '../../utils/layout';
import { waitForAnimations as waitForElementAnimations } from '../transition';
import type { MenuApi } from './create-menu';

export type MenuTransitionDirection = 'forward' | 'back';
export type MenuTransitionPhase = 'hidden' | 'entering' | 'active' | 'exiting';
export type MenuViewState = 'active' | 'inactive';

export interface MenuTransitionViewApi {
  readonly menu: MenuApi;
  setTriggerElement(element: HTMLElement | null): void;
  setPanelElement(element: HTMLElement | null): void;
  destroy(): void;
}

export interface MenuTransitionOptions {
  minWidth?: number;
  waitForAnimations?: (element: HTMLElement) => Promise<void>;
}

export interface MenuTransitionApi {
  readonly activeView: MenuTransitionViewApi | null;
  setContainerElement(element: HTMLElement | null): void;
  setRootPanelElement(element: HTMLElement | null): void;
  registerView(menu: MenuApi): MenuTransitionViewApi;
  reset(): void;
  destroy(): void;
}

interface ViewSize {
  width: number;
  height: number;
}

interface ViewRecord {
  api: MenuTransitionViewApi;
  menu: MenuApi;
  trigger: HTMLElement | null;
  panel: HTMLElement | null;
  activationOrder: number;
  unsubscribe: () => void;
}

interface InlineStyleSnapshotEntry {
  property: string;
  value: string;
  priority: string;
}

const DEFAULT_MIN_WIDTH = 160;
const VIEW_MEASURE_STYLE_PROPERTIES = [
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'min-width',
  'max-width',
];

function snapshotInlineStyle(element: HTMLElement): InlineStyleSnapshotEntry[] {
  return VIEW_MEASURE_STYLE_PROPERTIES.map((property) => ({
    property,
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  }));
}

function restoreInlineStyle(element: HTMLElement, snapshot: InlineStyleSnapshotEntry[]): void {
  for (const { property, value, priority } of snapshot) {
    if (value) element.style.setProperty(property, value, priority);
    else element.style.removeProperty(property);
  }
}

function resolveAvailableWidth(container: HTMLElement): number | null {
  const value =
    container.style.getPropertyValue(MenuCSSVars.availableWidth) ||
    container.style.getPropertyValue(PopoverCSSVars.availableWidth) ||
    getComputedStyle(container).getPropertyValue(MenuCSSVars.availableWidth) ||
    getComputedStyle(container).getPropertyValue(PopoverCSSVars.availableWidth);
  const width = resolveCSSLength(container, value);
  return Number.isFinite(width) && width > 0 ? width : null;
}

function measurePanel(container: HTMLElement, panel: HTMLElement, minWidth: number): ViewSize {
  const snapshot = snapshotInlineStyle(panel);
  const wasHidden = panel.hidden;

  try {
    panel.hidden = false;
    panel.style.setProperty('position', 'absolute');
    panel.style.setProperty('top', '0px');
    panel.style.setProperty('right', 'auto');
    panel.style.setProperty('bottom', 'auto');
    panel.style.setProperty('left', '0px');
    panel.style.setProperty('width', 'max-content');
    panel.style.setProperty('height', 'auto');
    panel.style.setProperty('min-width', `${minWidth}px`);
    panel.style.setProperty('max-width', 'none');

    let rect = panel.getBoundingClientRect();
    const naturalWidth = Math.ceil(Math.max(minWidth, rect.width, panel.scrollWidth));
    const availableWidth = resolveAvailableWidth(container);
    const width = Math.ceil(availableWidth ? Math.min(naturalWidth, Math.max(minWidth, availableWidth)) : naturalWidth);

    if (width !== naturalWidth) {
      panel.style.setProperty('width', `${width}px`);
      panel.style.setProperty('max-width', `${width}px`);
      rect = panel.getBoundingClientRect();
    }

    return {
      width,
      height: Math.ceil(Math.max(rect.height, panel.scrollHeight)),
    };
  } finally {
    restoreInlineStyle(panel, snapshot);
    panel.hidden = wasHidden;
  }
}

function setPanelPhase(
  panel: HTMLElement,
  phase: MenuTransitionPhase,
  direction: MenuTransitionDirection,
  root = false
): void {
  panel.setAttribute(MenuTransitionDataAttrs.view, '');
  panel.toggleAttribute(MenuTransitionDataAttrs.rootView, root);
  panel.toggleAttribute(MenuTransitionDataAttrs.submenu, !root);

  const active = phase === 'entering' || phase === 'active';
  panel.setAttribute(MenuTransitionDataAttrs.viewState, active ? 'active' : 'inactive');
  panel.setAttribute(MenuTransitionDataAttrs.direction, direction);
  panel.toggleAttribute(TransitionDataAttrs.transitionStarting, phase === 'entering');
  panel.toggleAttribute(TransitionDataAttrs.transitionEnding, phase === 'exiting');
  panel.toggleAttribute('data-open', phase !== 'hidden');
  panel.hidden = phase === 'hidden';
  panel.inert = !active;

  if (active) panel.removeAttribute('aria-hidden');
  else panel.setAttribute('aria-hidden', 'true');
}

/** Coordinates one root menu panel and its explicitly registered child menu views. */
export function createMenuTransition(options: MenuTransitionOptions = {}): MenuTransitionApi {
  const minWidth = options.minWidth ?? DEFAULT_MIN_WIDTH;
  const waitForAnimations = options.waitForAnimations ?? waitForElementAnimations;
  const views = new Set<ViewRecord>();
  const viewsByMenu = new Map<MenuApi, ViewRecord>();
  let container: HTMLElement | null = null;
  let rootPanel: HTMLElement | null = null;
  let activeRecord: ViewRecord | null = null;
  let activationOrder = 0;
  let transitionId = 0;
  let raf1 = 0;
  let raf2 = 0;
  let focusRaf = 0;
  let resizeObserver: ResizeObserver | null = null;

  function cancelFrames(): void {
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
    cancelAnimationFrame(focusRaf);
    raf1 = 0;
    raf2 = 0;
    focusRaf = 0;
  }

  function observe(panel: HTMLElement | null): void {
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (!panel || typeof ResizeObserver !== 'function') return;

    resizeObserver = new ResizeObserver(() => measure(panel));
    resizeObserver.observe(panel);
  }

  function measure(panel: HTMLElement | null): void {
    if (!container || !panel) return;
    const size = measurePanel(container, panel, minWidth);
    container.style.setProperty(MenuCSSVars.width, `${size.width}px`);
    container.style.setProperty(MenuCSSVars.height, `${size.height}px`);
  }

  function initializePanels(): void {
    if (rootPanel) {
      setPanelPhase(rootPanel, activeRecord ? 'hidden' : 'active', activeRecord ? 'forward' : 'back', true);
    }

    for (const view of views) {
      if (!view.panel) continue;
      setPanelPhase(view.panel, view === activeRecord ? 'active' : 'hidden', 'forward');
    }

    const target = activeRecord?.panel ?? rootPanel;
    measure(target);
    observe(target);
  }

  function scheduleEnterComplete(id: number, entering: HTMLElement, outgoing: HTMLElement | null): void {
    forceLayout(entering);
    raf1 = requestAnimationFrame(() => {
      if (id !== transitionId) return;
      raf2 = requestAnimationFrame(async () => {
        if (id !== transitionId) return;
        setPanelPhase(entering, 'active', entering === rootPanel ? 'back' : 'forward', entering === rootPanel);
        forceLayout(entering);
        if (outgoing) await waitForAnimations(outgoing);
        if (id !== transitionId) return;
        if (outgoing)
          setPanelPhase(outgoing, 'hidden', entering === rootPanel ? 'back' : 'forward', outgoing === rootPanel);
      });
    });
  }

  function activate(view: ViewRecord): void {
    if (activeRecord === view) return;
    const previous = activeRecord;
    if (previous && previous !== view) previous.menu.close('imperative-action');

    activeRecord = view;
    view.activationOrder = ++activationOrder;
    if (
      __DEV__ &&
      Array.from(views).filter(({ menu }) => menu.input.current.active && menu.input.current.status !== 'ending')
        .length > 1
    ) {
      console.warn(
        '[vjs-menu-transition] Multiple controlled child menus are open; showing the most recently opened view.'
      );
    }
    transitionId++;
    cancelFrames();
    const id = transitionId;
    const entering = view.panel;
    const outgoing = previous?.panel ?? rootPanel;

    if (!entering) return;
    if (outgoing) setPanelPhase(outgoing, 'exiting', 'forward', outgoing === rootPanel);
    setPanelPhase(entering, 'entering', 'forward');
    measure(entering);
    observe(entering);
    scheduleEnterComplete(id, entering, outgoing);
    focusRaf = requestAnimationFrame(() => {
      focusRaf = 0;
      if (id === transitionId) view.menu.highlightFirstItem({ preventScroll: true });
    });
  }

  function deactivate(view: ViewRecord): void {
    if (activeRecord !== view) return;
    const fallback = Array.from(views)
      .filter(
        (candidate) =>
          candidate !== view && candidate.menu.input.current.active && candidate.menu.input.current.status !== 'ending'
      )
      .sort((a, b) => b.activationOrder - a.activationOrder)[0];

    if (fallback) {
      activeRecord = fallback;
      transitionId++;
      cancelFrames();
      initializePanels();
      return;
    }

    activeRecord = null;
    transitionId++;
    cancelFrames();
    const id = transitionId;
    const outgoing = view.panel;
    const entering = rootPanel;

    if (!entering) return;
    if (outgoing) setPanelPhase(outgoing, 'exiting', 'back');
    setPanelPhase(entering, 'entering', 'back', true);
    measure(entering);
    observe(entering);
    scheduleEnterComplete(id, entering, outgoing);

    if (outgoing) {
      waitForAnimations(outgoing).then(() => {
        if (id === transitionId) view.trigger?.focus({ preventScroll: true });
      });
    }
  }

  function sync(view: ViewRecord): void {
    const { active, status } = view.menu.input.current;
    if (active && status !== 'ending') activate(view);
    else if (activeRecord === view && (status === 'ending' || !active)) deactivate(view);
  }

  function registerView(menu: MenuApi): MenuTransitionViewApi {
    const existing = viewsByMenu.get(menu);
    if (existing) {
      if (__DEV__) console.warn('[vjs-menu-transition] A child Menu root can only be registered once.');
      return existing.api;
    }

    let record!: ViewRecord;
    const api: MenuTransitionViewApi = {
      menu,
      setTriggerElement(element) {
        record.trigger?.removeAttribute(MenuTransitionDataAttrs.hasSubmenu);
        record.trigger = element;
        element?.setAttribute(MenuTransitionDataAttrs.hasSubmenu, '');
      },
      setPanelElement(element) {
        record.panel = element;
        initializePanels();
        sync(record);
      },
      destroy() {
        if (!views.delete(record)) return;
        viewsByMenu.delete(record.menu);
        record.unsubscribe();
        record.trigger?.removeAttribute(MenuTransitionDataAttrs.hasSubmenu);
        if (activeRecord === record) {
          activeRecord =
            Array.from(views)
              .filter(({ menu }) => menu.input.current.active && menu.input.current.status !== 'ending')
              .sort((a, b) => b.activationOrder - a.activationOrder)[0] ?? null;
          initializePanels();
        }
        record.trigger = null;
        record.panel = null;
      },
    };
    record = {
      api,
      menu,
      trigger: null,
      panel: null,
      activationOrder: 0,
      unsubscribe: () => {},
    };
    record.unsubscribe = menu.input.subscribe(() => sync(record));
    views.add(record);
    viewsByMenu.set(menu, record);
    sync(record);
    return api;
  }

  function reset(): void {
    transitionId++;
    cancelFrames();
    for (const view of views) {
      if (view.menu.input.current.active) view.menu.close('imperative-action');
    }
    if (!activeRecord?.menu.input.current.active) {
      activeRecord =
        Array.from(views)
          .filter(({ menu }) => menu.input.current.active && menu.input.current.status !== 'ending')
          .sort((a, b) => b.activationOrder - a.activationOrder)[0] ?? null;
    }
    initializePanels();
  }

  return {
    get activeView() {
      return activeRecord?.api ?? null;
    },
    setContainerElement(element) {
      container = element;
      initializePanels();
    },
    setRootPanelElement(element) {
      rootPanel = element;
      initializePanels();
    },
    registerView,
    reset,
    destroy() {
      transitionId++;
      cancelFrames();
      resizeObserver?.disconnect();
      resizeObserver = null;
      for (const view of views) view.unsubscribe();
      views.clear();
      viewsByMenu.clear();
      activeRecord = null;
      rootPanel = null;
      container = null;
    },
  };
}
