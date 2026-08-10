import { PosterPlaceholderElement } from '../../ui/poster-placeholder/poster-placeholder-element';
import { safeDefine } from '../safe-define';

safeDefine(PosterPlaceholderElement);

declare global {
  interface HTMLElementTagNameMap {
    [PosterPlaceholderElement.tagName]: PosterPlaceholderElement;
  }
}
