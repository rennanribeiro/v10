import { isNull, isObject } from '@videojs/utils/predicate';
import type { EmptyObject } from '@videojs/utils/types';
import { AbortControllerRegistry } from './abort-controller-registry';
import type { StoreCallbacks } from './config';
import { throwDestroyedError, throwNoTargetError } from './errors';
import type { AttachContext, Slice, StateContext } from './slice';
import type {
  DerivedFormulas,
  StateChange,
  State as StateContainer,
  SubscribeOptions,
  UnknownState,
  WritableState,
} from './state';
import { createState } from './state';

const STORE_SYMBOL = Symbol.for('@videojs/store');

export interface StoreOptions<Target, State> extends StoreCallbacks<Target, State> {}

export function createStore<Target = unknown>(): <State, Derived = EmptyObject>(
  slice: Slice<Target, State, Derived>,
  options?: StoreOptions<Target, State>
) => Store<Target, State & Readonly<Derived>> {
  return <State, Derived>(
    slice: Slice<Target, State, Derived>,
    options: StoreOptions<Target, State> = {}
  ): Store<Target, State & Readonly<Derived>> => {
    type StoreState = State & Readonly<Derived>;
    type TargetStore = Store<Target, StoreState>;

    // Closure state
    let target: Target | null = null;
    let destroyed = false;

    const setupAbort = new AbortController();
    const signals = new AbortControllerRegistry();

    // Reactive state - initialized after building slice state
    let state: WritableState<StoreState>;

    function validate() {
      if (destroyed) throwDestroyedError();
      if (!target) throwNoTargetError();
    }

    const initialSourceState = slice.state({
      target: () => {
        validate();
        return target!;
      },
      signals,
      get: () => state.current as Readonly<Record<string, unknown>>,
      set: (partial) => state.patch(partial as Partial<StoreState>),
    } satisfies StateContext<Target>);

    // Seed derived values before the getter loop below, so derived keys get
    // accessors like any other state. Each formula runs with every tier slot
    // still absent, which is how a library default gets stated once — in the
    // formula — rather than duplicated into `state()`.
    const derived = slice.derived as DerivedFormulas | undefined;
    const initialState = derived
      ? ({ ...initialSourceState, ...seedDerived(initialSourceState as object, derived) } as StoreState)
      : (initialSourceState as unknown as StoreState);

    state = createState(initialState, derived);

    const store = {
      [STORE_SYMBOL]: true,
      get $state() {
        return state;
      },
      get target() {
        return target;
      },
      get destroyed() {
        return destroyed;
      },
      get state() {
        return state.current;
      },
      attach,
      destroy,
      subscribe,
    } as unknown as TargetStore;

    // `Object.keys` skips symbols by design: tier slots are internal symbol-keyed
    // inputs and get no public getter. They are still enumerable via
    // `Reflect.ownKeys` on the snapshot — internal, not secret.
    for (const key of Object.keys(initialState as object)) {
      Object.defineProperty(store, key, {
        get: () => state.current[key as keyof StoreState],
        enumerable: true,
      });
    }

    try {
      options.onSetup?.({ store, signal: setupAbort.signal });
    } catch (error) {
      reportError(error);
    }

    return store;

    function attach(newTarget: Target): () => void {
      if (destroyed) throwDestroyedError();

      // Reset signals for new attachment (also cleans up previous if reattaching)
      signals.reset();
      target = newTarget;

      // Create attach context
      const attachContext: AttachContext<Target, State, Derived> = {
        target: newTarget,
        signal: signals.base,
        get: () => state.current as Readonly<State & Derived>,
        set: (partial) => state.patch(partial as Partial<StoreState>),
        reportError,
        store: {
          get state() {
            return state.current;
          },
          subscribe,
        },
      };

      try {
        slice.attach?.(attachContext);
      } catch (error) {
        reportError(error);
      }

      try {
        options.onAttach?.({
          store,
          target: newTarget,
          signal: signals.base,
        });
      } catch (error) {
        reportError(error);
      }

      return detach;
    }

    function detach(): void {
      if (isNull(target)) return;
      signals.reset();
      target = null;
      // Source keys only. `patch` would drop derived keys anyway, but passing
      // them would trip its dev warning on every ordinary detach.
      state.patch(initialSourceState as Partial<StoreState>);
    }

    function destroy(): void {
      if (destroyed) return;
      destroyed = true;
      detach();
      setupAbort.abort();
    }

    function subscribe(callback: StateChange, options?: SubscribeOptions): () => void {
      return state.subscribe(callback, options);
    }

    function reportError(error: unknown): void {
      if (options.onError) {
        options.onError({ store, error });
      } else {
        console.error('[vjs-store]', error);
      }
    }
  };
}

/** Runs every formula once against the source state, for the initial snapshot. */
function seedDerived(source: object, derived: DerivedFormulas): Record<PropertyKey, unknown> {
  const get = (key: PropertyKey) => (source as Record<PropertyKey, unknown>)[key];
  const seeded: Record<PropertyKey, unknown> = {};

  for (const key of Reflect.ownKeys(derived)) {
    seeded[key] = derived[key as string]!({ get });
  }

  return seeded;
}

export function isStore(value: unknown): value is AnyStore {
  return isObject(value) && STORE_SYMBOL in value;
}

// ----------------------------------------
// Types
// ----------------------------------------

export interface BaseStore<Target = unknown, State = UnknownState> {
  [key: string]: unknown;
  readonly $state: StateContainer<State>;
  readonly target: Target | null;
  readonly destroyed: boolean;
  readonly state: State;
  attach(target: Target): () => void;
  destroy(): void;
  subscribe(callback: StateChange, options?: SubscribeOptions): () => void;
}

export type Store<Target = unknown, State = UnknownState> = BaseStore<Target, State> & State;

export type AnyStore<Target = any> = BaseStore<Target, object>;

export type UnknownStore<Target = unknown> = Store<Target, UnknownState>;

export type InferStoreTarget<S extends AnyStore> = S extends Store<infer T, any> ? T : never;

export type InferStoreState<S extends AnyStore> = S extends Store<any, infer State> ? State : never;
