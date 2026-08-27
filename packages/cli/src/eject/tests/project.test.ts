import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import { detectProject } from '../project.js';

describe('detectProject', () => {
  it('detects React and Tailwind from dependencies', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'videojs-cli-project-'));

    await writeFile(
      join(cwd, 'package.json'),
      JSON.stringify({ dependencies: { '@videojs/react': '^10', tailwindcss: '^4' } })
    );

    await expect(detectProject(cwd)).resolves.toMatchObject({ framework: 'react', style: 'tailwind' });
  });

  it('leaves projects with both framework packages ambiguous', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'videojs-cli-project-'));

    await writeFile(
      join(cwd, 'package.json'),
      JSON.stringify({ dependencies: { '@videojs/html': '^10', '@videojs/react': '^10' } })
    );

    await expect(detectProject(cwd)).resolves.toMatchObject({ framework: undefined, style: 'css' });
  });
});
