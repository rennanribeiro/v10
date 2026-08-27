import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createPlayerWrapper } from '../../../testing/mocks';
import { ControlsContent } from '../controls-content';
import { ControlsRoot } from '../controls-root';

afterEach(cleanup);

describe('ControlsRoot', () => {
  it('renders no wrapper element', () => {
    const { Wrapper } = createPlayerWrapper({
      controlsVisible: true,
      userActive: true,
    });
    const { container } = render(
      <ControlsRoot>
        <span data-testid="child" />
      </ControlsRoot>,
      { wrapper: Wrapper }
    );

    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild?.localName).toBe('span');
  });

  it('keeps controls visible when the player has no controls visibility feature', () => {
    const { Wrapper } = createPlayerWrapper();
    const { getByTestId } = render(
      <ControlsRoot>
        <ControlsContent data-testid="controls" />
      </ControlsRoot>,
      { wrapper: Wrapper }
    );

    expect(getByTestId('controls').hasAttribute('data-visible')).toBe(true);
    expect(getByTestId('controls').hasAttribute('data-user-active')).toBe(true);
  });
});

describe('ControlsContent', () => {
  it('marks the controls surface as interactive and receives controls state', () => {
    const { Wrapper } = createPlayerWrapper({
      controlsVisible: true,
      userActive: true,
    });
    const { getByTestId } = render(
      <ControlsRoot>
        <ControlsContent data-testid="controls" />
      </ControlsRoot>,
      { wrapper: Wrapper }
    );

    const content = getByTestId('controls');

    expect(content.hasAttribute('data-interactive')).toBe(true);
    expect(content.hasAttribute('data-visible')).toBe(true);
    expect(content.hasAttribute('data-user-active')).toBe(true);
  });
});
