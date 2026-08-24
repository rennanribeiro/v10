import { isUndefined } from '@videojs/utils/predicate';
import { useRef } from 'react';

function hasKey<Owner extends object>(owner: Owner, key: PropertyKey): key is keyof Owner {
  return key in owner;
}

export function useSyncProps<Props extends object, Rest extends object>(
  target: Props,
  props: Partial<Props> & Rest,
  defaults: Props
): Omit<Rest, keyof Props> {
  const rest = /* SAFETY: Properties outside the media contract are copied into this object below. */ {} as Omit<
    Rest,
    keyof Props
  >;
  const synced = new Set<keyof Props & string>();
  const prevSyncedRef = useRef<Set<keyof Props & string> | null>(null);

  const sync = <Key extends keyof Props>(key: Key, value: Props[Key]) => {
    if (target[key] !== value) target[key] = value;
  };

  // Reset props the consumer stopped passing (or passed as `undefined`) back to
  // their defaults before applying the current ones, so a reset can never wipe a
  // value another prop derives in the same render (e.g. `source` deriving `src`).
  // Mirrors react-dom removing absent attributes.
  for (const key of prevSyncedRef.current ?? []) {
    if (isUndefined(props[key])) sync(key, defaults[key]);
  }

  for (const key in props) {
    if (hasKey(defaults, key)) {
      if (isUndefined(props[key])) continue;
      synced.add(key);
      sync(key, props[key]);
    } else {
      Object.assign(rest, { [key]: props[key] });
    }
  }

  prevSyncedRef.current = synced;

  return rest;
}
