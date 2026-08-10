import { describe, expect, it } from 'vitest';
import { PosterPlaceholderCore } from '../poster-placeholder-core';

describe('PosterPlaceholderCore', () => {
  describe('getState', () => {
    it('is visible before playback starts and hidden after', () => {
      const core = new PosterPlaceholderCore();

      core.setMedia({ started: false, posterPlaceholder: 'tiny.jpg' });
      expect(core.getState().visible).toBe(true);

      core.setMedia({ started: true, posterPlaceholder: 'tiny.jpg' });
      expect(core.getState().visible).toBe(false);
    });

    it('passes the resolved URL through untouched', () => {
      const core = new PosterPlaceholderCore();

      core.setMedia({ started: false, posterPlaceholder: 'tiny.jpg' });

      expect(core.getState()).toEqual({ visible: true, src: 'tiny.jpg' });
    });

    it('reports an empty src when nothing supplied a poster placeholder', () => {
      const core = new PosterPlaceholderCore();

      core.setMedia({ started: false, posterPlaceholder: '' });

      expect(core.getState().src).toBe('');
    });

    it('stays visible without a src, mirroring the poster it sits behind', () => {
      const core = new PosterPlaceholderCore();

      core.setMedia({ started: false, posterPlaceholder: '' });

      // Nothing is painted either way, so visibility tracks playback alone and
      // both components read the same `data-visible` rules.
      expect(core.getState().visible).toBe(true);
    });
  });
});
