'use client';

import type { MenuTransitionApi, MenuTransitionViewApi } from '@videojs/core/dom/menu-transition';
import { cloneElement, isValidElement, type ReactElement, type ReactNode, useEffect, useState } from 'react';
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
  const [view] = useState(() => createDeferredViewBinding(controller, menu));

  useEffect(() => view.bind(), [view]);

  return <MenuTransitionViewContextProvider value={view}>{children}</MenuTransitionViewContextProvider>;
}

interface DeferredViewBinding extends MenuTransitionViewApi {
  bind(): () => void;
}

function createDeferredViewBinding(
  controller: MenuTransitionApi,
  menu: ReturnType<typeof useMenuContext>['menu']
): DeferredViewBinding {
  let registered: MenuTransitionViewApi | null = null;
  let trigger: HTMLElement | null = null;
  let panel: HTMLElement | null = null;

  return {
    menu,
    setTriggerElement(element) {
      trigger = element;
      registered?.setTriggerElement(element);
    },
    setPanelElement(element) {
      panel = element;
      registered?.setPanelElement(element);
    },
    bind() {
      registered = controller.registerView(menu);
      registered.setTriggerElement(trigger);
      registered.setPanelElement(panel);
      return () => {
        registered?.destroy();
        registered = null;
      };
    },
    destroy() {
      registered?.destroy();
      registered = null;
    },
  };
}

/** Binds exactly one child Menu.Root to the nearest Menu.TransitionRoot. */
export function MenuTransitionView({ render, children }: MenuTransitionViewProps): ReactNode {
  if (!isValidElement(render)) throw new Error('Menu.TransitionView requires a Menu.Root render element');
  return cloneElement(render, undefined, <MenuTransitionViewBinding>{children}</MenuTransitionViewBinding>);
}

export namespace MenuTransitionView {
  export type Props = MenuTransitionViewProps;
}
