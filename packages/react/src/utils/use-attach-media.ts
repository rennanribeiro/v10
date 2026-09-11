import type { EngineAdapter } from '@videojs/media';
import type { RefCallback } from 'react';
import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Returns a callback ref that attaches an element to a playback adapter and detaches it when the element or the adapter
 * changes, when the element goes away, and on unmount.
 *
 * @param media - Playback adapter to attach and detach.
 */
export function useAttachMedia<T extends Element>(media: EngineAdapter): RefCallback<T> {
  // What the adapter is attached to, and the element React last handed the ref. React hands a callback ref `null` and
  // then the element again whenever the composed ref it belongs to changes identity (an inline `ref={(el) => ...}` from
  // a parent is a new function every render), so attaching only when the element or the adapter changed keeps that from
  // detaching the engine.
  const attached = useRef<{ media: EngineAdapter; element: T } | null>(null);
  const element = useRef<T | null>(null);

  const detach = useCallback(() => {
    const current = attached.current;

    attached.current = null;
    current?.media.detach?.();
  }, []);

  const attach = useCallback(
    (target: T) => {
      if (attached.current?.element === target && attached.current.media === media) return;

      detach();
      media.attach?.(target);
      attached.current = { media, element: target };
    },
    [media, detach]
  );

  const ref = useCallback<RefCallback<T>>(
    (target) => {
      element.current = target;

      if (target) attach(target);
    },
    [attach]
  );

  // Runs after the refs of every commit. An element removed while the component stays mounted hands the ref `null` with
  // nothing to follow, so the adapter is detached here; after a StrictMode simulated unmount, the element is attached
  // again.
  useLayoutEffect(() => {
    if (element.current) attach(element.current);
    else detach();
  });

  // Unmount hands the ref `null` as well, but no effect runs after it.
  useLayoutEffect(() => detach, [detach]);

  return ref;
}
