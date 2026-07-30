import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPlayerWrapper } from '../../../testing/mocks';
import { Poster } from '../poster';

afterEach(cleanup);

function createWrapper(state: Record<string, unknown> = {}) {
  return createPlayerWrapper({
    paused: true,
    ended: false,
    play: vi.fn(),
    pause: vi.fn(),
    togglePaused: vi.fn(),
    contentPoster: '',
    contentPosterAlt: '',
    setContentPoster: vi.fn(),
    setDefaultContentPoster: vi.fn(),
    setContentPosterAlt: vi.fn(),
    setDefaultContentPosterAlt: vi.fn(),
    contentTitle: '',
    setContentTitle: vi.fn(),
    setDefaultContentTitle: vi.fn(),
    ...state,
  }).Wrapper;
}

describe('Poster', () => {
  it('reads the resolved poster from the store when given no src', () => {
    const Wrapper = createWrapper({ contentPoster: 'from-store.jpg' });

    render(
      <Wrapper>
        <Poster data-testid="poster" />
      </Wrapper>
    );

    expect(screen.getByTestId('poster').getAttribute('src')).toBe('from-store.jpg');
  });

  it('uses a local src and ignores the store', () => {
    const Wrapper = createWrapper({ contentPoster: 'from-store.jpg' });

    render(
      <Wrapper>
        <Poster data-testid="poster" src="local.jpg" />
      </Wrapper>
    );

    // A component-level short-circuit, not a fourth precedence tier: the
    // component only decides whether to ask the store.
    expect(screen.getByTestId('poster').getAttribute('src')).toBe('local.jpg');
  });

  it('renders nothing when the resolved value is an empty string', () => {
    const Wrapper = createWrapper({ contentPoster: '' });

    const { container } = render(
      <Wrapper>
        <Poster data-testid="poster" />
      </Wrapper>
    );

    // No element, rather than `src=""` (which requests the current page) or an
    // `<img>` with no source at all. The skins render `<Poster />`
    // unconditionally, so this is the only thing standing between a player with
    // no poster and a stray image element.
    expect(screen.queryByTestId('poster')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders nothing for a local empty src', () => {
    const Wrapper = createWrapper({ contentPoster: 'from-store.jpg' });

    render(
      <Wrapper>
        <Poster data-testid="poster" src="" />
      </Wrapper>
    );

    // The deliberate local exception to "an empty string is a real value": an
    // empty `src` short-circuits the store like any other local src, then means
    // nothing to render.
    expect(screen.queryByTestId('poster')).toBeNull();
  });

  it('still renders with no resolved src when srcSet supplies the image', () => {
    const Wrapper = createWrapper({ contentPoster: '' });

    render(
      <Wrapper>
        <Poster data-testid="poster" srcSet="wide.jpg 2x" />
      </Wrapper>
    );

    expect(screen.getByTestId('poster').getAttribute('srcset')).toBe('wide.jpg 2x');
  });

  it('still renders with no resolved src when a render prop supplies the element', () => {
    const Wrapper = createWrapper({ contentPoster: '' });

    render(
      <Wrapper>
        <Poster render={() => <picture data-testid="custom" />} />
      </Wrapper>
    );

    expect(screen.getByTestId('custom')).toBeTruthy();
  });

  it('reads the resolved alt text from the store', () => {
    const Wrapper = createWrapper({ contentPoster: 'from-store.jpg', contentPosterAlt: 'A description' });

    render(
      <Wrapper>
        <Poster data-testid="poster" />
      </Wrapper>
    );

    expect(screen.getByTestId('poster').getAttribute('alt')).toBe('A description');
  });

  it('keeps an author’s empty alt, which marks the image decorative', () => {
    const Wrapper = createWrapper({ contentPoster: 'from-store.jpg', contentPosterAlt: 'A description' });

    render(
      <Wrapper>
        <Poster data-testid="poster" alt="" />
      </Wrapper>
    );

    // Presence, never emptiness — overwriting a deliberate `alt=""` would be an
    // accessibility regression, not a cosmetic one.
    expect(screen.getByTestId('poster').getAttribute('alt')).toBe('');
  });

  it('passes srcSet and loading through untouched', () => {
    const Wrapper = createWrapper({ contentPoster: 'from-store.jpg' });

    render(
      <Wrapper>
        <Poster data-testid="poster" srcSet="wide.jpg 2x" loading="lazy" />
      </Wrapper>
    );

    const img = screen.getByTestId('poster');
    expect(img.getAttribute('srcset')).toBe('wide.jpg 2x');
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('still renders when the content metadata feature is absent', () => {
    const Wrapper = createPlayerWrapper({
      paused: true,
      ended: false,
      play: vi.fn(),
      pause: vi.fn(),
      togglePaused: vi.fn(),
    }).Wrapper;

    render(
      <Wrapper>
        <Poster data-testid="poster" src="local.jpg" />
      </Wrapper>
    );

    expect(screen.getByTestId('poster').getAttribute('src')).toBe('local.jpg');
  });
});
