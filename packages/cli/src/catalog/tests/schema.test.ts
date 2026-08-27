import { describe, expect, it } from 'vite-plus/test';

import { parseCatalog } from '../schema.js';

describe('parseCatalog', () => {
  it('validates and resolves source references', () => {
    const catalog = parseCatalog({
      version: 1,
      sources: { source: 'export {}' },
      items: [
        {
          kind: 'component',
          name: 'button',
          title: 'Button',
          description: 'A button.',
          framework: 'react',
          style: 'css',
          context: 'default-video',
          entry: 'button.tsx',
          stylesheet: 'button.tsx',
          files: [{ path: 'button.tsx', sources: ['source'] }],
          dependencies: [],
          devDependencies: [],
        },
      ],
    });

    expect(catalog.items[0]?.name).toBe('button');
  });

  it('rejects missing source content', () => {
    expect(() =>
      parseCatalog({
        version: 1,
        sources: {},
        items: [
          {
            kind: 'skin',
            name: 'video',
            title: 'Video',
            description: 'Video skin.',
            framework: 'html',
            style: 'css',
            context: 'default-video',
            entry: 'video.html',
            stylesheet: 'video.html',
            setup: 'video.html',
            contentMarker: '<!-- Add your media element here. -->',
            posterMarker: '<!-- Replace the fallback image below to customize the poster. -->',
            files: [{ path: 'video.html', sources: ['missing'] }],
            dependencies: [],
            devDependencies: [],
          },
        ],
      })
    ).toThrow('file 0 is invalid');
  });

  it('rejects unsafe and case-conflicting output paths', () => {
    const item = {
      kind: 'component',
      name: 'button',
      title: 'Button',
      description: 'A button.',
      framework: 'react',
      style: 'css',
      context: 'default-video',
      entry: '../button.tsx',
      stylesheet: '../button.tsx',
      files: [{ path: '../button.tsx', sources: ['source'] }],
      dependencies: [],
      devDependencies: [],
    };

    expect(() => parseCatalog({ version: 1, sources: { source: 'export {}' }, items: [item] })).toThrow(
      'Catalog item 0 is invalid'
    );

    expect(() =>
      parseCatalog({
        version: 1,
        sources: { source: 'export {}' },
        items: [
          {
            ...item,
            entry: 'Button.tsx',
            stylesheet: 'Button.tsx',
            files: [
              { path: 'Button.tsx', sources: ['source'] },
              { path: 'button.tsx', sources: ['source'] },
            ],
          },
        ],
      })
    ).toThrow('conflicting file paths');
  });
});
