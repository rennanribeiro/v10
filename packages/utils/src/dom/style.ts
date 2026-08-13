import { kebabCase } from '../string/casing';

export function getAnchorNames(element: HTMLElement): string[] {
  const value = element.style.getPropertyValue('anchor-name').trim();

  if (!value || value === 'none') return [];

  return value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

export function addAnchorName(element: HTMLElement, name: string): () => void {
  const anchor = `--${name}`;
  const anchors = getAnchorNames(element);
  const added = !anchors.includes(anchor);

  if (added) {
    element.style.setProperty('anchor-name', [...anchors, anchor].join(', '));
  }

  return () => {
    if (!added) return;

    const next = getAnchorNames(element).filter((name) => name !== anchor);

    if (next.length) {
      element.style.setProperty('anchor-name', next.join(', '));
    } else {
      element.style.removeProperty('anchor-name');
    }
  };
}

export function applyStyles(element: HTMLElement, styles: Record<string, string | undefined>): void {
  for (const [prop, value] of Object.entries(styles)) {
    if (typeof value === 'string') {
      // CSS custom properties (--*) are already in the correct format.
      const key = prop.startsWith('--') ? prop : kebabCase(prop);
      element.style.setProperty(key, value);
    }
  }
}

export function resolveCSSLength(el: Element, value: string): number {
  const length = value.trim();

  if (!length) return 0;

  if (/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px)?$/.test(length)) return Number.parseFloat(length);

  const doc = el.ownerDocument;
  const probe = doc.createElement('div');

  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  probe.style.inlineSize = length;

  if (!probe.style.inlineSize) return 0;

  const computed = getComputedStyle(el);
  probe.style.fontSize = computed.fontSize;

  for (const match of length.matchAll(/var\(\s*(--[\w-]+)/g)) {
    const name = match[1];
    if (name) probe.style.setProperty(name, computed.getPropertyValue(name));
  }

  (doc.body ?? doc.documentElement).append(probe);

  try {
    const pixels = Number.parseFloat(getComputedStyle(probe).inlineSize);
    return Number.isFinite(pixels) ? pixels : 0;
  } finally {
    probe.remove();
  }
}
