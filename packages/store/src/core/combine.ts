import type {
  AnySlice,
  AttachContext,
  InferSliceSource,
  Slice,
  StateContext,
  UnionSliceDerived,
  UnionSliceSource,
} from './slice';
import type { DerivedFormulas } from './state';

/**
 * Combines multiple slices into a single slice.
 *
 * @param slices - The slices to combine.
 * @returns A new slice that represents the combination of the input slices.
 */
export function combine<Target, const Slices extends Slice<Target, any, any>[]>(
  ...slices: Slices
): Slice<Target, UnionSliceSource<Slices>, UnionSliceDerived<Slices>> {
  const derived = mergeDerived(slices);

  const combined: Slice<Target, UnionSliceSource<Slices>, any> = {
    state: (ctx: StateContext<Target>) => {
      const states = slices.map((slice) => slice.state(ctx));

      if (__DEV__) {
        const seen = new Set<string>();
        for (const state of states) {
          for (const key of Object.keys(state as object)) {
            if (seen.has(key)) {
              console.warn(`[vjs-store] combine(): duplicate state key "${key}" — later slice overwrites earlier one`);
            }
            seen.add(key);
          }
        }
      }

      return Object.assign({}, ...states) as UnionSliceSource<Slices>;
    },

    attach: (ctx: AttachContext<Target, UnionSliceSource<Slices>, UnionSliceDerived<Slices>>) => {
      for (const slice of slices) {
        try {
          slice.attach?.(ctx as AttachContext<Target, InferSliceSource<typeof slice>>);
        } catch (err) {
          ctx.reportError(err);
        }
      }
    },
  };

  // Assigned conditionally so a feature set with no formulas produces a slice
  // with no `derived` key at all, letting the store skip the recompute pass.
  if (derived) combined.derived = derived as NonNullable<typeof combined.derived>;

  return combined as Slice<Target, UnionSliceSource<Slices>, UnionSliceDerived<Slices>>;
}

/**
 * Flattens every slice's `derived` map into one. Returns `undefined` when no
 * slice declares any.
 */
function mergeDerived(slices: readonly AnySlice[]): DerivedFormulas | undefined {
  let merged: DerivedFormulas | undefined;

  for (const slice of slices) {
    if (!slice.derived) continue;

    const formulas = slice.derived as DerivedFormulas;

    for (const key of Reflect.ownKeys(formulas)) {
      if (__DEV__ && merged && key in merged) {
        // Names the slice, unlike the duplicate-state-key warning above. That
        // one leaves you grepping every feature for the key; a formula is even
        // harder to find by hand, so the name is worth the interpolation.
        const from = slice.name ? ` declared by "${slice.name}"` : '';
        console.warn(
          `[vjs-store] combine(): duplicate derived key "${String(key)}"${from} — later slice overwrites earlier one`
        );
      }

      (merged ??= {})[key] = formulas[key as string]!;
    }
  }

  return merged;
}
