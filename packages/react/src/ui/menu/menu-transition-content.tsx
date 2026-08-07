'use client';

import type { MenuState } from '@videojs/core';
import { isMenuNavigationKey } from '@videojs/core/dom';
import { forwardRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { UIComponentProps } from '../../utils/types';
import { renderElement } from '../../utils/use-render';
import { useMenuContext } from './context';
import { MenuContent as BaseMenuContent, type MenuContentProps as BaseMenuContentProps } from './menu-content';
import { toUIFocusEvent, toUIKeyboardEvent } from './menu-events';
import { useMenuTransitionRootContext, useOptionalMenuTransitionViewContext } from './menu-transition-context';

export interface MenuContentProps extends UIComponentProps<'div', MenuState> {}

/** Base Menu.Content, or an inline destination panel when bound by TransitionView. */
export const MenuContent = forwardRef<HTMLDivElement, MenuContentProps>(function MenuContent(props, forwardedRef) {
  const view = useOptionalMenuTransitionViewContext();
  if (!view) return <BaseMenuContent {...(props as BaseMenuContentProps)} ref={forwardedRef} />;
  return <TransitionViewContent {...props} ref={forwardedRef} view={view} />;
});

interface TransitionViewContentProps extends MenuContentProps {
  view: NonNullable<ReturnType<typeof useOptionalMenuTransitionViewContext>>;
}

const TransitionViewContent = forwardRef<HTMLDivElement, TransitionViewContentProps>(function TransitionViewContent(
  { view, render, className, style, onKeyDown, onBlur, ...elementProps },
  forwardedRef
) {
  const child = useMenuContext();
  const { container } = useMenuTransitionRootContext();
  const setPanel = useCallback(
    (element: HTMLDivElement | null) => {
      view.setPanelElement(element);
      child.menu.setContentElement(element);
    },
    [child.menu, view]
  );
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      const keyboardEvent = toUIKeyboardEvent(event);
      child.menu.contentProps.onKeyDown(keyboardEvent);
      if (event.key === 'ArrowLeft' || event.key === 'Escape') {
        event.preventDefault();
        child.menu.close(event.key === 'Escape' ? 'escape' : 'click');
      }
      if (isMenuNavigationKey(keyboardEvent)) event.stopPropagation();
    },
    [child.menu, onKeyDown]
  );
  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      onBlur?.(event);
      child.menu.contentProps.onFocusOut(toUIFocusEvent(event));
    },
    [child.menu, onBlur]
  );

  if (!container) return null;

  return createPortal(
    renderElement(
      'div',
      { render, className, style },
      {
        state: child.state,
        ref: [forwardedRef, setPanel],
        props: [
          {
            role: 'menu' as const,
            tabIndex: -1,
            onKeyDown: handleKeyDown,
            onBlur: handleBlur,
          },
          elementProps,
        ],
      }
    ),
    container
  );
});

export namespace MenuContent {
  export type Props = MenuContentProps;
  export type State = MenuState;
}
