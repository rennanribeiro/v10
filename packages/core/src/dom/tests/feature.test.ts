import { createSelector, type StateContext } from '@videojs/store';
import type { EmptyObject } from '@videojs/utils/types';
import { describe, expect, it } from 'vitest';
import { definePlayerFeature } from '../feature';
import type { PlayerTarget } from '../player';

const stateContext = {
  target: () => {
    throw new Error('Target is not available in this test.');
  },
  signals: undefined as unknown as StateContext<PlayerTarget>['signals'],
  get: () => ({}),
  set: () => {},
} satisfies StateContext<PlayerTarget>;

describe('definePlayerFeature', () => {
  it('defines a plain player feature', () => {
    const feature = definePlayerFeature({
      name: 'plain',
      state: () => ({ enabled: true }),
    });

    expect(feature.name).toBe('plain');
    expect(feature.state(stateContext).enabled).toBe(true);
  });

  it('defines a feature that derives state', () => {
    const feature = definePlayerFeature<{ count: number }, { doubled: number }>({
      name: 'derives',
      state: () => ({ count: 2 }),
      derived: { doubled: ({ get }) => get('count') * 2 },
    });

    expect(feature.derived?.doubled({ get: () => 3 })).toBe(6);
    expect(createSelector(feature).displayName).toBe('derives');
  });

  it('defines a feature that declares provider props', () => {
    const feature = definePlayerFeature<
      { setLabel: (value: string | null | undefined) => void },
      EmptyObject,
      { label?: string | null | undefined }
    >({
      name: 'declares',
      state: ({ set }) => ({ setLabel: (value) => set({ label: value } as never) }),
      providerProps: {
        label: { type: String, attribute: 'label', action: 'setLabel' },
      },
    });

    expect(feature.providerProps?.label).toEqual({ type: String, attribute: 'label', action: 'setLabel' });
  });

  it('leaves a feature that declares nothing contributing no provider props', () => {
    const feature = definePlayerFeature({ name: 'plain', state: () => ({ enabled: true }) });

    expect(feature.providerProps).toBeUndefined();
  });
});
