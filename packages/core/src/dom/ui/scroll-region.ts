import { observeElements } from '@videojs/utils/dom';

/**
 * Whether an element's content extends beyond its visible box on either axis.
 *
 * @param element - Element whose scroll and client dimensions are compared.
 */
export function hasScrollOverflow(element: HTMLElement): boolean {
  return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
}

/**
 * Observe whether an element's content extends beyond its visible box.
 *
 * The callback runs immediately with the current state, then only when that state changes after a resize or content
 * mutation.
 *
 * @param element - Element whose overflow state is observed.
 * @param onChange - Called with whether the element overflows on either axis.
 */
export function observeScrollOverflow(element: HTMLElement, onChange: (overflowing: boolean) => void): () => void {
  let overflowing: boolean | undefined;

  const sync = () => {
    const nextOverflowing = hasScrollOverflow(element);
    if (nextOverflowing === overflowing) return;

    overflowing = nextOverflowing;
    onChange(nextOverflowing);
  };

  const stopObserving = observeElements({
    root: element,
    getElements: () => [element, ...element.querySelectorAll('*')],
    mutations: { childList: true, characterData: true, subtree: true },
    onChange: sync,
  });

  sync();

  return stopObserving;
}
