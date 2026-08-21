/**
 * Measures the marginal cost of each UI component.
 *
 * `bundle-size.js` measures every `ui/*` export standalone, which overstates
 * each one: bundling `@videojs/html/ui/play-button` alone reports ~11 kB, but
 * almost all of that is the player runtime every other component also pulls in,
 * so the standalone figures cannot be summed or compared to a preset.
 *
 * This anchors on the play button and reports `anchor + component` minus
 * `anchor` — what one more control actually costs a player that already renders
 * a control. Both figures are emitted so the difference stays visible.
 *
 * Entry points follow each package's `./ui/*` export: HTML registers components
 * through `define/ui/*.js`, React exports `ui/<name>/index.js`.
 *
 * Usage: node .github/scripts/bundle-size-ui.js [--root repo-root] [--json out.json]
 */

import { build } from 'esbuild';
import { brotliCompressSync, constants } from 'node:zlib';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootIndex = process.argv.indexOf('--root');
const ROOT =
  rootIndex !== -1
    ? resolve(process.argv[rootIndex + 1])
    : resolve(__dirname, '../..');

const PACKAGES = ['html', 'react'];

/** UI compound component parts — excluded, matching bundle-size.js. */
const UI_PARTS = new Set([
  'controls-group',
  'slider-buffer',
  'slider-fill',
  'slider-thumb',
  'slider-thumbnail',
  'slider-track',
  'slider-value',
  'time-group',
  'time-separator',
  'tooltip-group',
]);

/**
 * Component every other component is measured against. The play button is the
 * cheapest control that still pulls in the full shared player runtime, so the
 * delta isolates what the component itself adds.
 */
const ANCHOR = 'play-button';

/**
 * @typedef {object} ComponentEntry
 * @property {string} name
 * @property {number} standalone - Brotli size bundled on its own
 * @property {number} marginal - Brotli size added on top of the anchor
 * @property {boolean} [isAnchor]
 */

function compressSize(code) {
  return brotliCompressSync(Buffer.from(code), {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
    },
  }).length;
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

/** Bundle a virtual entry re-exporting the given dist-relative modules. */
async function measure(specifiers, distDir, external) {
  const code = specifiers
    .map((spec, i) => `export * as m${i} from ${JSON.stringify(spec)};`)
    .join('\n');

  const result = await build({
    stdin: { contents: code, resolveDir: distDir, loader: 'js' },
    bundle: true,
    minify: true,
    treeShaking: true,
    format: 'esm',
    splitting: true,
    absWorkingDir: ROOT,
    write: false,
    outdir: '/tmp/bundle-size-ui-out',
    external,
    metafile: true,
    logLevel: 'silent',
  });

  const staticPaths = staticOutputs(result.metafile);
  const textByPath = new Map(
    result.outputFiles.map((file) => [file.path, file.text]),
  );

  let size = 0;
  for (const outputPath of Object.keys(result.metafile.outputs)) {
    if (!staticPaths.has(outputPath)) continue;
    size += compressSize(textByPath.get(resolve(ROOT, outputPath)) ?? '');
  }

  return size;
}

/** Resolve a package's `./ui/*` export surface to dist-relative specifiers. */
function discoverComponents(pkgShortName, distDir) {
  const entries = [];

  const defineUiDir = join(distDir, 'define', 'ui');
  if (existsSync(defineUiDir)) {
    for (const dirent of readdirSync(defineUiDir, { withFileTypes: true })) {
      if (!dirent.isFile() || !dirent.name.endsWith('.js')) continue;
      const name = dirent.name.slice(0, -'.js'.length);
      if (UI_PARTS.has(name)) continue;
      // Skip types-only exports with no runtime code.
      if (readFileSync(join(defineUiDir, dirent.name), 'utf8').trim() === '') {
        continue;
      }
      entries.push({ name, spec: `./define/ui/${dirent.name}` });
    }
  } else {
    const uiDir = join(distDir, 'ui');
    if (!existsSync(uiDir)) return entries;
    for (const dirent of readdirSync(uiDir, { withFileTypes: true })) {
      if (!dirent.isDirectory() || UI_PARTS.has(dirent.name)) continue;
      if (!existsSync(join(uiDir, dirent.name, 'index.js'))) continue;
      entries.push({ name: dirent.name, spec: `./ui/${dirent.name}/index.js` });
    }
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  /** @type {Record<string, { anchor: string, anchorBrotli: number, components: ComponentEntry[] }>} */
  const results = {};

  for (const pkgShortName of PACKAGES) {
    const pkgJsonPath = join(ROOT, 'packages', pkgShortName, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;

    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    const external = Object.keys(pkgJson.peerDependencies ?? {});
    const distDir = join(ROOT, 'packages', pkgShortName, 'dist', 'default');
    if (!existsSync(distDir)) continue;

    const entries = discoverComponents(pkgShortName, distDir);
    const anchor = entries.find((entry) => entry.name === ANCHOR);
    if (!anchor) {
      throw new Error(`anchor "${ANCHOR}" not found in @videojs/${pkgShortName}`);
    }

    const anchorBrotli = await measure([anchor.spec], distDir, external);

    /** @type {ComponentEntry[]} */
    const components = [];
    for (const entry of entries) {
      if (entry.name === ANCHOR) {
        components.push({
          name: entry.name,
          standalone: anchorBrotli,
          marginal: 0,
          isAnchor: true,
        });
        continue;
      }

      const standalone = await measure([entry.spec], distDir, external);
      const combined = await measure(
        [anchor.spec, entry.spec],
        distDir,
        external,
      );

      components.push({
        name: entry.name,
        standalone,
        marginal: combined - anchorBrotli,
      });
    }

    results[pkgShortName] = {
      anchor: ANCHOR,
      anchorBrotli,
      components: components.sort((a, b) => b.marginal - a.marginal),
    };
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
