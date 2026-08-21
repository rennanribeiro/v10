import type { MediaEngineHost } from '@videojs/media';
import type { RefCallback } from 'react';
import { useCallback, useLayoutEffect, useRef } from 'react';

interface TargetAttachment<Target> {
  media: MediaEngineHost;
  target: Target;
}

export function useAttachTarget<Target>(media: MediaEngineHost | null): RefCallback<Target> {
  const targetRef = useRef<Target | null>(null);
  const attachmentRef = useRef<TargetAttachment<Target> | null>(null);

  const detach = useCallback(() => {
    attachmentRef.current?.media.detach?.();
    attachmentRef.current = null;
  }, []);

  useLayoutEffect(() => {
    const target = targetRef.current;
    const attachment = attachmentRef.current;

    if (attachment && (attachment.media !== media || attachment.target !== target)) detach();

    if (media && target && !attachmentRef.current) {
      media.attach?.(target);
      attachmentRef.current = { media, target };
    }
  });

  useLayoutEffect(() => detach, [detach]);

  return useCallback((target) => {
    targetRef.current = target;
  }, []);
}
