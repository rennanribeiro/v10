import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { Container } from '../../../player/container';
import { createPlayerWrapper } from '../../../testing/mocks';
import { Popover } from '../../popover';
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

  it('reflects a named grouped popover while it is open', async () => {
    const { Wrapper } = createPlayerWrapper({
      controlsVisible: true,
      userActive: true,
    });
    const { getByRole, getByTestId } = render(
      <Wrapper>
        <Container>
          <ControlsRoot data-testid="controls">
            <Popover.Root name="volume">
              <Popover.Trigger render={<button type="button">Volume</button>} />
              <Popover.Popup>Slider</Popover.Popup>
            </Popover.Root>
          </ControlsRoot>
        </Container>
      </Wrapper>
    );

    fireEvent.click(getByRole('button', { name: 'Volume' }));
    await waitFor(() => expect(getByTestId('controls').getAttribute('data-active-popup')).toBe('volume'));

    fireEvent.click(getByRole('button', { name: 'Volume' }));
    await waitFor(() => expect(getByTestId('controls').hasAttribute('data-active-popup')).toBe(false));
  });
});
