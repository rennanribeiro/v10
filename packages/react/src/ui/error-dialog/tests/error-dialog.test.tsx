import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { registerI18n, resetI18nRegistry } from '@videojs/core/i18n';
import { type RefCallback } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { ErrorDialog } from '..';
import { I18nProvider } from '../../../i18n';
import { createPlayerWrapper } from '../../../testing/mocks';

afterEach(() => {
  resetI18nRegistry();
  cleanup();
});

describe('ErrorDialog', () => {
  it.each([
    { clientHeight: 100, expectedTabIndex: -1, scrollHeight: 100 },
    { clientHeight: 100, expectedTabIndex: 0, scrollHeight: 200 },
  ])(
    'sets content tabIndex to $expectedTabIndex when its visible and scroll heights are $clientHeight and $scrollHeight',
    ({ clientHeight, expectedTabIndex, scrollHeight }) => {
      const { Wrapper } = createPlayerWrapper({
        error: { code: 4, message: 'The media could not be played.' },
        dismissError: vi.fn(),
      });
      const setMetrics: RefCallback<HTMLDivElement> = (element) => {
        if (!element) return;

        Object.defineProperties(element, {
          clientHeight: { configurable: true, value: clientHeight },
          scrollHeight: { configurable: true, value: scrollHeight },
        });
      };

      render(
        <Wrapper>
          <ErrorDialog.Root>
            <ErrorDialog.Popup>
              <ErrorDialog.Content data-testid="content" ref={setMetrics}>
                <ErrorDialog.Description />
              </ErrorDialog.Content>
              <ErrorDialog.Close />
            </ErrorDialog.Popup>
          </ErrorDialog.Root>
        </Wrapper>
      );

      expect(screen.getByTestId('content').tabIndex).toBe(expectedTabIndex);
    }
  );

  it('shows translated title, description, and dismiss label when locale is es', () => {
    registerI18n('es', {
      'errors.title': 'Algo salió mal.',
      'common.ok': 'Aceptar',
      'errors.network': 'Error de red.',
      'errors.unexpected': 'Ocurrió un error inesperado.',
    });

    const error = {
      code: 2,
      message: 'This media could not be loaded due to a network or server issue.',
    };
    const { Wrapper } = createPlayerWrapper({
      error,
      dismissError: vi.fn(),
    });

    render(
      <Wrapper>
        <I18nProvider locale="es">
          <ErrorDialog.Root>
            <ErrorDialog.Backdrop data-testid="backdrop" />
            <ErrorDialog.Popup>
              <ErrorDialog.Title data-testid="title" />
              <ErrorDialog.Description data-testid="description" />
              <ErrorDialog.Close data-testid="close" />
            </ErrorDialog.Popup>
          </ErrorDialog.Root>
        </I18nProvider>
      </Wrapper>
    );

    expect(screen.getByTestId('backdrop').getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByTestId('title').textContent).toBe('Algo salió mal.');
    expect(screen.getByTestId('description').textContent).toBe('Error de red.');
    expect(screen.getByTestId('close').textContent).toBe('Aceptar');
  });

  it('scopes dialog semantics to the player container', async () => {
    const container = document.createElement('div');
    const { Wrapper, value } = createPlayerWrapper({
      error: { code: 4, message: 'The media could not be played.' },
      dismissError: vi.fn(),
    });

    value.container = container;
    document.body.append(container);

    const { getByRole } = render(
      <Wrapper>
        <ErrorDialog.Root>
          <ErrorDialog.Popup>
            <ErrorDialog.Title />
          </ErrorDialog.Popup>
        </ErrorDialog.Root>
      </Wrapper>,
      { container }
    );

    const popup = await waitFor(() => getByRole('alertdialog'));

    expect(popup.hasAttribute('aria-modal')).toBe(false);
  });
});
