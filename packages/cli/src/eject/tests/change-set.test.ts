import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import type { ResolvedCatalogItem } from '../../catalog/index.js';
import { applyChangeSet, planAdd } from '../change-set.js';
import { detectProject } from '../project.js';

const item: ResolvedCatalogItem = {
  kind: 'component',
  name: 'play-button',
  title: 'Play Button',
  description: 'A play button.',
  framework: 'react',
  style: 'css',
  context: 'default-video',
  entry: 'components/play-button.tsx',
  stylesheet: 'components/play-button.tsx',
  files: [{ path: 'components/play-button.tsx', content: 'export function PlayButton() {}\n' }],
  dependencies: ['@videojs/react', 'react'],
  devDependencies: [],
};

describe('planAdd', () => {
  it('plans and applies source plus package dependencies', async () => {
    const cwd = await fixture();
    const project = await detectProject(cwd);
    const changeSet = await planAdd({ project, item, path: 'src/videojs', overwrite: false });

    expect(changeSet.files.map(({ relativePath, status }) => [relativePath, status])).toEqual([
      ['src/videojs/components/play-button.tsx', 'create'],
      ['package.json', 'update'],
    ]);

    await applyChangeSet(changeSet);
    expect(await readFile(join(cwd, 'src/videojs/components/play-button.tsx'), 'utf8')).toContain('PlayButton');
    expect(JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'))).toMatchObject({
      dependencies: { '@videojs/react': `^${__CLI_VERSION__}`, react: '^19.0.0' },
    });
  });

  it('requires explicit overwrite for differing files', async () => {
    const cwd = await fixture();
    const target = join(cwd, 'src/videojs/components/play-button.tsx');

    await mkdir(join(cwd, 'src/videojs/components'), { recursive: true });
    await writeFile(target, 'local changes\n');

    const changeSet = await planAdd({ project: await detectProject(cwd), item, path: 'src/videojs', overwrite: false });

    await expect(applyChangeSet(changeSet)).rejects.toThrow('Refusing to overwrite');
  });

  it('rejects lexical and symlink escapes before planning writes', async () => {
    const cwd = await fixture();
    const outside = await mkdtemp(join(tmpdir(), 'videojs-cli-outside-'));
    const project = await detectProject(cwd);

    await expect(planAdd({ project, item, path: '../outside', overwrite: false })).rejects.toThrow(
      'outside the project'
    );

    await symlink(outside, join(cwd, 'linked'));
    await expect(planAdd({ project, item, path: 'linked/source', overwrite: false })).rejects.toThrow(
      'through a symlink outside the project'
    );
  });
});

async function fixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'videojs-cli-change-set-'));

  await writeFile(join(cwd, 'package.json'), `${JSON.stringify({ name: 'fixture', private: true }, null, 2)}\n`);
  return cwd;
}
