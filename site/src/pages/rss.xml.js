import { getCollection, getEntries } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '@/consts';
import { createFeedContentRenderer } from '@/utils/rss/feedContent';
import {
  buildChannelCustomData,
  buildCreatorCustomData,
  buildUpdatedCustomData,
  FEED_ITEM_LIMIT,
} from '@/utils/rss/feedMetadata';

const FEED_TITLE = `${SITE_TITLE} Blog`;

// TODO cache idk this can be static
export async function GET(context) {
  const site = new URL(context.site);
  const posts = (await getCollection('blog'))
    .filter((post) => !post.data.devOnly || import.meta.env.DEV)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .slice(0, FEED_ITEM_LIMIT);

  const renderFeedContent = await createFeedContentRenderer(site);
  const items = [];
  for (const post of posts) {
    const authors = await getEntries(post.data.authors);
    items.push({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}`,
      content: await renderFeedContent(post),
      customData: [
        buildCreatorCustomData(authors.map((author) => author.data.name)),
        post.data.updatedDate ? buildUpdatedCustomData(post.data.updatedDate) : '',
      ].join(''),
    });
  }

  return rss({
    title: FEED_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    trailingSlash: false,
    xmlns: { atom: 'http://www.w3.org/2005/Atom', dc: 'http://purl.org/dc/elements/1.1/' },
    customData: buildChannelCustomData({
      feedUrl: new URL('/rss.xml', site),
      pageUrl: new URL('/blog', site),
      title: FEED_TITLE,
      lastBuildDate: posts[0]?.data.pubDate,
      imageUrl: new URL('/apple-touch-icon.png', site),
      categories: ['Software', 'Video'],
    }),
    items,
  });
}
