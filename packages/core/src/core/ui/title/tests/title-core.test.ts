import type { MediaMetadataState } from '@videojs/media';
import { describe, expect, it, vi } from 'vitest';
import { TitleCore } from '../title-core';

function createMediaState(overrides: Partial<MediaMetadataState> = {}): MediaMetadataState {
  return {
    contentTitle: 'Big Buck Bunny',
    setContentTitle: vi.fn(),
    setDefaultContentTitle: vi.fn(),
    ...overrides,
  };
}

describe('TitleCore', () => {
  describe('getState', () => {
    it('returns the resolved content title', () => {
      const core = new TitleCore();

      const state = core.getState(createMediaState({ contentTitle: 'Sintel' }));

      expect(state.title).toBe('Sintel');
      expect(state.hidden).toBe(false);
    });

    it('is hidden for the empty resolved title', () => {
      const core = new TitleCore();

      const state = core.getState(createMediaState({ contentTitle: '' }));

      expect(state).toEqual({ title: '', hidden: true });
    });

    it('returns only primitive values (no methods)', () => {
      const core = new TitleCore();

      const state = core.getState(createMediaState());

      expect(state).toEqual({ title: 'Big Buck Bunny', hidden: false });

      const functionKeys = Object.entries(state).filter(([, value]) => typeof value === 'function');
      expect(functionKeys).toHaveLength(0);
    });
  });
});
