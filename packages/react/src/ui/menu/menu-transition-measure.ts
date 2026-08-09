import { getMenuTransitionSize, type MenuTransitionApi } from '@videojs/core/dom';
import { type RefObject, useCallback, useEffect, useLayoutEffect } from 'react';

/** Keeps the transition container sized to one live panel. */
export function useMenuTransitionMeasure(
  controller: MenuTransitionApi,
  panelRef: RefObject<HTMLElement | null>,
  active: boolean
): void {
  const measure = useCallback(() => {
    const panel = panelRef.current;
    if (panel) controller.setSize(getMenuTransitionSize(panel));
  }, [controller, panelRef]);

  useLayoutEffect(() => {
    if (active) measure();
  }, [active, measure]);

  useEffect(() => {
    if (!active) return;
    measure();
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [active, measure]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!active || !panel || typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [active, measure, panelRef]);
}
