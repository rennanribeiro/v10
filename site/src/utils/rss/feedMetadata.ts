/** Feeds carry the newest entries only; older items stay on the site. */
export const FEED_ITEM_LIMIT = 20;

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/**
 * `customData` is spliced into the feed as raw XML, so anything interpolated
 * into it has to be escaped by hand.
 */
export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => XML_ESCAPES[character] as string);
}

/** RSS dates are RFC 822, which `toUTCString()` already produces. */
export function toRfc822(date: Date): string {
  return date.toUTCString();
}

interface ChannelMetadata {
  /** Absolute URL of the feed itself, for `<atom:link rel="self">`. */
  feedUrl: URL;
  /** Absolute URL of the page the feed covers. */
  pageUrl: URL;
  /** Feed title, reused by `<image>`. */
  title: string;
  /** Newest item date. Preferred over "now" so rebuilds stay reproducible. */
  lastBuildDate?: Date;
  /** Absolute URL of the channel image. */
  imageUrl: URL;
  /** Channel-level categories. */
  categories?: string[];
}

/**
 * Channel-level elements `@astrojs/rss` has no option for. Requires the `atom`
 * namespace to be declared on the feed via its `xmlns` option.
 */
export function buildChannelCustomData({
  feedUrl,
  pageUrl,
  title,
  lastBuildDate,
  imageUrl,
  categories = [],
}: ChannelMetadata): string {
  const year = (lastBuildDate ?? new Date()).getUTCFullYear();

  return [
    '<language>en-us</language>',
    `<atom:link href="${escapeXml(feedUrl.href)}" rel="self" type="application/rss+xml"/>`,
    lastBuildDate ? `<lastBuildDate>${toRfc822(lastBuildDate)}</lastBuildDate>` : '',
    ...categories.map((category) => `<category>${escapeXml(category)}</category>`),
    `<copyright>© 2010–${year} Video.js contributors</copyright>`,
    '<docs>https://www.rssboard.org/rss-specification</docs>',
    '<image>',
    `<url>${escapeXml(imageUrl.href)}</url>`,
    `<title>${escapeXml(title)}</title>`,
    `<link>${escapeXml(pageUrl.href)}</link>`,
    '</image>',
  ]
    .filter(Boolean)
    .join('');
}

/**
 * Author names as Dublin Core creators. RSS's own `<author>` element is defined
 * as an email address, which the site does not publish.
 */
export function buildCreatorCustomData(names: string[]): string {
  return names.map((name) => `<dc:creator>${escapeXml(name)}</dc:creator>`).join('');
}

/** Last-modified date as `<atom:updated>`, which RSS itself has no field for. */
export function buildUpdatedCustomData(updatedDate: Date): string {
  return `<atom:updated>${updatedDate.toISOString()}</atom:updated>`;
}

/**
 * Tags a reader can filter releases by: stability first, then whether the
 * release carries breaking changes.
 */
export function releaseCategories({ prerelease, breaking }: { prerelease: boolean; breaking: boolean }): string[] {
  return ['Release', prerelease ? 'Prerelease' : 'Stable', ...(breaking ? ['Breaking changes'] : [])];
}
