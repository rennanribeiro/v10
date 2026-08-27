import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vite-plus/test';

const execute = promisify(execFile);
const root = resolve(import.meta.dirname, '../../../../..');
const catalog = 'packages/skins/dist/eject/catalog.json';

describe('Eject generated artifacts', () => {
  it('keeps the generated catalog ignored and untracked', async () => {
    await expect(execute('git', ['check-ignore', '--quiet', catalog], { cwd: root })).resolves.toBeDefined();

    const tracked = await execute('git', ['ls-files', '--', catalog], { cwd: root });

    expect(tracked.stdout).toBe('');
  });
});
