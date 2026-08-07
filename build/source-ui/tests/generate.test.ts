import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRegistryFiles } from '../generate.ts';

describe('createRegistryFiles', () => {
  it('creates a root include manifest and four relative nested catalogs', async () => {
    const files = await createRegistryFiles('test/ref');
    const root = JSON.parse(files.get('registry.json') ?? '{}');
    const react = JSON.parse(files.get('registry/react/tailwind/registry.json') ?? '{}');

    assert.deepEqual(root.include, [
      'registry/react/tailwind/registry.json',
      'registry/react/css/registry.json',
      'registry/html/tailwind/registry.json',
      'registry/html/css/registry.json',
    ]);
    assert.equal(react.name, undefined);
    assert.equal(react.items.length, 7);
    assert.equal(
      react.items[0].files.every((file: { path: string }) => !file.path.startsWith('registry/')),
      true
    );
    assert.equal(
      react.items[0].files.every((file: { content?: string }) => file.content === undefined),
      true
    );
    assert.equal(
      react.items[0].files.every((file: { target?: string }) => file.target?.startsWith('@components/')),
      true
    );
    assert.equal(react.items[0].registryDependencies, undefined);
  });

  it('pins remaining same-repository component dependencies to the requested ref', async () => {
    const files = await createRegistryFiles('test/ref');
    const react = JSON.parse(files.get('registry/react/tailwind/registry.json') ?? '{}');
    const volume = react.items.find((item: { name: string }) => item.name.endsWith('/volume-popover'));

    assert.deepEqual(volume.registryDependencies, ['videojs/v10/react/tailwind/volume-slider#test/ref']);
  });

  it('is deterministic', async () => {
    assert.deepEqual(await createRegistryFiles(), await createRegistryFiles());
  });
});
