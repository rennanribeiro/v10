import { describe, expect, it } from 'vite-plus/test';

import { ContainerCore } from '../core';

describe('ContainerCore', () => {
  it.each([true, false])('reflects controls visibility when %s', (controlsVisible) => {
    const core = new ContainerCore();

    core.setMedia({ controlsVisible } as Parameters<ContainerCore['setMedia']>[0]);

    expect(core.getState()).toEqual({ activePopupName: null, controlsVisible });
  });

  it('includes the active popup name without requiring controls state', () => {
    const core = new ContainerCore();

    core.setActivePopupName('volume');

    expect(core.getState()).toEqual({ activePopupName: 'volume', controlsVisible: false });
  });
});
