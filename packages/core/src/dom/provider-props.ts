import type { EmptyObject, Simplify, UnionToIntersection } from '@videojs/utils/types';
import type { AnyPlayerFeature, PlayerFeature } from './player';

// ----------------------------------------
// Declaration
// ----------------------------------------

/** Constructors a provider prop may declare. Mirrors `PropertyDeclaration`'s `type`. */
export type ProviderPropConstructor = typeof String | typeof Number | typeof Boolean;

/** The constructor a given prop value type must declare. */
export type ProviderPropConstructorFor<Value> = [Value] extends [string]
  ? typeof String
  : [Value] extends [number]
    ? typeof Number
    : [Value] extends [boolean]
      ? typeof Boolean
      : never;

/** The names of a feature's own single-argument actions — the only valid write targets. */
export type ProviderPropAction<State> = {
  [K in keyof State]: State[K] extends (value: any) => any ? K : never;
}[keyof State] &
  string;

/**
 * How a feature exposes one user-settable field on the player provider.
 *
 * A feature that declares nothing contributes no props, which is every feature
 * shipping today. Opting in is deliberate.
 */
export interface ProviderPropDeclaration<State, Value> {
  /**
   * Used for HTML attribute coercion and to check the declared prop type.
   * Passed through to the element's `static properties` unchanged.
   */
  type: ProviderPropConstructorFor<Value>;
  /**
   * HTML attribute name. **Mandatory, not stylistic.** `ReactiveElement`
   * registers the property name verbatim, and both the HTML parser and
   * `setAttribute` lowercase attribute names — so a camelCase property without
   * an explicit attribute would observe a name HTML can never produce, leaving
   * the attribute silently dead.
   */
  attribute: string;
  /**
   * Name of the feature's own action that writes this field.
   *
   * Explicit rather than inferred from the property name. The tier slots behind
   * a field are symbol keys private to the feature, and the provider is generic
   * — built once for any feature set — so it has no way to reach them. Naming an
   * action is how a generic provider hands a value to a feature that knows what
   * to do with it, and it means the attribute path and the imperative path
   * (`store.setContentTitle(...)`) run through one function and cannot drift.
   */
  action: ProviderPropAction<State>;
}

/** Every provider prop a feature declares, keyed by prop name. */
export type ProviderPropDeclarations<State, Props> = {
  [K in keyof Props]-?: ProviderPropDeclaration<State, NonNullable<Props[K]>>;
};

// ----------------------------------------
// Inference
// ----------------------------------------

export type InferProviderProps<F> = F extends PlayerFeature<any, any, infer Props> ? Props : EmptyObject;

/**
 * Flattens the provider props of a feature list into one object type.
 *
 * This is what makes a prop exist only when its feature is composed — the same
 * mechanism `UnionSliceState` already uses for state.
 */
export type UnionProviderProps<Features extends readonly AnyPlayerFeature[]> = Simplify<
  UnionToIntersection<InferProviderProps<Features[number]>>
>;

// ----------------------------------------
// Collection
// ----------------------------------------

export interface CollectedProviderProp {
  name: string;
  attribute: string;
  type: ProviderPropConstructor;
  action: string;
}

/** Prop names React reserves, which a feature must not shadow. */
const RESERVED_PROP_NAMES = new Set(['children', 'key', 'ref']);

/**
 * Walks a feature list once and flattens every declaration into a single map.
 *
 * Called at `createPlayer` time, outside the component and outside the mixin,
 * because the feature list is fixed by then.
 */
export function collectProviderProps(features: readonly AnyPlayerFeature[]): Map<string, CollectedProviderProp> {
  const collected = new Map<string, CollectedProviderProp>();

  for (const feature of features) {
    const declarations = feature.providerProps;
    if (!declarations) continue;

    for (const [name, declaration] of Object.entries(declarations) as [
      string,
      ProviderPropDeclaration<unknown, unknown>,
    ][]) {
      if (__DEV__ && collected.has(name)) {
        console.error(
          `[vjs-player] createPlayer(): two features declare the provider prop "${name}" — the later one wins`
        );
      }

      collected.set(name, {
        name,
        attribute: declaration.attribute,
        type: declaration.type as ProviderPropConstructor,
        action: declaration.action as string,
      });
    }
  }

  return collected;
}

/**
 * Dev-only check that no declared prop name shadows something already on the
 * provider.
 *
 * The trap this catches is not obvious. Declared props become entries in
 * `static properties`, which `ReactiveElement` turns into real accessors with
 * `Object.defineProperty(ctor.prototype, name, ...)`. Its own guard tests
 * `Object.getOwnPropertyDescriptor`, which inspects *only* own properties — so a
 * standard DOM property like `title`, living several links up the prototype
 * chain, is invisible to it. The accessor gets installed anyway, shadowing the
 * browser's property: setting `title` stops producing a native tooltip and
 * starts feeding the store instead. `in` walks the prototype chain, which is
 * exactly what that guard cannot do.
 *
 * Deliberately proportional. State keys and action names carry their own
 * unchecked collision surface, so this is not a new rigor bar — just a cheap
 * check at the one point where every declaration is visible together.
 */
export function assertNoProviderPropCollisions(
  props: Map<string, CollectedProviderProp>,
  prototype?: object | undefined
): void {
  if (!__DEV__) return;

  for (const name of props.keys()) {
    if (RESERVED_PROP_NAMES.has(name)) {
      console.error(`[vjs-player] createPlayer(): provider prop "${name}" is a reserved React prop name`);
    }

    if (prototype && name in prototype) {
      console.error(
        `[vjs-player] createPlayer(): provider prop "${name}" already exists on the provider element's prototype chain — ` +
          `declaring it would shadow that property`
      );
    }
  }
}

// ----------------------------------------
// Writing
// ----------------------------------------

/** A store exposing feature actions as callable members. */
type ActionStore = Record<string, unknown>;

/**
 * Pushes every declared prop into the store through its feature's action.
 *
 * Writes unconditionally, with no diffing and no record of what was written
 * last. `patch` already drops writes that change nothing, and an omitted prop
 * and an explicit `undefined` deliberately mean the same thing — both clear the
 * user's value and let resolution fall through, which is what removing an HTML
 * attribute does too. Keeping a second copy of the truth in a ref could drift
 * from the store across a remount or a store swap.
 */
export function writeProviderProps(
  store: ActionStore,
  props: Map<string, CollectedProviderProp>,
  read: (name: string) => unknown
): void {
  for (const [name, declaration] of props) {
    const action = store[declaration.action];

    if (typeof action !== 'function') {
      if (__DEV__) {
        console.error(
          `[vjs-player] provider prop "${name}" names the action "${declaration.action}", which the store does not expose`
        );
      }
      continue;
    }

    (action as (value: unknown) => void)(read(name));
  }
}
