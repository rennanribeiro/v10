import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { createPlayerWrapper } from '../../../testing/mocks';
import { PosterPlaceholder } from '../poster-placeholder';

afterEach(cleanup);

function wrapper(state: { started?: boolean; posterPlaceholder?: string } = {}) {
  const { started = false, posterPlaceholder = '' } = state;
  return createPlayerWrapper({
    paused: !started,
    ended: false,
    started,
    waiting: false,
    play: async () => {},
    pause: () => {},
    togglePaused: () => true,
    contentTitle: '',
    poster: '',
    posterPlaceholder,
    setContentTitle: () => {},
    setDefaultContentTitle: () => {},
    setPoster: () => {},
    setDefaultPoster: () => {},
    setPosterPlaceholder: () => {},
    setDefaultPosterPlaceholder: () => {},
  }).Wrapper;
}

describe('PosterPlaceholder', () => {
  it('paints the resolved poster placeholder as its background image', () => {
    const { getByTestId } = render(<PosterPlaceholder data-testid="poster-placeholder" />, {
      wrapper: wrapper({ posterPlaceholder: 'tiny.jpg' }),
    });

    expect(getByTestId('poster-placeholder').style.backgroundImage).toBe('url("tiny.jpg")');
  });

  it('paints nothing when nothing supplied a poster placeholder', () => {
    const { getByTestId } = render(<PosterPlaceholder data-testid="poster-placeholder" />, { wrapper: wrapper() });

    expect(getByTestId('poster-placeholder').style.backgroundImage).toBe('');
    expect(getByTestId('poster-placeholder').hasAttribute('data-visible')).toBe(true);
  });

  it('hides once playback starts', () => {
    const { getByTestId } = render(<PosterPlaceholder data-testid="poster-placeholder" />, {
      wrapper: wrapper({ started: true, posterPlaceholder: 'tiny.jpg' }),
    });

    expect(getByTestId('poster-placeholder').hasAttribute('data-visible')).toBe(false);
    // The image stays put so the fade-out has something to fade.
    expect(getByTestId('poster-placeholder').style.backgroundImage).toBe('url("tiny.jpg")');
  });

  it('renders one empty element', () => {
    const { getByTestId } = render(<PosterPlaceholder data-testid="poster-placeholder" />, {
      wrapper: wrapper({ posterPlaceholder: 'tiny.jpg' }),
    });

    const element = getByTestId('poster-placeholder');
    expect(element.tagName).toBe('DIV');
    expect(element.childNodes).toHaveLength(0);
  });

  it('lets an author style override the background image', () => {
    const { getByTestId } = render(
      <PosterPlaceholder data-testid="poster-placeholder" style={{ backgroundImage: 'url("mine.jpg")' }} />,
      { wrapper: wrapper({ posterPlaceholder: 'tiny.jpg' }) }
    );

    expect(getByTestId('poster-placeholder').style.backgroundImage).toBe('url("mine.jpg")');
  });
});
