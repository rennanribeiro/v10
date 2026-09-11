import type { EngineAdapter } from '@videojs/media';
import type { RefCallback } from 'react';

import { useAttachMedia } from './use-attach-media';

export function useAttachIframe<T extends HTMLIFrameElement>(media: EngineAdapter): RefCallback<T> {
  return useAttachMedia<T>(media);
}
