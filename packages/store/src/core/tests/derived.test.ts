import { beforeEach, describe, expect, it, vi } from 'vitest';

import { combine } from '../combine';
import { createSelector } from '../selector';
import { defineSlice } from '../slice';
import { flush, type WritableState } from '../state';
import { createStore } from '../store';

class MockTarget extends EventTarget {
  value = 0;
}

const slice = defineSlice<MockTarget>();

const USER = Symbol('user');
const MEDIA = Symbol('media');
const DEFAULT = Symbol('default');

const LIBRARY_DEFAULT = '';

type Tier = string | null | undefined;

interface TitleSource {
  /** User and default tiers are deliberately absent from `state()` so the reset in `detach` cannot reach them. */
  [USER]?: Tier;
  /** The media tier *is* seeded, so the reset clears it when the media goes away. */
  [MEDIA]: Tier;
  [DEFAULT]?: Tier;
  setTitle: (value: Tier) => void;
  setMediaTitle: (value: Tier) => void;
  setDefaultTitle: (value: Tier) => void;
}

interface TitleDerived {
  title: string;
}

/** Mirrors the metadata feature: three symbol-keyed tier slots, one derived answer. */
function titleSlice() {
  return slice<TitleSource, TitleDerived>({
    name: 'title',
    state: ({ set }): TitleSource => ({
      [MEDIA]: undefined,
      setTitle: (value) => set({ [USER]: value }),
      setMediaTitle: (value) => set({ [MEDIA]: value }),
      setDefaultTitle: (value) => set({ [DEFAULT]: value }),
    }),
    derived: {
      title: ({ get }) => get(USER) ?? get(MEDIA) ?? get(DEFAULT) ?? LIBRARY_DEFAULT,
    },
  });
}

/** Escape hatch for the one test that deliberately writes a derived key. */
function writable(store: { $state: unknown }): WritableState<Record<PropertyKey, unknown>> {
  return store.$state as WritableState<Record<PropertyKey, unknown>>;
}

beforeEach(() => {
  flush();
});

describe('derived', () => {
  it('seeds the derived value from its formula before getters are installed', () => {
    const store = createStore<MockTarget>()(titleSlice());

    expect(store.title).toBe(LIBRARY_DEFAULT);
    expect(Object.keys(store.state)).toContain('title');
  });

  it('recomputes when a source key changes', () => {
    const store = createStore<MockTarget>()(titleSlice());

    store.setMediaTitle('from media');
    expect(store.title).toBe('from media');

    store.setTitle('from user');
    expect(store.title).toBe('from user');
  });

  it('resolves tiers in user, media, default, library order regardless of write order', () => {
    const store = createStore<MockTarget>()(titleSlice());

    store.setDefaultTitle('developer default');
    expect(store.title).toBe('developer default');

    store.setMediaTitle('from media');
    expect(store.title).toBe('from media');

    store.setTitle('from user');
    expect(store.title).toBe('from user');

    // Clearing a tier falls back through the rest of the chain.
    store.setTitle(undefined);
    expect(store.title).toBe('from media');

    store.setMediaTitle(undefined);
    expect(store.title).toBe('developer default');

    store.setDefaultTitle(undefined);
    expect(store.title).toBe(LIBRARY_DEFAULT);
  });

  it('resolves the same answer whichever order the tiers are written in', () => {
    const forwards = createStore<MockTarget>()(titleSlice());
    forwards.setTitle('user');
    forwards.setMediaTitle('media');

    const backwards = createStore<MockTarget>()(titleSlice());
    backwards.setMediaTitle('media');
    backwards.setTitle('user');

    expect(forwards.title).toBe(backwards.title);
    expect(forwards.title).toBe('user');
  });

  it('treats an empty string as a value that beats lower tiers', () => {
    const store = createStore<MockTarget>()(titleSlice());

    store.setMediaTitle('from media');
    store.setTitle('');

    expect(store.title).toBe('');
  });

  it('treats null the same as undefined, so a cleared attribute falls through', () => {
    const store = createStore<MockTarget>()(titleSlice());

    store.setMediaTitle('from media');
    store.setTitle(null);

    expect(store.title).toBe('from media');
  });

  it('recomputes before the snapshot is frozen, so no intermediate value is observable', () => {
    const store = createStore<MockTarget>()(titleSlice());
    const seen: string[] = [];

    store.subscribe(() => seen.push(store.title));

    store.setTitle('a');
    flush();

    expect(seen).toEqual(['a']);
    expect(Object.isFrozen(store.state)).toBe(true);
  });

  it('fires a single notification for a patch that changes source and derived keys', () => {
    const store = createStore<MockTarget>()(titleSlice());
    const listener = vi.fn();

    store.subscribe(listener);

    writable(store).patch({ [USER]: 'a', [MEDIA]: 'b' });
    flush();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify when a patch changes nothing', () => {
    const store = createStore<MockTarget>()(titleSlice());
    const listener = vi.fn();

    store.setMediaTitle('same');
    flush();

    store.subscribe(listener);
    store.setMediaTitle('same');
    flush();

    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores a direct write to a derived key and warns in dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createStore<MockTarget>()(titleSlice());

    store.setTitle('from user');
    writable(store).patch({ title: 'smuggled' });

    expect(store.title).toBe('from user');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('derived key "title"'));

    warn.mockRestore();
  });

  it('installs derived keys as getter-only properties', () => {
    const store = createStore<MockTarget>()(titleSlice());

    expect(() => {
      (store as unknown as Record<string, unknown>).title = 'nope';
    }).toThrow();
  });
});

describe('derived through detach', () => {
  it('preserves user and default tiers, clears the media tier, and re-resolves', () => {
    const store = createStore<MockTarget>()(titleSlice());
    const detach = store.attach(new MockTarget());

    store.setTitle('from user');
    store.setMediaTitle('from media');
    expect(store.title).toBe('from user');

    detach();

    // The media tier was in the initial state, so the reset cleared it. The user
    // tier was not, so the reset could not reach it — and the formula, being the
    // only writer of `title`, restores the right answer.
    expect(store.state[MEDIA]).toBeUndefined();
    expect(store.title).toBe('from user');
  });

  it('falls back to the developer default after detach when no user value is set', () => {
    const store = createStore<MockTarget>()(titleSlice());
    const detach = store.attach(new MockTarget());

    store.setDefaultTitle('developer default');
    store.setMediaTitle('from media');
    expect(store.title).toBe('from media');

    detach();
    expect(store.title).toBe('developer default');
  });

  it('leaves the resolved value correct across detach and reattach', () => {
    const store = createStore<MockTarget>()(titleSlice());

    let detach = store.attach(new MockTarget());
    store.setTitle('from user');
    store.setMediaTitle('first');
    detach();

    detach = store.attach(new MockTarget());
    store.setMediaTitle('second');
    expect(store.title).toBe('from user');

    store.setTitle(undefined);
    expect(store.title).toBe('second');

    detach();
  });

  it('does not warn when detach resets state', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createStore<MockTarget>()(titleSlice());

    const detach = store.attach(new MockTarget());
    store.setMediaTitle('from media');
    detach();

    // `detach` resets from a source-only copy, so it never trips the
    // derived-write warning on an ordinary teardown.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('derived with symbol keys', () => {
  it('gives symbol-keyed slots no getter on the store', () => {
    const store = createStore<MockTarget>()(titleSlice());

    expect(USER in store).toBe(false);
    expect(MEDIA in store).toBe(false);
    expect(Object.keys(store.state)).not.toContain(MEDIA);
  });

  it('keeps symbol-keyed slots readable on the snapshot', () => {
    const store = createStore<MockTarget>()(titleSlice());

    store.setMediaTitle('from media');

    expect(store.state[MEDIA]).toBe('from media');
    expect(Object.getOwnPropertySymbols(store.state)).toContain(MEDIA);
  });

  it('participates in the no-op check like a string key', () => {
    const store = createStore<MockTarget>()(titleSlice());
    const before = store.state;

    store.setMediaTitle(undefined);

    expect(store.state).toBe(before);
  });

  it('keeps snapshots frozen against external mutation', () => {
    const store = createStore<MockTarget>()(titleSlice());

    store.setMediaTitle('from media');

    expect(() => {
      (store.state as unknown as Record<symbol, unknown>)[MEDIA] = 'mutated';
    }).toThrow();
  });

  it('excludes symbol slots from combine duplicate-key warnings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    createStore<MockTarget>()(combine(titleSlice(), slice({ state: () => ({ other: 1 }) })));

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('combine with derived', () => {
  it('merges derived maps across slices', () => {
    const a = slice<{ count: number; setCount: (n: number) => void }, { doubled: number }>({
      state: ({ set }) => ({ count: 1, setCount: (n) => set({ count: n }) }),
      derived: { doubled: ({ get }) => get('count') * 2 },
    });
    const b = slice<{ label: string; setLabel: (s: string) => void }, { shouted: string }>({
      state: ({ set }) => ({ label: 'hi', setLabel: (s) => set({ label: s }) }),
      derived: { shouted: ({ get }) => get('label').toUpperCase() },
    });

    const store = createStore<MockTarget>()(combine(a, b));

    expect(store.doubled).toBe(2);
    expect(store.shouted).toBe('HI');

    store.setCount(5);
    store.setLabel('bye');

    expect(store.doubled).toBe(10);
    expect(store.shouted).toBe('BYE');
  });

  it('warns on a duplicate derived key across slices', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const a = slice<{ count: number }, { total: number }>({
      state: () => ({ count: 1 }),
      derived: { total: ({ get }) => get('count') },
    });
    const b = slice<{ other: number }, { total: number }>({
      state: () => ({ other: 2 }),
      derived: { total: ({ get }) => get('other') },
    });

    createStore<MockTarget>()(combine(a, b));

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('duplicate derived key "total"'));
    warn.mockRestore();
  });

  it('leaves slices without derived maps untouched', () => {
    const a = slice({ state: () => ({ count: 0 }) });
    const b = slice({ state: () => ({ label: '' }) });

    const store = createStore<MockTarget>()(combine(a, b));

    expect(store.state).toEqual({ count: 0, label: '' });
  });
});

describe('createSelector with derived', () => {
  it('includes derived keys in selector output', () => {
    const feature = titleSlice();
    const selectTitle = createSelector(feature);
    const store = createStore<MockTarget>()(combine(feature, slice({ state: () => ({ other: 1 }) })));

    store.setMediaTitle('from media');

    expect(selectTitle(store.state)).toMatchObject({ title: 'from media' });
  });

  it('resolves a slice whose only non-action key is derived', () => {
    const feature = slice<{ count: number }, { doubled: number }>({
      name: 'doubler',
      state: () => ({ count: 2 }),
      derived: { doubled: ({ get }) => get('count') * 2 },
    });

    const selectDoubler = createSelector(feature);
    const store = createStore<MockTarget>()(feature);

    expect(selectDoubler(store.state)).toEqual({ count: 2, doubled: 4 });
  });
});
