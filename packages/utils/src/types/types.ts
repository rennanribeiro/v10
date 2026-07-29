export type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

/** Matches strings that include the literal substring `Needle` (for example a `{param}` token). */
export type Contains<Needle extends string> = `${string}${Needle}${string}`;

export type EnsureRecord<Keys extends PropertyKey, Value, Target extends Record<Keys, Value>> = Target;

export type Constructor<T, Arguments extends unknown[] = any[]> = new (...args: Arguments) => T;

export type AbstractConstructor<T, Arguments extends unknown[] = any[]> = abstract new (...args: Arguments) => T;

export type AnyConstructor<T, Arguments extends unknown[] = any[]> =
  | Constructor<T, Arguments>
  | AbstractConstructor<T, Arguments>;

export type Mixin<Base, Result> = <T extends Constructor<Base>>(Base: T) => T & Constructor<Result>;

export type MixinReturn<Base extends AnyConstructor<any>, Props> = Constructor<InstanceType<Base> & Props> &
  Omit<Base, 'prototype'>;

export type Falsy<T> = T | false | null | undefined;

export type EnsureFunction<T> = T extends (...args: any[]) => any ? T : never;

/**
 * An object type with no members.
 *
 * Exists so generic defaults can say "nothing here" once, in a named way, rather
 * than repeating a bare `{}` — which reads as "any non-nullish value" everywhere
 * else and is linted accordingly.
 */
// biome-ignore lint/complexity/noBannedTypes: naming `{}` once is the point of this alias
export type EmptyObject = {};

export type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};

export type NonNullableObject<T extends object> = {
  [P in keyof T]-?: Exclude<T[P], null | undefined>;
};
