import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_TITLE } from '@/consts';
import { createFeedContentRenderer } from '@/utils/rss/feedContent';
import { buildChannelCustomData, escapeXml, FEED_ITEM_LIMIT, releaseCategories } from '@/utils/rss/feedMetadata';

const FEED_TITLE = `${SITE_TITLE} Changelog`;
const FEED_DESCRIPTION = 'New features, fixes, and improvements in every Video.js release';

export async function GET(context) {
  const site = new URL(context.site);
  const entries = (await getCollection('changelog'))
    .sort(
      (a, b) =>
        b.data.date.valueOf() - a.data.date.valueOf() ||
        b.data.version.localeCompare(a.data.version, undefined, { numeric: true })
    )
    .slice(0, FEED_ITEM_LIMIT);

  const renderFeedContent = await createFeedContentRenderer(site);
  const items = [];
  for (const entry of entries) {
    const content = await renderFeedContent(entry);
    items.push({
      title: `v${entry.data.version}`,
      pubDate: entry.data.date,
      description: entry.data.description || undefined,
      link: `/changelog/${entry.id}`,
      categories: releaseCategories(entry.data),
      // The compare link is part of the release page's header rather than its
      // body, so append it to the feed item instead of losing it.
      content: `${content}<p><a href="${escapeXml(entry.data.compareUrl)}">Compare changes on GitHub</a></p>`,
    });
  }

  return rss({
    title: FEED_TITLE,
    description: FEED_DESCRIPTION,
    site: context.site,
    trailingSlash: false,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: buildChannelCustomData({
      feedUrl: new URL('/changelog/rss.xml', site),
      pageUrl: new URL('/changelog', site),
      title: FEED_TITLE,
      lastBuildDate: entries[0]?.data.date,
      imageUrl: new URL('/apple-touch-icon.png', site),
      categories: ['Software', 'Video'],
    }),
    items,
  });
}
