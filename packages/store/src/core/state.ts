import { noop } from '@videojs/utils/function';

export type StateChange = () => void;

export type UnknownState = Record<string, unknown>;

export interface SubscribeOptions {
  signal?: AbortSignal;
}

export interface State<T> {
  readonly current: Readonly<T>;
  subscribe(callback: StateChange, options?: SubscribeOptions): () => void;
}

export interface WritableState<T> extends State<T> {
  patch: (partial: Partial<T>) => void;
}

/**
 * Runtime shape of a slice's `derived` map, erased of its key/value types.
 *
 * Each formula receives a `get` bound to the snapshot being built and returns
 * that key's value. See `DerivedMap` in `slice.ts` for the typed authoring shape.
 */
export type DerivedFormulas = Record<PropertyKey, (ctx: { get: (key: PropertyKey) => any }) => unknown>;

let isFlushScheduled = false;
function scheduleFlush(): void {
  if (isFlushScheduled) return;
  isFlushScheduled = true;
  queueMicrotask(flush);
}

const pendingContainers = new Set<StateContainer<any>>();

export function flush(): void {
  isFlushScheduled = false;
  for (const container of pendingContainers) container.flush();
  pendingContainers.clear();
}

class StateContainer<T> implements WritableState<T> {
  #current: T;
  #listeners = new Set<StateChange>();
  #pending = false;
  #derived: [PropertyKey, DerivedFormulas[PropertyKey]][];
  #derivedKeys: Set<PropertyKey>;

  constructor(initial: T, derived?: DerivedFormulas) {
    this.#current = Object.freeze({ ...initial });
    this.#derived = derived ? Reflect.ownKeys(derived).map((key) => [key, derived[key as string]!]) : [];
    this.#derivedKeys = new Set(this.#derived.map(([key]) => key));
  }

  get current(): Readonly<T> {
    return this.#current;
  }

  patch(partial: Partial<T>): void {
    // Copy lazily. Provider config writes every declared field on every update,
    // so no-op patches arrive in bulk and a copy per patch would be wasted work.
    // `next` doubling as the changed flag is why there isn't a separate one.
    let next: T | undefined;

    // `Reflect.ownKeys` rather than `for...in`: tier slots are symbol-keyed and
    // `for...in` skips symbols entirely, which made a symbol patch a silent no-op.
    // It also returns own keys only, so the old `hasOwnProperty` guard is redundant.
    for (const key of Reflect.ownKeys(partial) as (keyof T)[]) {
      // A derived key's formula is its only writer. Anything else — the reset in
      // `detach`, plain-JavaScript callers the compiler can't reach — is dropped
      // so the ordering of writes inside this method never becomes load-bearing.
      if (this.#derivedKeys.has(key)) {
        if (__DEV__) {
          console.warn(
            `[vjs-store] patch(): ignoring write to derived key "${String(key)}" — its formula is the only writer`
          );
        }
        continue;
      }

      const value = partial[key];

      if (!Object.is(this.#current[key], value)) {
        next ??= { ...this.#current };
        next[key] = value!;
      }
    }

    // Nothing changed means no formula input changed, so derived values can't
    // have changed either — the whole pass is skipped.
    if (!next) return;

    this.#recompute(next);

    this.#current = Object.freeze(next);
    this.#markPending();
  }

  /**
   * Runs every formula against the candidate snapshot and folds the answers in,
   * before the snapshot is frozen. There is no dependency tracking: formulas are
   * cheap and few, and re-running all of them costs about what deciding which to
   * re-run would. See `internal/decisions/store/derived-state.md`.
   */
  #recompute(next: T): void {
    if (!this.#derived.length) return;

    const get = (key: PropertyKey) => next[key as keyof T];

    for (const [key, formula] of this.#derived) {
      const value = formula({ get }) as T[keyof T];
      if (!Object.is(next[key as keyof T], value)) {
        next[key as keyof T] = value;
      }
    }
  }

  subscribe(callback: StateChange, options?: SubscribeOptions): () => void {
    const signal = options?.signal;
    if (signal?.aborted) return noop;

    this.#listeners.add(callback);

    if (!signal) {
      return () => this.#listeners.delete(callback);
    }

    const onAbort = () => this.#listeners.delete(callback);
    signal.addEventListener('abort', onAbort, { once: true });

    return () => {
      signal.removeEventListener('abort', onAbort);
      this.#listeners.delete(callback);
    };
  }

  flush(): void {
    if (!this.#pending) return;
    this.#pending = false;
    for (const fn of this.#listeners) fn();
  }

  #markPending(): void {
    this.#pending = true;
    pendingContainers.add(this);
    scheduleFlush();
  }
}

export function createState<T>(initial: T, derived?: DerivedFormulas): WritableState<T> {
  return new StateContainer(initial, derived);
}

export function isState(value: unknown): value is State<object> {
  return value instanceof StateContainer;
}
