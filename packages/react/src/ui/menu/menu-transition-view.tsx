'use client';

import { cloneElement, isValidElement, type ReactElement, type ReactNode, useEffect } from 'react';
import { useMenuContext } from './context';
import type { MenuRootProps } from './menu-root';
import { MenuTransitionViewContextProvider, useMenuTransitionRootContext } from './menu-transition-context';

export interface MenuTransitionViewProps {
  /** The child Menu.Root represented by this destination view. */
  render: ReactElement<MenuRootProps>;
  children?: ReactNode;
}

function MenuTransitionViewBinding({ children }: { children?: ReactNode }): ReactNode {
  const { menu } = useMenuContext();
  const { controller } = useMenuTransitionRootContext();

  useEffect(() => controller.registerView(menu), [controller, menu]);

  return <MenuTransitionViewContextProvider value>{children}</MenuTransitionViewContextProvider>;
}

/** Binds exactly one child Menu.Root to the nearest Menu.TransitionRoot. */
export function MenuTransitionView({ render, children }: MenuTransitionViewProps): ReactNode {
  if (!isValidElement(render)) throw new Error('Menu.TransitionView requires a Menu.Root render element');
  return cloneElement(render, { isSubmenu: true }, <MenuTransitionViewBinding>{children}</MenuTransitionViewBinding>);
}

export namespace MenuTransitionView {
  export type Props = MenuTransitionViewProps;
}
