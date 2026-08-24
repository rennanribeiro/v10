interface MediaTrackOwner {
  readonly constructor: Function;
}

type PrivateMediaTrackValue =
  | MediaTrackOwner
  | WeakRef<MediaTrackOwner>
  | ReadonlySet<MediaTrackOwner>
  | AbortController
  | boolean
  | undefined;
type PrivateMediaTrackState = Record<string, PrivateMediaTrackValue>;

const privateProps = new WeakMap<object, PrivateMediaTrackState>();

export function getPrivate(instance: MediaTrackOwner) {
  return privateProps.get(instance) ?? setPrivate(instance, {});
}

export function setPrivate(instance: MediaTrackOwner, props: Partial<PrivateMediaTrackState>) {
  let saved = privateProps.get(instance);
  if (!saved) privateProps.set(instance, (saved = {}));

  return Object.assign(saved, props);
}
