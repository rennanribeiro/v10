import type { PopupGroup } from '@videojs/core/dom';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

const PopupGroupContext = createContext<PopupGroup | undefined>(undefined);

export function PopupGroupProvider({ value, children }: { value: PopupGroup; children: ReactNode }): ReactNode {
  return <PopupGroupContext.Provider value={value}>{children}</PopupGroupContext.Provider>;
}

export function useOptionalPopupGroup(): PopupGroup | undefined {
  return useContext(PopupGroupContext);
}

export function useActivePopupName(): string | null {
  const group = useOptionalPopupGroup();
  const subscribe = useCallback((listener: () => void) => group?.subscribe(listener) ?? (() => {}), [group]);
  const getSnapshot = useCallback(() => group?.activeName ?? null, [group]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
