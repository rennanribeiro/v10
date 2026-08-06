export interface MenuRootViewAttrs {
  'data-menu-root-view': '';
  'data-menu-view': '';
}

const MENU_VIEW_ATTR = 'data-menu-view';
const MENU_ROOT_VIEW_ATTR = 'data-menu-root-view';
const MENU_VIEW_STATE_ATTR = 'data-menu-view-state';
const MENU_HEIGHT_VAR = '--media-menu-height';

export function getMenuRootViewAttrs(): MenuRootViewAttrs {
  return { 'data-menu-root-view': '', 'data-menu-view': '' };
}

function getRootView(content: HTMLElement): HTMLElement | null {
  return content.querySelector<HTMLElement>(`:scope > [${MENU_ROOT_VIEW_ATTR}]`);
}

function getActiveView(content: HTMLElement): HTMLElement | null {
  return (
    Array.from(content.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child.hasAttribute(MENU_VIEW_ATTR) &&
        !child.hasAttribute(MENU_ROOT_VIEW_ATTR) &&
        !child.hidden
    ) ?? null
  );
}

/** Synchronize the content height to the currently visible menu panel. */
export function syncMenuHeight(content: HTMLElement | null): void {
  if (!content) return;

  const rootView = getRootView(content);
  const activeView = getActiveView(content);

  if (rootView) {
    const rootActive = !activeView;
    rootView.hidden = !rootActive;
    rootView.setAttribute(MENU_VIEW_STATE_ATTR, rootActive ? 'active' : 'inactive');
  }

  const view = activeView ?? rootView;
  if (!view) return;

  const height = Math.ceil(Math.max(view.getBoundingClientRect().height, view.scrollHeight));
  content.style.setProperty(MENU_HEIGHT_VAR, `${height}px`);
}

/** Re-measure when the active panel changes size. */
export function observeMenuHeight(content: HTMLElement, onResize: () => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};

  const view = getActiveView(content) ?? getRootView(content);
  if (!view) return () => {};

  const observer = new ResizeObserver(onResize);
  observer.observe(view);
  return () => observer.disconnect();
}
