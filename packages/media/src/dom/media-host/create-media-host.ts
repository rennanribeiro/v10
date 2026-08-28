import { isFunction } from '@videojs/utils/predicate';
import type { Constructor } from '@videojs/utils/types';

import {
  type ComposedMediaApi,
  getMediaCapabilities,
  type MediaCapabilityDescriptor,
  type MediaCapabilityManifest,
  type MediaCapabilityMethod,
  type MediaCapabilityProp,
} from '../../core/capability';
import { getMediaOwner, getMediaProp, setMediaProp } from '../utils';
import { MediaHostBase } from './base';

type AnyFunction = (...args: any[]) => any;

/** Any forwarded member, once the capability's contract has been erased. */
type Forwarded = Record<string, unknown>;

export interface MediaHostConstructor<Api> extends Constructor<MediaHostBase & Api>, MediaCapabilityManifest {}

/**
 * Build a media host that exposes exactly the given capabilities.
 *
 * Members are defined on the returned class's own fresh prototype, so nothing shared is mutated and a host simply has
 * no member for a capability it did not compose. Pass a base host to layer capabilities onto an existing one; its
 * capabilities carry over, so `instanceof` and detection keep working down the chain.
 *
 * @example
 *   class GifMediaHost extends createMediaHost([playbackCapability, sourceCapability]) {} // no volume
 */
export function createMediaHost<
  const Capabilities extends readonly MediaCapabilityDescriptor<any>[],
  Base extends Constructor<MediaHostBase> = typeof MediaHostBase,
>(
  capabilities: Capabilities,
  BaseClass?: Base
): MediaHostConstructor<InstanceType<Base> & ComposedMediaApi<Capabilities>> {
  const BaseHost = (BaseClass ?? MediaHostBase) as Constructor<MediaHostBase>;

  class ComposedMediaHost extends BaseHost {
    static readonly capabilities: MediaCapabilityManifest['capabilities'] = new Map([
      ...getMediaCapabilities(BaseClass),
      ...capabilities.map((capability) => [capability.name, capability] as const),
    ]);
  }

  for (const capability of capabilities) {
    for (const [name, prop] of Object.entries(capability.props)) {
      defineProp(ComposedMediaHost.prototype, name, prop);
    }

    for (const [name, method] of Object.entries(capability.methods ?? {})) {
      defineMethod(ComposedMediaHost.prototype, name, method);
    }
  }

  return ComposedMediaHost as unknown as MediaHostConstructor<InstanceType<Base> & ComposedMediaApi<Capabilities>>;
}

function defineProp(prototype: object, name: string, prop: MediaCapabilityProp<unknown>): void {
  const remembered = prop.remembered ? new WeakMap<MediaHostBase, unknown>() : null;

  function read(this: MediaHostBase) {
    return getMediaProp<Forwarded>(this, name) ?? remembered?.get(this) ?? prop.fallback;
  }

  const descriptor: PropertyDescriptor = { configurable: true, get: read };

  if (!prop.readonly) {
    descriptor.set = function (this: MediaHostBase, value: unknown) {
      if (prop.changeEvent && read.call(this) === value) return;

      remembered?.set(this, value);
      setMediaProp<Forwarded>(this, name, value);

      if (prop.changeEvent) this.dispatchEvent(new Event(prop.changeEvent));
    };
  }

  Object.defineProperty(prototype, name, descriptor);
}

function defineMethod(prototype: object, name: string, method: MediaCapabilityMethod<AnyFunction>): void {
  Object.defineProperty(prototype, name, {
    configurable: true,
    writable: true,
    value(this: MediaHostBase, ...args: unknown[]) {
      const owner = getMediaOwner<Forwarded>(this, name);
      const implementation = owner?.[name];
      const result = isFunction(implementation) ? implementation.apply(owner, args) : undefined;

      // A nullish result means the owner could not answer, so the capability's
      // own answer stands in — that is how `play()` rejects with no media.
      return result ?? method.fallback.apply(this, args);
    },
  });
}
