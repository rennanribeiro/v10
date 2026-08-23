import { describe, expect, it } from 'vitest';
import {
  buildChannelCustomData,
  buildCreatorCustomData,
  buildUpdatedCustomData,
  escapeXml,
  releaseCategories,
  toRfc822,
} from '../feedMetadata';

describe('escapeXml', () => {
  it('escapes every character that would break out of a text node or attribute', () => {
    expect(escapeXml(`<a href="x?a=1&b=2">it's</a>`)).toBe(
      '&lt;a href=&quot;x?a=1&amp;b=2&quot;&gt;it&apos;s&lt;/a&gt;'
    );
  });
});

describe('toRfc822', () => {
  it('formats dates the way RSS expects', () => {
    expect(toRfc822(new Date('2026-08-21T00:00:00Z'))).toBe('Fri, 21 Aug 2026 00:00:00 GMT');
  });
});

describe('buildChannelCustomData', () => {
  const metadata = {
    feedUrl: new URL('https://videojs.org/changelog/rss.xml'),
    pageUrl: new URL('https://videojs.org/changelog'),
    title: 'Video.js Changelog',
    lastBuildDate: new Date('2026-08-21T00:00:00Z'),
    imageUrl: new URL('https://videojs.org/apple-touch-icon.png'),
    categories: ['Software'],
  };

  it('emits the channel elements @astrojs/rss has no option for', () => {
    const xml = buildChannelCustomData(metadata);

    expect(xml).toContain('<language>en-us</language>');
    expect(xml).toContain(
      '<atom:link href="https://videojs.org/changelog/rss.xml" rel="self" type="application/rss+xml"/>'
    );
    expect(xml).toContain('<lastBuildDate>Fri, 21 Aug 2026 00:00:00 GMT</lastBuildDate>');
    expect(xml).toContain('<category>Software</category>');
    expect(xml).toContain('<docs>https://www.rssboard.org/rss-specification</docs>');
    expect(xml).toContain(
      '<image><url>https://videojs.org/apple-touch-icon.png</url><title>Video.js Changelog</title><link>https://videojs.org/changelog</link></image>'
    );
  });

  it('ends the copyright range at the newest item, so rebuilds stay reproducible', () => {
    expect(buildChannelCustomData(metadata)).toContain('<copyright>© 2010–2026 Video.js contributors</copyright>');
  });

  it('omits lastBuildDate for an empty feed', () => {
    expect(buildChannelCustomData({ ...metadata, lastBuildDate: undefined })).not.toContain('<lastBuildDate>');
  });
});

describe('buildCreatorCustomData', () => {
  it('emits one dc:creator per author', () => {
    expect(buildCreatorCustomData(['Steve Heffernan', "Pat O'Neill"])).toBe(
      '<dc:creator>Steve Heffernan</dc:creator><dc:creator>Pat O&apos;Neill</dc:creator>'
    );
  });

  it('emits nothing when a post has no authors', () => {
    expect(buildCreatorCustomData([])).toBe('');
  });
});

describe('buildUpdatedCustomData', () => {
  it('emits an atom:updated timestamp', () => {
    expect(buildUpdatedCustomData(new Date('2026-08-21T12:30:00Z'))).toBe(
      '<atom:updated>2026-08-21T12:30:00.000Z</atom:updated>'
    );
  });
});

describe('releaseCategories', () => {
  it('tags stability', () => {
    expect(releaseCategories({ prerelease: true, breaking: false })).toEqual(['Release', 'Prerelease']);
    expect(releaseCategories({ prerelease: false, breaking: false })).toEqual(['Release', 'Stable']);
  });

  it('tags breaking releases', () => {
    expect(releaseCategories({ prerelease: false, breaking: true })).toEqual(['Release', 'Stable', 'Breaking changes']);
  });
});
