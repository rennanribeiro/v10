import type { EmptyObject, Simplify, UnionToIntersection } from '@videojs/utils/types';
import type { AbortControllerRegistry } from './abort-controller-registry';
import type { UnknownState } from './state';

// ----------------------------------------
// Attach
// ----------------------------------------

export type Attach<Target, State, Derived = EmptyObject> = (ctx: AttachContext<Target, State, Derived>) => void;

export interface AttachStore {
  readonly state: UnknownState;
  subscribe: (callback: () => void) => () => void;
}

export interface AttachContext<Target, State, Derived = EmptyObject> {
  target: Target;
  signal: AbortSignal;
  store: AttachStore;
  /** Reads everything, including this slice's derived values. */
  get: () => Readonly<State & Derived>;
  /** Writes source keys only. A derived key's formula is its own sole writer. */
  set: (partial: Partial<State>) => void;
  reportError: (error: unknown) => void;
}

// ----------------------------------------
// State Context
// ----------------------------------------

export interface StateContext<Target> {
  /** Returns the current target. Throws if not attached. */
  target: () => Target;
  /**
   * Cancellation signals for async operations.
   *
   * - `signals.base` — Aborts on detach or reattach. Use for cleanup.
   * - `signals.supersede(key)` — Returns a signal that aborts when the same key
   *   is superseded or when base aborts. Use for operations that should cancel
   *   previous in-flight work (e.g., seek superseding seek).
   * - `signals.clear()` — Aborts all keyed signals. Use when starting fresh
   *   (e.g., loading a new source cancels pending seeks).
   */
  signals: AbortControllerRegistry;
  /** Read current slice state. Safe to use inside action closures (not during `state()` init). */
  get: () => Readonly<Record<string, unknown>>;
  /** Patch the slice state. Safe to use inside action closures (not during `state()` init). */
  set: (partial: Record<string, unknown>) => void;
}

// ----------------------------------------
// Slice
// ----------------------------------------

// ----------------------------------------
// Derived
// ----------------------------------------

/**
 * Read access handed to a derived formula.
 *
 * Only *source* keys are readable. A formula that tried to read another
 * formula's output would not compile, which is what removes the need for run
 * ordering and cycle detection.
 */
export interface DerivedContext<Source> {
  get: <K extends keyof Source>(key: K) => Source[K];
}

/** One formula per derived key, each a plain function of the slice's source state. */
export type DerivedMap<Source, Derived> = {
  [K in keyof Derived]: (ctx: DerivedContext<Source>) => Derived[K];
};

// ----------------------------------------
// Slice
// ----------------------------------------

export interface SliceConfig<Target, State, Derived = EmptyObject> {
  /** Debug label. Used as `displayName` on selectors created from this slice. */
  name?: string;
  state: (ctx: StateContext<Target>) => State;
  /**
   * Values the store computes from this slice's own state, recomputed inside
   * every patch that changed something and folded into the same snapshot.
   *
   * Derived keys are readable on the store like any other state, but are
   * `readonly` in the types and rejected by `patch` at runtime — the formula is
   * the only writer.
   */
  derived?: DerivedMap<State, Derived>;
  attach?: (ctx: AttachContext<Target, State, Derived>) => void;
}

export type Slice<Target, State, Derived = EmptyObject> = SliceConfig<Target, State, Derived>;

export type AnySlice<Target = any> = Slice<Target, any, any>;

// ----------------------------------------
// Factory
// ----------------------------------------

export type SliceFactory<Target> = <State, Derived = EmptyObject>(
  config: SliceConfig<Target, State, Derived>
) => Slice<Target, State, Derived>;

export function defineSlice<Target>(): SliceFactory<Target> {
  return (config) => config;
}

// ----------------------------------------
// Inference
// ----------------------------------------

export type InferSliceTarget<S> = S extends Slice<infer Target, any, any> ? Target : never;

/** The keys a slice's `state()` returns — the only keys `set` accepts. */
export type InferSliceSource<S> = S extends Slice<any, infer State, any> ? State : never;

/** The keys a slice's formulas produce. */
export type InferSliceDerived<S> = S extends Slice<any, any, infer Derived> ? Derived : never;

/** Everything readable on a slice: its source state plus its derived keys, read-only. */
export type InferSliceState<S> = InferSliceSource<S> & Readonly<InferSliceDerived<S>>;

export type UnionSliceSource<Slices extends AnySlice[]> = Simplify<
  UnionToIntersection<InferSliceSource<Slices[number]>>
>;

export type UnionSliceDerived<Slices extends AnySlice[]> = Simplify<
  UnionToIntersection<InferSliceDerived<Slices[number]>>
>;

export type UnionSliceState<Slices extends AnySlice[]> = Simplify<UnionToIntersection<InferSliceState<Slices[number]>>>;
