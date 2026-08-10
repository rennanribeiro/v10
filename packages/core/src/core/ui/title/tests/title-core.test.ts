import { describe, expect, it } from 'vitest';
import { TitleCore, type TitleMediaState } from '../title-core';

function createMediaState(overrides: Partial<TitleMediaState> = {}): TitleMediaState {
  return {
    contentTitle: 'Big Buck Bunny',
    paused: true,
    controlsVisible: true,
    ...overrides,
  };
}

describe('TitleCore', () => {
  describe('getState', () => {
    it('returns the resolved content title', () => {
      const core = new TitleCore();

      core.setMedia(createMediaState({ contentTitle: 'Sintel' }));

      expect(core.getState().title).toBe('Sintel');
    });

    it('returns hasTitle: false for the empty resolved title', () => {
      const core = new TitleCore();

      core.setMedia(createMediaState({ contentTitle: '' }));
      const state = core.getState();

      expect(state.hasTitle).toBe(false);
      expect(state.visible).toBe(false);
    });

    it('returns only primitive values (no methods)', () => {
      const core = new TitleCore();

      core.setMedia(createMediaState());
      const state = core.getState();

      expect(state).toEqual({ title: 'Big Buck Bunny', hasTitle: true, visible: true });

      const functionKeys = Object.entries(state).filter(([, value]) => typeof value === 'function');
      expect(functionKeys).toHaveLength(0);
    });
  });

  describe('visibility', () => {
    it('is visible when a title exists, controls are visible, and playback is paused', () => {
      const core = new TitleCore();

      core.setMedia(createMediaState({ controlsVisible: true, paused: true }));

      expect(core.getState().visible).toBe(true);
    });

    it('is hidden while playing even when controls are visible', () => {
      const core = new TitleCore();

      core.setMedia(createMediaState({ controlsVisible: true, paused: false }));

      expect(core.getState().visible).toBe(false);
    });

    it('is hidden when controls are hidden even while paused', () => {
      const core = new TitleCore();

      core.setMedia(createMediaState({ controlsVisible: false, paused: true }));

      expect(core.getState().visible).toBe(false);
    });

    it('stays hidden without a title regardless of controls and playback', () => {
      const core = new TitleCore();

      core.setMedia(createMediaState({ contentTitle: '', controlsVisible: true, paused: true }));

      expect(core.getState().visible).toBe(false);
    });
  });

  describe('without the controls feature', () => {
    it('treats controls as always visible', () => {
      const core = new TitleCore();

      core.setMedia({ contentTitle: 'Sintel', paused: true });

      expect(core.getState().visible).toBe(true);
    });

    it('still follows playback', () => {
      const core = new TitleCore();

      core.setMedia({ contentTitle: 'Sintel', paused: false });

      expect(core.getState().visible).toBe(false);
    });
  });
});
