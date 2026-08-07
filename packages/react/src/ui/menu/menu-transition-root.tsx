'use client';

import { MenuTransitionDataAttrs } from '@videojs/core';
import { createMenuTransition } from '@videojs/core/dom/menu-transition';
import {
  type CSSProperties,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { composeRefs } from '../../utils/use-composed-refs';
import { useMenuContext } from './context';
import type { MenuContentProps } from './menu-content';
import { MenuTransitionRootContextProvider } from './menu-transition-context';

export interface MenuTransitionRootProps {
  /** The outer Menu.Content to bind as the transition container. */
  render: ReactElement<MenuContentProps>;
  /** Class applied to the generated root panel. */
  className?: string;
  /** Inline style applied to the generated root panel. */
  style?: CSSProperties;
  children?: ReactNode;
}

/** Binds an outer Menu.Content to its root panel and registered child views. */
export function MenuTransitionRoot({ render, className, style, children }: MenuTransitionRootProps): ReactNode {
  const parentMenu = useMenuContext();
  const [controller] = useState(() => createMenuTransition());
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => () => controller.destroy(), [controller]);
  useEffect(() => {
    if (!parentMenu.state.open) controller.reset();
  }, [controller, parentMenu.state.open]);

  const setContainerElement = useCallback(
    (element: HTMLDivElement | null) => {
      setContainer(element);
      controller.setContainerElement(element);
    },
    [controller]
  );
  const setRootPanelElement = useCallback(
    (element: HTMLDivElement | null) => controller.setRootPanelElement(element),
    [controller]
  );
  const context = useMemo(() => ({ controller, parentMenu, container }), [container, controller, parentMenu]);

  if (!isValidElement(render)) throw new Error('Menu.TransitionRoot requires a Menu.Content render element');

  const renderRef = (render.props as { ref?: React.Ref<HTMLDivElement> }).ref;
  return cloneElement(
    render,
    { ref: composeRefs(renderRef, setContainerElement) },
    <MenuTransitionRootContextProvider value={context}>
      <div
        ref={setRootPanelElement}
        className={className}
        style={style}
        {...{
          [MenuTransitionDataAttrs.rootView]: '',
          [MenuTransitionDataAttrs.view]: '',
          [MenuTransitionDataAttrs.viewState]: 'active',
        }}
      >
        {children}
      </div>
    </MenuTransitionRootContextProvider>
  );
}

export namespace MenuTransitionRoot {
  export type Props = MenuTransitionRootProps;
}
