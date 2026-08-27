import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import type { ResolvedCatalogItem } from '../../catalog/index.js';
import { applyChangeSet } from '../change-set.js';
import { planEject } from '../plan.js';
import { detectProject } from '../project.js';

const item: ResolvedCatalogItem = {
  kind: 'skin',
  name: 'video',
  title: 'Video Skin',
  description: 'Default video skin.',
  framework: 'react',
  style: 'css',
  context: 'default-video',
  entry: 'skins/default-video/skin.tsx',
  stylesheet: 'styles/video.css',
  files: [
    {
      path: 'skins/default-video/skin.tsx',
      content: 'export function DefaultVideoSkin() { return null; }\n',
    },
    { path: 'styles/video.css', content: '.media-skin {}\n' },
  ],
  dependencies: ['@videojs/react', 'react'],
  devDependencies: [],
};

describe('planEject', () => {
  it('applies source and application edits atomically and is idempotent', async () => {
    const cwd = await fixture();
    const application = join(cwd, 'src/player.tsx');
    const source =
      "import { VideoPlayer, VideoSkin as Skin } from '@videojs/react/video';\n" +
      "import '@videojs/react/video/skin.css';\n" +
      'export const player = <Skin><VideoPlayer /></Skin>;\n';

    await writeFile(application, source);

    const options = {
      project: await detectProject(cwd),
      item,
      path: 'src/videojs',
      overwrite: false,
    } as const;
    const plan = await planEject(options);

    expect(plan.alreadyEjected).toBe(false);
    expect(plan.changeSet.files.map(({ relativePath, status }) => [relativePath, status])).toEqual([
      ['src/videojs/skins/default-video/skin.tsx', 'create'],
      ['src/videojs/styles/video.css', 'create'],
      ['package.json', 'update'],
      ['src/player.tsx', 'update'],
    ]);

    await applyChangeSet(plan.changeSet);

    const transformed = await readFile(application, 'utf8');

    expect(transformed).toContain('import { VideoPlayer } from "@videojs/react/video";');
    expect(transformed).toContain('import { DefaultVideoSkin as Skin } from "./videojs/skins/default-video/skin";');
    expect(transformed).not.toContain('skin.css');

    const replay = await planEject({ ...options, project: await detectProject(cwd) });

    expect(replay.alreadyEjected).toBe(true);
    expect(replay.changeSet.files).toEqual([]);
  });

  it('refuses ambiguous source without writing generated files', async () => {
    const cwd = await fixture();

    await writeFile(join(cwd, 'src/player.tsx'), "import * as VideoPreset from '@videojs/react/video';\n");

    await expect(
      planEject({
        project: await detectProject(cwd),
        item,
        path: 'src/videojs',
        overwrite: false,
      })
    ).rejects.toThrow('namespace import');
    await expect(access(join(cwd, 'src/videojs'))).rejects.toThrow();
  });

  it('refuses a partial local migration with a packaged stylesheet', async () => {
    const cwd = await fixture();

    await writeFile(
      join(cwd, 'src/player.tsx'),
      "import { DefaultVideoSkin } from './videojs/skins/default-video/skin';\n" +
        "import '@videojs/react/video/skin.css';\n"
    );

    await expect(
      planEject({
        project: await detectProject(cwd),
        item,
        path: 'src/videojs',
        overwrite: false,
      })
    ).rejects.toThrow('local source and packaged skin resources both exist');
  });
});

async function fixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'videojs-cli-eject-'));

  await writeFile(
    join(cwd, 'package.json'),
    `${JSON.stringify({ name: 'fixture', private: true, dependencies: { '@videojs/react': 'latest' } }, null, 2)}\n`
  );
  await mkdir(join(cwd, 'src'));

  return cwd;
}
