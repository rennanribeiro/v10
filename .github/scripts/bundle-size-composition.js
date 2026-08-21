/**
 * Attributes preset bundle bytes back to the source package that emitted them.
 *
 * `bundle-size.js` answers "how big is this preset". This answers "what is
 * inside it": every byte esbuild writes is traced to its input module and
 * grouped by workspace package or external dependency, so a regression can be
 * pinned to a package instead of a total.
 *
 * Composition is reported in **minified** bytes. Brotli compresses a whole
 * stream, so there is no honest way to split a compressed total per module; the
 * brotli total for the same bundle is reported alongside it for scale.
 *
 * Preset entries mirror `bundle-size.js` — the same virtual bundles combining
 * skin + player (HTML) or skin + media + features (React), so the brotli totals
 * here match the ones `pnpm size` reports.
 *
 * Usage: node .github/scripts/bundle-size-composition.js [--root repo-root] [--json out.json]
 */

import { build } from 'esbuild';
import { brotliCompressSync, constants } from 'node:zlib';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootIndex = process.argv.indexOf('--root');
const ROOT =
  rootIndex !== -1
    ? resolve(process.argv[rootIndex + 1])
    : resolve(__dirname, '../..');

/** Packages that get a composition breakdown. */
const PACKAGES = ['html', 'react'];

/**
 * Preset virtual bundle definitions, mirroring `bundle-size.js`.
 *
 * @type {Array<{ label: string, preset: string, skin: string, hls: boolean }>}
 */
const PRESET_CONFIGS = [
  { label: 'video (default)', preset: 'video', skin: 'skin', hls: false },
  { label: 'video (default + hls)', preset: 'video', skin: 'skin', hls: true },
  { label: 'video (minimal)', preset: 'video', skin: 'minimal-skin', hls: false },
  { label: 'audio (default)', preset: 'audio', skin: 'skin', hls: false },
  { label: 'background', preset: 'background', skin: 'skin', hls: false },
];

/** Export lookup tables, keyed `{preset}/{variant}`. Paths are dist-relative. */
const PRESET_EXPORTS = {
  html: {
    'video/skin': { path: 'define/video/skin.js', name: 'VideoSkinElement' },
    'video/minimal-skin': { path: 'define/video/minimal-skin.js', name: 'MinimalVideoSkinElement' },
    'video/player': { path: 'define/video/player.js', name: 'VideoPlayerElement' },
    'audio/skin': { path: 'define/audio/skin.js', name: 'AudioSkinElement' },
    'audio/minimal-skin': { path: 'define/audio/minimal-skin.js', name: 'MinimalAudioSkinElement' },
    'audio/player': { path: 'define/audio/player.js', name: 'AudioPlayerElement' },
    'background/skin': { path: 'define/background/skin.js', name: 'BackgroundVideoSkinElement' },
    'background/player': { path: 'define/background/player.js', name: 'BackgroundVideoPlayerElement' },
    'hlsjs-video': { path: 'define/media/hlsjs-video.js', name: 'HlsJsVideoElement' },
  },
  react: {
    'video/skin': { path: 'presets/video/skin.js', name: 'VideoSkin' },
    'video/minimal-skin': { path: 'presets/video/minimal-skin.js', name: 'MinimalVideoSkin' },
    'video/media': { path: 'media/video.js', name: 'Video' },
    'audio/skin': { path: 'presets/audio/skin.js', name: 'AudioSkin' },
    'audio/minimal-skin': { path: 'presets/audio/minimal-skin.js', name: 'MinimalAudioSkin' },
    'audio/media': { path: 'media/audio.js', name: 'Audio' },
    'background/skin': { path: 'presets/background/skin.js', name: 'BackgroundVideoSkin' },
    'background/media': { path: 'media/background-video/index.js', name: 'BackgroundVideo' },
    'hlsjs-video': { path: 'media/hlsjs-video/index.js', name: 'HlsJsVideo' },
    'video/features': { path: '../../../core/dist/default/dom/store/features/presets.js', name: 'videoFeatures' },
    'audio/features': { path: '../../../core/dist/default/dom/store/features/presets.js', name: 'audioFeatures' },
    'background/features': { path: '../../../core/dist/default/dom/store/features/presets.js', name: 'backgroundFeatures' },
  },
};

/**
 * @typedef {object} GroupEntry
 * @property {string} group - Workspace package or external dependency name
 * @property {string} area - Subpath within the package, two segments deep
 * @property {number} initial - Minified bytes in the initial static graph
 * @property {number} lazy - Minified bytes in dynamically imported chunks
 * @property {Array<{ file: string, bytes: number }>} files - Largest contributors
 */

/**
 * @typedef {object} CompositionEntry
 * @property {string} package
 * @property {string} preset
 * @property {number} brotliInitial
 * @property {number} brotliLazy
 * @property {number} minInitial
 * @property {number} minLazy
 * @property {number} chunkCount
 * @property {GroupEntry[]} groups
 */

function compressSize(code) {
  return brotliCompressSync(Buffer.from(code), {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
    },
  }).length;
}

/** Build the virtual entry source for a preset, or null if a file is missing. */
function buildPresetEntry(pkgShortName, config, distDir) {
  const table = PRESET_EXPORTS[pkgShortName];
  if (!table) return null;

  const lines = [];

  function addExport(key) {
    const entry = table[key];
    // Key not in lookup → not applicable for this package type. Skip without
    // aborting, matching bundle-size.js.
    if (!entry) return true;
    if (!existsSync(resolve(distDir, entry.path))) return false;
    lines.push(`export { ${entry.name} } from './${entry.path}';`);
    return true;
  }

  if (!addExport(`${config.preset}/${config.skin}`)) return null;
  if (!addExport(`${config.preset}/player`)) return null;
  if (!addExport(`${config.preset}/media`)) return null;
  if (!addExport(`${config.preset}/features`)) return null;
  if (config.hls && !addExport('hlsjs-video')) return null;

  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Map an input module path to the group it belongs to.
 *
 * Externals resolve through `node_modules/`; workspace packages resolve to
 * `packages/<name>/dist/<condition>/<rest>`.
 */
function classify(inputPath) {
  const nodeModules = inputPath.lastIndexOf('node_modules/');
  if (nodeModules !== -1) {
    const after = inputPath.slice(nodeModules + 'node_modules/'.length);
    const parts = after.split('/');
    const name = parts[0].startsWith('@')
      ? `${parts[0]}/${parts[1]}`
      : parts[0];
    return { group: name, area: 'external', file: after };
  }

  const match = inputPath.match(/^packages\/([^/]+)\/dist\/[^/]+\/(.*)$/);
  if (match) {
    const rest = match[2];
    const segments = rest.split('/');
    const area =
      segments.length > 1
        ? segments.slice(0, Math.min(2, segments.length - 1)).join('/')
        : '(root)';
    return { group: `@videojs/${match[1]}`, area, file: rest };
  }

  return { group: 'other', area: inputPath, file: inputPath };
}

/** Output chunks reachable from the entry without crossing a dynamic import. */
function staticOutputs(metafile) {
  const outputs = new Set();
  const queue = Object.entries(metafile.outputs)
    .filter(([, output]) => output.entryPoint === '<stdin>')
    .map(([path]) => path);

  for (const path of queue) {
    if (outputs.has(path)) continue;
    outputs.add(path);

    for (const link of metafile.outputs[path].imports ?? []) {
      if (link.kind === 'dynamic-import') continue;
      if (metafile.outputs[link.path]) queue.push(link.path);
    }
  }

  return outputs;
}

/**
 * Bundle one preset and attribute its bytes.
 *
 * @returns {Promise<CompositionEntry | null>}
 */
async function analyze(pkgShortName, config, distDir, external) {
  const code = buildPresetEntry(pkgShortName, config, distDir);
  if (!code) return null;

  const result = await build({
    stdin: { contents: code, resolveDir: distDir, loader: 'js' },
    bundle: true,
    minify: true,
    treeShaking: true,
    format: 'esm',
    splitting: true,
    absWorkingDir: ROOT,
    write: false,
    outdir: '/tmp/bundle-size-composition-out',
    external,
    metafile: true,
    logLevel: 'silent',
  });

  const staticPaths = staticOutputs(result.metafile);
  const textByPath = new Map(
    result.outputFiles.map((file) => [file.path, file.text]),
  );

  let brotliInitial = 0;
  let brotliLazy = 0;
  let minInitial = 0;
  let minLazy = 0;

  /** @type {Map<string, GroupEntry & { files: Map<string, number> }>} */
  const groups = new Map();

  for (const [outputPath, output] of Object.entries(result.metafile.outputs)) {
    const isInitial = staticPaths.has(outputPath);
    const brotli = compressSize(textByPath.get(resolve(ROOT, outputPath)) ?? '');

    if (isInitial) {
      brotliInitial += brotli;
      minInitial += output.bytes;
    } else {
      brotliLazy += brotli;
      minLazy += output.bytes;
    }

    for (const [inputPath, meta] of Object.entries(output.inputs ?? {})) {
      const bytes = meta.bytesInOutput ?? 0;
      if (bytes === 0) continue;

      const { group, area, file } = classify(inputPath);
      const key = `${group} ${area}`;
      let entry = groups.get(key);
      if (!entry) {
        entry = { group, area, initial: 0, lazy: 0, files: new Map() };
        groups.set(key, entry);
      }

      if (isInitial) entry.initial += bytes;
      else entry.lazy += bytes;
      entry.files.set(file, (entry.files.get(file) ?? 0) + bytes);
    }
  }

  return {
    package: `@videojs/${pkgShortName}`,
    preset: config.label,
    brotliInitial,
    brotliLazy,
    minInitial,
    minLazy,
    chunkCount: Object.keys(result.metafile.outputs).length - staticPaths.size,
    groups: [...groups.values()]
      .map((entry) => ({
        group: entry.group,
        area: entry.area,
        initial: entry.initial,
        lazy: entry.lazy,
        files: [...entry.files.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([file, bytes]) => ({ file, bytes })),
      }))
      .sort((a, b) => b.initial + b.lazy - (a.initial + a.lazy)),
  };
}

async function main() {
  /** @type {CompositionEntry[]} */
  const results = [];

  for (const pkgShortName of PACKAGES) {
    const pkgJsonPath = join(ROOT, 'packages', pkgShortName, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;

    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    const external = Object.keys(pkgJson.peerDependencies ?? {});
    const distDir = join(ROOT, 'packages', pkgShortName, 'dist', 'default');
    if (!existsSync(distDir)) continue;

    for (const config of PRESET_CONFIGS) {
      const entry = await analyze(pkgShortName, config, distDir, external);
      if (entry) results.push(entry);
    }
  }

  const jsonIndex = process.argv.indexOf('--json');
  const outputPath = jsonIndex !== -1 ? process.argv[jsonIndex + 1] : null;
  const output = JSON.stringify(results, null, 2);

  if (outputPath) {
    writeFileSync(outputPath, output);
    console.log(`Written to ${outputPath}`);
  } else {
    console.log(output);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
