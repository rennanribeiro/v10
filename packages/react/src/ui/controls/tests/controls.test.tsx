import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createPlayerWrapper } from '../../../testing/mocks';
import { ControlsRoot } from '../controls-root';

afterEach(cleanup);

describe('ControlsRoot', () => {
  it('marks the controls surface as interactive', () => {
    const { Wrapper } = createPlayerWrapper({
      controlsVisible: true,
      userActive: true,
    });
    const { getByTestId } = render(<ControlsRoot data-testid="controls" />, { wrapper: Wrapper });

    expect(getByTestId('controls').hasAttribute('data-interactive')).toBe(true);
    expect(getByTestId('controls').hasAttribute('data-active-popup')).toBe(false);
  });
});
