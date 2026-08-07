import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSkinArtifactGraph, skinsRoot } from '../../../packages/skins/scripts/build-artifact-graph.ts';
import { createSourceOutput } from '../output.ts';
import { createRegistryCatalog, type RegistryTarget } from '../registry.ts';

const targets = [
  { framework: 'react', style: 'tailwind' },
  { framework: 'react', style: 'css' },
  { framework: 'html', style: 'tailwind' },
  { framework: 'html', style: 'css' },
] as const satisfies readonly RegistryTarget[];

describe('createSourceOutput', () => {
  it('emits complete React component source with local exact icons', async () => {
    const { graph, diagnostics } = await buildSkinArtifactGraph();
    assert.deepEqual(diagnostics, []);

    const output = await createSourceOutput(graph, {
      rootDir: skinsRoot,
      target: { framework: 'react', style: 'tailwind' },
    });
    const files = output.artifacts['play-button'] ?? [];
    const entry = files.find((file) => file.target?.endsWith('/play-button.tsx'));
    const icons = files.find((file) => file.target?.endsWith('/icons.ts'));

    assert.deepEqual(
      files.map((file) => file.target),
      [
        'components/videojs/play-button/icons.ts',
        'components/videojs/play-button/play-button.tsx',
        'components/videojs/styles/base.css',
        'components/videojs/styles/components/button.tailwind.ts',
        'components/videojs/styles/tailwind.css',
        'components/videojs/styles/themes/default.css',
      ]
    );
    assert.match(entry?.content ?? '', /^import '\.\.\/styles\/tailwind\.css';/);
    assert.match(entry?.content ?? '', /from "@videojs\/react"/);
    assert.match(entry?.content ?? '', /from '\.\.\/button-tooltip\/button-tooltip'/);
    assert.match(entry?.content ?? '', /from '\.\.\/styles\/components\/button\.tailwind'/);
    assert.match(entry?.content ?? '', /className=\{cn\(button\.play\)\}/);
    assert.match(icons?.content ?? '', /export const PlayIcon/);
    assert.match(icons?.content ?? '', /export const PauseIcon/);
    assert.match(icons?.content ?? '', /export const RestartIcon/);
    assert.doesNotMatch(icons?.content ?? '', /FullscreenEnterIcon|VolumeHighIcon/);
    assert.deepEqual(output.dependencies?.['play-button'], ['@videojs/react', '@videojs/utils', 'react']);
    assertNoPrivateImports(files);
  });

  it('emits HTML source with exact element and icon registration modules', async () => {
    const { graph } = await buildSkinArtifactGraph();
    const output = await createSourceOutput(graph, {
      rootDir: skinsRoot,
      target: { framework: 'html', style: 'tailwind' },
    });
    const files = output.artifacts['time-slider'] ?? [];
    const entry = files.find((file) => file.target?.endsWith('/time-slider.tsx'));
    const elements = files.find((file) => file.target?.endsWith('/elements.ts'));
    const icons = files.find((file) => file.target?.endsWith('/icons.ts'));

    assert.match(
      entry?.content ?? '',
      /^import '\.\.\/styles\/tailwind\.css';\nimport '\.\/icons';\nimport '\.\/elements';/
    );
    assert.match(entry?.content ?? '', /<media-time-slider/);
    assert.equal(elements?.content, "import '@videojs/html/ui/time-slider';\n");
    assert.match(icons?.content ?? '', /'spinner': `<svg/);
    assert.doesNotMatch(icons?.content ?? '', /'play':|'volume-high':/);
    assert.deepEqual(output.dependencies?.['time-slider'], ['@videojs/html', '@videojs/utils']);
    assertNoPrivateImports(files);
  });

  it('rewrites Skin composition imports to sibling artifact directories', async () => {
    const { graph } = await buildSkinArtifactGraph();
    const output = await createSourceOutput(graph, {
      rootDir: skinsRoot,
      target: { framework: 'react', style: 'tailwind' },
    });
    const entry = output.artifacts['default-video-controls']?.find((file) =>
      file.target?.endsWith('/video-controls.tsx')
    );

    assert.match(entry?.content ?? '', /from '\.\.\/play-button\/play-button'/);
    assert.match(entry?.content ?? '', /from '\.\.\/time-slider\/time-slider'/);
    assert.match(entry?.content ?? '', /from '\.\.\/styles\/skins\/default-video-controls\.tailwind'/);
  });

  it('emits Tailwind source entrypoints and semantic theme configuration', async () => {
    const { graph } = await buildSkinArtifactGraph();
    const output = await createSourceOutput(graph, {
      rootDir: skinsRoot,
      target: { framework: 'react', style: 'tailwind' },
    });
    const tailwind = output.artifacts['play-button']?.find((file) => file.target?.endsWith('/styles/tailwind.css'));

    assert.match(tailwind?.content ?? '', /@import "tailwindcss";/);
    assert.match(tailwind?.content ?? '', /@source "\.\.\/\*\*\/\*\.\{ts,tsx,html\}";/);
    assert.match(tailwind?.content ?? '', /@theme inline/);
    assert.doesNotMatch(tailwind?.content ?? '', /\.skin\.tsx/);
  });

  it('emits ordinary CSS from the artifact style-module candidates', async () => {
    const { graph } = await buildSkinArtifactGraph();
    const output = await createSourceOutput(graph, {
      rootDir: skinsRoot,
      target: { framework: 'react', style: 'css' },
    });
    const files = output.artifacts['play-button'] ?? [];
    const entry = files.find((file) => file.target?.endsWith('/play-button.tsx'));
    const styles = files.find((file) => file.target?.endsWith('/play-button/styles.css'));

    assert.match(entry?.content ?? '', /^import '\.\/styles\.css';/);
    assert.match(entry?.content ?? '', /from '\.\.\/styles\/components\/button\.styles'/);
    assert.match(styles?.content ?? '', /@import '\.\.\/styles\/base\.css';/);
    assert.match(styles?.content ?? '', /\.size-media-control/);
    assert.match(styles?.content ?? '', /\.group-data-started\\\/play/);
    assert.doesNotMatch(styles?.content ?? '', /media-slider-track/);
    assert.equal(
      files.some((file) => file.target?.endsWith('/tailwind.css')),
      false
    );
  });

  it('is deterministic', async () => {
    const { graph } = await buildSkinArtifactGraph();
    const options = {
      rootDir: skinsRoot,
      target: { framework: 'react', style: 'tailwind' } as const,
    };

    assert.deepEqual(await createSourceOutput(graph, options), await createSourceOutput(graph, options));
  });

  for (const target of targets) {
    it(`builds the complete ${target.framework}/${target.style} registry catalog`, async () => {
      const { graph } = await buildSkinArtifactGraph();
      const output = await createSourceOutput(graph, { rootDir: skinsRoot, target });
      const catalog = createRegistryCatalog(graph, { target, output });

      assert.equal(catalog.items.length, 7);
      assert.equal(
        catalog.items.every((item) => item.files.every((file) => file.content.length > 0)),
        true
      );
      assertNoPrivateImports(catalog.items.flatMap((item) => item.files));
    });
  }
});

function assertNoPrivateImports(files: readonly { content: string }[]): void {
  const source = files.map((file) => file.content).join('\n');
  assert.doesNotMatch(source, /@videojs\/(?:core|icons)\/components|@videojs\/jsx/);
}
