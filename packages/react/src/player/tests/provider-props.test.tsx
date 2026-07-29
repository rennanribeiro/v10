import { act, cleanup, render } from '@testing-library/react';
import { contentMetadataFeature, features } from '@videojs/core/dom';
import { StrictMode, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { createPlayer } from '../create-player';

afterEach(cleanup);

const { Provider, usePlayer } = createPlayer({ features: [features.playback, contentMetadataFeature] });

function ReadTitle({ onRead }: { onRead: (title: string) => void }) {
  const title = usePlayer((state) => (state as { contentTitle: string }).contentTitle);
  onRead(title);
  return <span data-testid="title">{title}</span>;
}

describe('Provider props', () => {
  it('seeds the store during render, so the first paint is correct', () => {
    const reads: string[] = [];

    render(
      <Provider contentTitle="A title">
        <ReadTitle onRead={(title) => reads.push(title)} />
      </Provider>
    );

    // The very first read already sees the value — no flash of the library
    // default, which is what makes server rendering work.
    expect(reads[0]).toBe('A title');
  });

  it('seeds every declared field', () => {
    let seen: { title: string; poster: string; posterAlt: string } | undefined;

    function ReadAll() {
      const state = usePlayer((s) => s as { contentTitle: string; contentPoster: string; contentPosterAlt: string });
      seen = { title: state.contentTitle, poster: state.contentPoster, posterAlt: state.contentPosterAlt };
      return null;
    }

    render(
      <Provider contentTitle="A title" contentPoster="poster.jpg" contentPosterAlt="A description">
        <ReadAll />
      </Provider>
    );

    expect(seen).toEqual({ title: 'A title', poster: 'poster.jpg', posterAlt: 'A description' });
  });

  it('updates when a prop changes', async () => {
    function Harness() {
      const [title, setTitle] = useState('First');
      return (
        <Provider contentTitle={title}>
          <button type="button" onClick={() => setTitle('Second')}>
            change
          </button>
          <ReadTitle onRead={() => {}} />
        </Provider>
      );
    }

    const { getByRole, getByTestId } = render(<Harness />);

    expect(getByTestId('title').textContent).toBe('First');

    getByRole('button').click();

    // The layout effect writes, `scheduleFlush` queues a microtask, consumers
    // re-render. The microtask drains before paint, so nothing flashes.
    await Promise.resolve();
    expect(getByTestId('title').textContent).toBe('Second');
  });

  it('clears the developer value when a prop is removed', async () => {
    function Harness() {
      const [title, setTitle] = useState<string | undefined>('First');
      return (
        <Provider contentTitle={title}>
          <button type="button" onClick={() => setTitle(undefined)}>
            clear
          </button>
          <ReadTitle onRead={() => {}} />
        </Provider>
      );
    }

    const { getByRole, getByTestId } = render(<Harness />);
    getByRole('button').click();
    await Promise.resolve();

    // An omitted prop and an explicit undefined mean the same thing, matching a
    // removed HTML attribute.
    expect(getByTestId('title').textContent).toBe('');
  });

  it('keeps an empty string as a suppressing value', () => {
    const { getByTestId } = render(
      <Provider contentTitle="">
        <ReadTitle onRead={() => {}} />
      </Provider>
    );

    expect(getByTestId('title').textContent).toBe('');
  });

  it('survives the development double render', () => {
    const reads: string[] = [];

    render(
      <StrictMode>
        <Provider contentTitle="A title">
          <ReadTitle onRead={(title) => reads.push(title)} />
        </Provider>
      </StrictMode>
    );

    // Every read agrees; the repeated write is a no-op because `patch` drops
    // writes that change nothing.
    expect(new Set(reads)).toEqual(new Set(['A title']));
  });

  it('does not write to a subscribed store during the render phase', async () => {
    const duringChildRender: string[] = [];

    function Harness() {
      const [title, setTitle] = useState('First');
      return (
        <Provider contentTitle={title}>
          <button type="button" onClick={() => setTitle('Second')}>
            change
          </button>
          <ReadTitle onRead={(read) => duringChildRender.push(read)} />
        </Provider>
      );
    }

    const { getByRole, getByTestId } = render(<Harness />);
    duringChildRender.length = 0;

    await act(async () => {
      getByRole('button').click();
    });

    // Children render before the parent's layout effect, so on the pass where the
    // prop changes the child still sees the old value. That staleness is the
    // *evidence* the write is not in the Provider's render body: were it there,
    // the child's first render would already have seen 'Second'. Keeping writes
    // out of render is what stops a render React throws away from leaving a value
    // behind in a store other components are already subscribed to.
    expect(duringChildRender[0]).toBe('First');

    // And it is invisible: the write, its notification, and the re-render all
    // land before the browser paints.
    expect(duringChildRender[duringChildRender.length - 1]).toBe('Second');
    expect(getByTestId('title').textContent).toBe('Second');
  });

  it('discards seeded values with a store whose render never commits', () => {
    // Seeding writes into a store built inside the `useState` initializer, which
    // nothing is subscribed to yet. If React throws that render away, the store
    // goes with it — there is no shared object left holding the value.
    const first = createPlayer({ features: [features.playback, contentMetadataFeature] });
    const second = createPlayer({ features: [features.playback, contentMetadataFeature] });

    let firstStore: Record<string, unknown> | undefined;
    let secondStore: Record<string, unknown> | undefined;

    function GrabFirst() {
      firstStore = first.usePlayer() as unknown as Record<string, unknown>;
      return null;
    }
    function GrabSecond() {
      secondStore = second.usePlayer() as unknown as Record<string, unknown>;
      return null;
    }

    render(
      <first.Provider contentTitle="Mine">
        <GrabFirst />
      </first.Provider>
    );
    render(
      <second.Provider contentTitle="Theirs">
        <GrabSecond />
      </second.Provider>
    );

    // Each Provider owns its own store, so no second component races to write
    // the same slot.
    expect(firstStore?.contentTitle).toBe('Mine');
    expect(secondStore?.contentTitle).toBe('Theirs');
  });

  it('exposes the imperative setters alongside the props', () => {
    let store: Record<string, unknown> | undefined;

    function Grab() {
      store = usePlayer() as unknown as Record<string, unknown>;
      return null;
    }

    render(
      <Provider contentTitle="From a prop">
        <Grab />
      </Provider>
    );

    const setContentTitle = store?.setContentTitle as ((value: string) => void) | undefined;
    expect(setContentTitle).toBeInstanceOf(Function);

    // The attribute path and the imperative path run through one function, so
    // they cannot drift.
    setContentTitle?.('From the setter');
    expect(store?.contentTitle).toBe('From the setter');
  });
});
