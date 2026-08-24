export type PopupGroupCloseReason = 'group-open';

export interface PopupGroupMember {
  close: (reason: PopupGroupCloseReason) => void;
  readonly name: string | null;
  readonly triggerElement: HTMLElement | null;
}

export interface PopupGroup {
  readonly activeName: string | null;
  open: (member: PopupGroupMember) => void;
  close: (member: PopupGroupMember) => void;
  isOpenFor: (trigger: HTMLElement | null) => boolean;
  subscribe: (listener: () => void) => () => void;
}

export function createPopupGroup(): PopupGroup {
  let current: PopupGroupMember | null = null;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  return {
    get activeName() {
      return current?.name ?? null;
    },

    open(member) {
      if (current === member) return;

      const previous = current;

      current = member;
      previous?.close('group-open');
      notify();
    },

    close(member) {
      if (current !== member) return;

      current = null;
      notify();
    },

    isOpenFor(trigger) {
      return trigger !== null && current?.triggerElement === trigger;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
