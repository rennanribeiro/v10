import { isFunction } from '@videojs/utils/predicate';
import type { UnionToIntersection } from '@videojs/utils/types';

type AnyFunction = (...args: any[]) => any;

type MethodKeys<Api> = { [K in keyof Api]-?: NonNullable<Api[K]> extends AnyFunction ? K : never }[keyof Api];
type PropKeys<Api> = Exclude<keyof Api, MethodKeys<Api>>;

/** How one property of a capability behaves once a media implements it. */
export interface MediaCapabilityProp<Value> {
  /**
   * Value reported while no owner holds the property.
   *
   * This never means "unsupported" — that question is answered by whether the capability is composed at all.
   */
  readonly fallback: Value;
  /** The media reports this value but cannot be told to change it. */
  readonly readonly?: true;
  /**
   * Keep a written value so it survives a media that does not hold the property.
   *
   * For values a consumer supplies rather than the media detects, like a stream type the media cannot work out for
   * itself.
   */
  readonly remembered?: true;
  /**
   * Event to announce after a write that changes the value.
   *
   * For values no media element announces on its own. A write of the value already in effect stays quiet.
   */
  readonly changeEvent?: string;
}

/** How one method of a capability behaves once a media implements it. */
export interface MediaCapabilityMethod<Method extends AnyFunction> {
  /** Called when no owner implements the method, or when its result is nullish. */
  readonly fallback: Method;
}

/**
 * How a property is reflected as an external attribute.
 *
 * Attributes are a platform concern rather than a media one; HTML adapters turn these into content attributes on the
 * custom element wrapping the media.
 */
export interface MediaCapabilityAttribute {
  readonly type: typeof Boolean | typeof Number | typeof String;
  /** Attribute name, when it is not the lowercased property name. */
  readonly attribute?: string;
  /** Property value for a present-but-empty attribute. */
  readonly empty?: unknown;
}

/**
 * One media capability, described as data.
 *
 * A descriptor is the single place a capability declares its members, the events it emits, and the attributes it
 * reflects, so a host's surface, an element's attributes, and capability detection all read from the same source.
 * `props` and `methods` must cover the contract exactly, which is what keeps the description and the type from
 * drifting.
 *
 * Descriptors are inert: they name behavior without implementing it, so they know nothing about the hosts that compose
 * them and can be read by any adapter.
 */
export interface MediaCapabilityDescriptor<Api extends object = object> {
  readonly name: string;
  /** Events a media dispatches for this capability. */
  readonly events: readonly string[];
  readonly props: { readonly [K in PropKeys<Api>]-?: MediaCapabilityProp<Api[K]> };
  readonly methods?: { readonly [K in MethodKeys<Api>]-?: MediaCapabilityMethod<Extract<Api[K], AnyFunction>> };
  readonly attributes?: Readonly<Record<string, MediaCapabilityAttribute>>;
  /** Phantom marker carrying the capability's contract to whoever composes it. Never set at runtime. */
  readonly api?: Api;
}

/** Reads the phantom marker rather than the descriptor's members, which are mapped types and so not inferable. */
type ApiOf<Descriptor> = Descriptor extends { api?: infer Api } ? NonNullable<Api> : never;

/** The instance surface a list of capability descriptors composes to. */
export type ComposedMediaApi<Capabilities extends readonly MediaCapabilityDescriptor<any>[]> = UnionToIntersection<
  ApiOf<Capabilities[number]>
>;

/**
 * Describe a capability against the contract it implements.
 *
 * Curried so the contract is stated explicitly while the descriptor's own keys stay inferred.
 *
 * @example
 *   const volumeCapability = defineMediaCapability<MediaVolumeCapability>()({
 *     name: 'volume',
 *     events: ['volumechange'],
 *     props: { volume: { fallback: 1 }, muted: { fallback: false }, defaultMuted: { fallback: false } },
 *   });
 */
export function defineMediaCapability<Api extends object>() {
  return (descriptor: MediaCapabilityDescriptor<Api>): MediaCapabilityDescriptor<Api> => descriptor;
}

/** What a media composed from capabilities records about itself. */
export interface MediaCapabilityManifest {
  readonly capabilities: ReadonlyMap<string, MediaCapabilityDescriptor<any>>;
}

/** A media composed from capabilities, or one of its instances. */
export type MediaCapabilitySource = object | MediaCapabilityManifest | null | undefined;

/** The capabilities a media was composed from, empty for a media that declares none. */
export function getMediaCapabilities(source: MediaCapabilitySource): MediaCapabilityManifest['capabilities'] {
  const owner = isFunction(source) ? source : source?.constructor;
  const capabilities = (owner as Partial<MediaCapabilityManifest> | undefined)?.capabilities;

  return capabilities instanceof Map ? capabilities : EMPTY_CAPABILITIES;
}

/** Whether a media declares the named capability. Only meaningful for a media composed from capabilities. */
export function supportsMediaCapability(source: MediaCapabilitySource, name: string): boolean {
  return getMediaCapabilities(source).has(name);
}

/** Every event the composed capabilities of a media can emit. */
export function getMediaCapabilityEvents(source: MediaCapabilitySource): string[] {
  return [...getMediaCapabilities(source).values()].flatMap((capability) => [...capability.events]);
}

/** Every attribute the composed capabilities of a media reflect, keyed by the property each drives. */
export function getMediaCapabilityAttributes(source: MediaCapabilitySource): Record<string, MediaCapabilityAttribute> {
  return Object.assign({}, ...[...getMediaCapabilities(source).values()].map((capability) => capability.attributes));
}

const EMPTY_CAPABILITIES: MediaCapabilityManifest['capabilities'] = new Map();
