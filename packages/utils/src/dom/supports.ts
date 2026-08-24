import { isFunction, isUndefined } from '../predicate';
export function supportsIdleCallback(): boolean {
  return isFunction(requestIdleCallback);
}

export function supportsAnimationFrame(): boolean {
  return isFunction(requestAnimationFrame);
}

export function supportsAnchorPositioning(): boolean {
  return !isUndefined(CSS) && CSS.supports('anchor-name: --a');
}

export function supportsPopoverAPI(): boolean {
  return !isUndefined(HTMLElement) && 'popover' in HTMLElement.prototype;
}
