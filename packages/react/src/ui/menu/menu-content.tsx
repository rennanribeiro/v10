'use client';

import type { MenuState } from '@videojs/core';
import {
  getRootPositionOptions,
  isMenuNavigationKey,
  observeMenuHeight,
  syncMenuHeight,
  type UIFocusEvent,
  type UIKeyboardEvent,
} from '@videojs/core/dom';
import { forwardRef, useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import type { UIComponentProps } from '../../utils/types';
import { useComposedRefs } from '../../utils/use-composed-refs';
import { renderElement } from '../../utils/use-render';
import { usePopupPosition } from '../popover/use-popup-position';
import { useMenuContext } from './context';

export interface MenuContentProps extends UIComponentProps<'div', MenuState> {}

const menuPreventedNativeEvents = new WeakSet<Event>();

function toUIKeyboardEvent(event: React.KeyboardEvent<HTMLDivElement>): UIKeyboardEvent {
  return {
    get defaultPrevented() {
      return event.defaultPrevented;
    },
    key: event.key,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    target: event.target instanceof Node ? event.target : event.currentTarget,
    currentTarget: event.currentTarget,
    preventDefault: () => event.preventDefault(),
    stopPropagation: () => event.stopPropagation(),
  };
}

function toUIFocusEvent(event: React.FocusEvent<HTMLDivElement>): UIFocusEvent {
  return {
    get defaultPrevented() {
      return event.defaultPrevented;
    },
    relatedTarget: event.relatedTarget,
    preventDefault: () => event.preventDefault(),
    stopPropagation: () => event.stopPropagation(),
  };
}

function preventMenuKeyDefault(event: React.KeyboardEvent<HTMLDivElement>): void {
  const keyboardEvent = toUIKeyboardEvent(event);

  if (event.key !== 'Escape' && isMenuNavigationKey(keyboardEvent) && !event.defaultPrevented) {
    event.preventDefault();
    menuPreventedNativeEvents.add(event.nativeEvent);
  }
}

function callKeyDownHandler(
  handler: React.KeyboardEventHandler<HTMLDivElement> | undefined,
  event: React.KeyboardEvent<HTMLDivElement>
): boolean {
  const defaultPreventedBeforeHandler = event.defaultPrevented && !menuPreventedNativeEvents.has(event.nativeEvent);

  if (!handler) return defaultPreventedBeforeHandler;

  let defaultPreventedByHandler = false;
  const preventDefault = event.preventDefault;
  event.preventDefault = () => {
    defaultPreventedByHandler = true;
    preventDefault.call(event);
  };

  try {
    handler(event);
  } finally {
    event.preventDefault = preventDefault;
  }

  return defaultPreventedBeforeHandler || defaultPreventedByHandler;
}

/** Container for menu items. Positioned relative to the trigger at root level; renders in-place as a submenu panel when nested. */
export const MenuContent = forwardRef<HTMLDivElement, MenuContentProps>(function MenuContent(
  { render, className, style, onKeyDown, onBlur, ...elementProps },
  forwardedRef
) {
  const {
    core,
    menu,
    parent,
    state,
    preferredSide,
    setPositionedSide,
    stateAttrMap,
    anchorName,
    contentId,
    boundary,
    container,
  } = useMenuContext();
  const isSubmenu = state.isSubmenu;
  const isActive = isSubmenu && state.open;
  const wasActiveRef = useRef(false);

  useLayoutEffect(() => {
    if (!isSubmenu) return undefined;

    const wasActive = wasActiveRef.current;
    wasActiveRef.current = isActive;

    if (isActive && !wasActive) {
      const frame = requestAnimationFrame(() => menu.highlightFirstItem({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }

    if (!isActive && wasActive) {
      menu.triggerElement?.focus({ preventScroll: true });
    }

    return undefined;
  }, [isActive, isSubmenu, menu]);

  const setMenuViewElement = useCallback(
    (element: HTMLDivElement | null) => {
      menu.setContentElement(element);
      if (!element) {
        requestAnimationFrame(() => syncMenuHeight(parent?.menu.contentElement ?? null));
      }
    },
    [menu, parent]
  );

  const handleSubMenuKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const defaultPreventedByUser = callKeyDownHandler(
        onKeyDown as React.KeyboardEventHandler<HTMLDivElement> | undefined,
        event
      );
      const keyboardEvent = toUIKeyboardEvent(event);
      const isNavigationKey = isMenuNavigationKey(keyboardEvent);
      menu.contentProps.onKeyDown(keyboardEvent);
      const isBackNavigationKey = event.key === 'ArrowLeft' || event.key === 'Escape';

      if (isBackNavigationKey && !defaultPreventedByUser) {
        event.preventDefault();
        menu.close('escape');
      }

      if (isNavigationKey) event.stopPropagation();
    },
    [onKeyDown, menu]
  );

  const handleRootMenuKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      (onKeyDown as React.KeyboardEventHandler<HTMLDivElement> | undefined)?.(event);
      const keyboardEvent = toUIKeyboardEvent(event);
      menu.contentProps.onKeyDown(keyboardEvent);
      if (event.key === 'Escape') return;
      if (isMenuNavigationKey(keyboardEvent)) event.stopPropagation();
    },
    [onKeyDown, menu]
  );

  const handleRootMenuBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      (onBlur as React.FocusEventHandler<HTMLDivElement> | undefined)?.(event);
      menu.contentProps.onFocusOut(toUIFocusEvent(event));
    },
    [onBlur, menu]
  );

  const internalRef = useRef<HTMLDivElement>(null);
  const contentRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (!isSubmenu) menu.setContentElement(element);
    },
    [isSubmenu, menu]
  );
  const rootComposedRef = useComposedRefs(forwardedRef, contentRef, internalRef);
  const menuViewComposedRef = useComposedRefs(forwardedRef, setMenuViewElement);
  const positionOptions = useMemo(
    () => getRootPositionOptions(preferredSide, state.align),
    [preferredSide, state.align]
  );
  const positioningStyle = usePopupPosition({
    open: state.open && !isSubmenu,
    anchorName,
    position: positionOptions,
    triggerSource: menu,
    popupRef: internalRef,
    boundary,
    container,
    onSideChange: setPositionedSide,
  });

  useLayoutEffect(() => {
    if (isSubmenu || !state.open) return;

    const contentElement = internalRef.current;
    if (!contentElement) return;

    const sync = () => syncMenuHeight(contentElement);
    sync();
    const frame = requestAnimationFrame(sync);
    const stopObserving = observeMenuHeight(contentElement, sync);

    return () => {
      cancelAnimationFrame(frame);
      stopObserving();
    };
  }, [isSubmenu, state.open]);

  useLayoutEffect(() => {
    if (!isSubmenu) return;

    const parentContentElement = parent?.menu.contentElement ?? null;
    const sync = () => syncMenuHeight(parentContentElement);
    sync();
    const frame = requestAnimationFrame(sync);
    const stopObserving = state.open && parentContentElement ? observeMenuHeight(parentContentElement, sync) : null;

    return () => {
      cancelAnimationFrame(frame);
      stopObserving?.();
    };
  }, [isSubmenu, parent, state.open]);

  if (isSubmenu) {
    if (!isActive) return null;

    const subMenuContent = renderElement(
      'div',
      { render, className, style },
      {
        state,
        ref: menuViewComposedRef,
        props: [
          {
            id: contentId,
            'data-menu-view': '',
            'data-menu-view-state': 'active',
            'data-open': '',
            role: 'menu' as const,
            tabIndex: -1,
            'data-submenu': '',
            onKeyDownCapture: preventMenuKeyDefault,
            onKeyDown: handleSubMenuKeyDown,
            onBlur,
          },
          elementProps,
        ],
      }
    );

    const parentContentElement = parent?.menu.contentElement ?? null;
    return parentContentElement ? createPortal(subMenuContent, parentContentElement) : subMenuContent;
  }

  if (!state.open) return null;

  return renderElement(
    'div',
    { render, className, style },
    {
      state,
      stateAttrMap,
      ref: rootComposedRef,
      props: [
        {
          id: contentId,
          style: positioningStyle,
          ...core.getContentAttrs(state),
        },
        { onKeyDownCapture: preventMenuKeyDefault, onKeyDown: handleRootMenuKeyDown, onBlur: handleRootMenuBlur },
        elementProps,
      ],
    }
  );
});

export namespace MenuContent {
  export type Props = MenuContentProps;
  export type State = MenuState;
}
