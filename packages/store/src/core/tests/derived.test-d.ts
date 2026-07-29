import { assertType, describe, it } from 'vitest';

import { combine } from '../combine';
import { defineSlice } from '../slice';
import { createStore } from '../store';

class MockTarget extends EventTarget {}

const slice = defineSlice<MockTarget>();

const doubler = slice<{ count: number }, { doubled: number }>({
  state: () => ({ count: 1 }),
  derived: { doubled: ({ get }) => get('count') * 2 },
});

const labeller = slice<{ label: string }, { shouted: string }>({
  state: () => ({ label: '' }),
  derived: { shouted: ({ get }) => get('label').toUpperCase() },
});

describe('derived types', () => {
  it('exposes derived keys on the store alongside source keys', () => {
    const store = createStore<MockTarget>()(doubler);

    assertType<number>(store.count);
    assertType<number>(store.doubled);
  });

  it('folds derived keys from every combined slice into the store type', () => {
    const store = createStore<MockTarget>()(combine(doubler, labeller));

    assertType<number>(store.doubled);
    assertType<string>(store.shouted);
  });

  it('marks derived keys readonly on the store', () => {
    const store = createStore<MockTarget>()(doubler);

    store.count = 2;

    // Regression test, not a spike: `BaseStore` carries a `[key: string]: unknown`
    // index signature, and a readonly member has to win over it for this marking
    // to be worth anything. Verified against TypeScript 5.9 and 6.0.
    // @ts-expect-error — derived keys are readonly
    store.doubled = 4;
  });

  it('rejects a write to a derived key through a slice’s own set', () => {
    slice<{ count: number }, { doubled: number }>({
      state: () => ({ count: 1 }),
      derived: { doubled: ({ get }) => get('count') * 2 },
      attach({ set }) {
        set({ count: 2 });

        // `attach` is typed against source state only, so the derived key is not
        // assignable — the runtime filter in `patch` is belt-and-braces for the
        // paths the compiler cannot reach.
        // @ts-expect-error — `doubled` is not a source key
        set({ doubled: 4 });
      },
    });
  });

  it('rejects a formula reading another formula’s output', () => {
    slice<{ count: number }, { doubled: number; quadrupled: number }>({
      state: () => ({ count: 1 }),
      derived: {
        doubled: ({ get }) => get('count') * 2,
        // This is what removes the need for run ordering and cycle detection.
        // @ts-expect-error — `doubled` is not a source key
        quadrupled: ({ get }) => get('doubled') * 2,
      },
    });
  });
});
