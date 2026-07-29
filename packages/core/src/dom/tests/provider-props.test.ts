import type { EmptyObject } from '@videojs/utils/types';
import { describe, expect, it, vi } from 'vitest';
import { definePlayerFeature } from '../feature';
import type { AnyPlayerFeature } from '../player';
import {
  assertNoProviderPropCollisions,
  type CollectedProviderProp,
  collectProviderProps,
  writeProviderProps,
} from '../provider-props';

function featureDeclaring(props: Record<string, { attribute: string; action: string }>): AnyPlayerFeature {
  return definePlayerFeature<Record<string, unknown>, EmptyObject, Record<string, string | null | undefined>>({
    state: () => ({}),
    providerProps: Object.fromEntries(
      Object.entries(props).map(([name, { attribute, action }]) => [name, { type: String, attribute, action }])
    ) as never,
  });
}

describe('collectProviderProps', () => {
  it('returns an empty map when no feature declares anything', () => {
    const plain = definePlayerFeature({ state: () => ({ enabled: true }) });

    expect(collectProviderProps([plain]).size).toBe(0);
  });

  it('flattens declarations across features', () => {
    const a = featureDeclaring({ title: { attribute: 'title', action: 'setTitle' } });
    const b = featureDeclaring({ lockTo: { attribute: 'lock-to', action: 'setLockTo' } });

    const collected = collectProviderProps([a, b]);

    expect([...collected.keys()]).toEqual(['title', 'lockTo']);
    expect(collected.get('lockTo')).toMatchObject({ attribute: 'lock-to', action: 'setLockTo' });
  });

  it('errors in dev when two features declare the same prop name', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const a = featureDeclaring({ title: { attribute: 'title', action: 'setTitle' } });
    const b = featureDeclaring({ title: { attribute: 'title', action: 'setOtherTitle' } });

    collectProviderProps([a, b]);

    expect(error).toHaveBeenCalledWith(expect.stringContaining('two features declare the provider prop "title"'));
    error.mockRestore();
  });
});

describe('assertNoProviderPropCollisions', () => {
  function collect(...names: string[]): Map<string, CollectedProviderProp> {
    return new Map(names.map((name) => [name, { name, attribute: name, type: String, action: `set${name}` }]));
  }

  it('accepts names that collide with nothing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    assertNoProviderPropCollisions(collect('contentTitle', 'contentPoster'), HTMLElement.prototype);

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('catches an inherited DOM property that the own-property guard would miss', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    // `title` lives on `HTMLElement.prototype`, several links up from a provider
    // element's own prototype — which is exactly why `getOwnPropertyDescriptor`
    // cannot see it and `in` can.
    expect(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'title')).toBeDefined();

    class Provider extends HTMLElement {}
    expect(Object.getOwnPropertyDescriptor(Provider.prototype, 'title')).toBeUndefined();

    assertNoProviderPropCollisions(collect('title'), Provider.prototype);

    expect(error).toHaveBeenCalledWith(expect.stringContaining('already exists on the provider element'));
    error.mockRestore();
  });

  it('catches React reserved prop names', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    assertNoProviderPropCollisions(collect('children'));

    expect(error).toHaveBeenCalledWith(expect.stringContaining('reserved React prop name'));
    error.mockRestore();
  });
});

describe('writeProviderProps', () => {
  it('routes each prop to the action its feature named', () => {
    const setTitle = vi.fn();
    const setPoster = vi.fn();
    const props = collectProviderProps([
      featureDeclaring({
        contentTitle: { attribute: 'content-title', action: 'setContentTitle' },
        contentPoster: { attribute: 'content-poster', action: 'setContentPoster' },
      }),
    ]);

    writeProviderProps({ setContentTitle: setTitle, setContentPoster: setPoster }, props, (name) =>
      name === 'contentTitle' ? 'A title' : undefined
    );

    expect(setTitle).toHaveBeenCalledWith('A title');
    // An omitted prop and an explicit undefined mean the same thing: clear the
    // developer's value and let resolution fall through.
    expect(setPoster).toHaveBeenCalledWith(undefined);
  });

  it('errors in dev when a declaration names an action the store does not expose', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const props = collectProviderProps([featureDeclaring({ title: { attribute: 'title', action: 'setMissing' } })]);

    writeProviderProps({}, props, () => 'value');

    expect(error).toHaveBeenCalledWith(expect.stringContaining('which the store does not expose'));
    error.mockRestore();
  });
});
