import { describe, expect, it, vi } from 'vitest';
import { createPopupGroup, type PopupGroupMember } from '../popup-group';

function createMember(name: string | null): PopupGroupMember {
  return {
    name,
    triggerElement: document.createElement('button'),
    close: vi.fn(),
  };
}

describe('createPopupGroup', () => {
  it('exposes the active member name and clears it on close', () => {
    const group = createPopupGroup();
    const volume = createMember('volume');

    group.open(volume);
    expect(group.activeName).toBe('volume');

    group.close(volume);
    expect(group.activeName).toBeNull();
  });

  it('keeps the latest member active across rapid changes and stale closes', () => {
    const group = createPopupGroup();
    const volume = createMember('volume');
    const settings = createMember('settings');

    group.open(volume);
    group.open(settings);
    group.close(volume);

    expect(volume.close).toHaveBeenCalledWith('group-open');
    expect(group.activeName).toBe('settings');
  });

  it('notifies subscribers when the active member changes', () => {
    const group = createPopupGroup();
    const listener = vi.fn();
    const unsubscribe = group.subscribe(listener);
    const volume = createMember('volume');

    group.open(volume);
    group.close(volume);
    unsubscribe();
    group.open(volume);

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
