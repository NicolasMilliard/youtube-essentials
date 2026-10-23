import chokidar from 'chokidar';
import { build, context } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    browser: { type: 'string', default: 'chrome' },
    watch: { type: 'boolean', default: false },
  },
});

const { browser, watch } = values;

if (browser !== 'chrome' && browser !== 'firefox') {
  throw new Error(`Unsupported browser: ${browser}. Use chrome or firefox.`);
}

const outdir = join('dist', browser);
const manifestFiles =
  browser === 'firefox' ? ['manifest.json', 'manifest.firefox.json'] : ['manifest.json'];

async function readManifest() {
  const manifests = await Promise.all(
    manifestFiles.map(async (file) => JSON.parse(await readFile(file, 'utf8'))),
  );

  return Object.assign({}, ...manifests);
}

async function writeManifest(manifest) {
  await writeFile(join(outdir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

const staticFiles = [
  ['src/popup/popup.html', 'popup/popup.html'],
  ['src/popup/popup.css', 'popup/popup.css'],
  ['src/content/content.css', 'content/content.css'],
  ['src/assets/icons/icon-16.png', 'icons/icon-16.png'],
  ['src/assets/icons/icon-32.png', 'icons/icon-32.png'],
  ['src/assets/icons/icon-48.png', 'icons/icon-48.png'],
  ['src/assets/icons/icon-128.png', 'icons/icon-128.png'],
];

async function copyStaticFile(source, destination) {
  const output = join(outdir, destination);

  await mkdir(dirname(output), { recursive: true });
  await cp(source, output);
}

const manifest = await readManifest();

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await writeManifest(manifest);
await Promise.all(staticFiles.map(([source, destination]) => copyStaticFile(source, destination)));

const options = {
  entryPoints: {
    'popup/popup': 'src/popup/popup.ts',
    'content/index': 'src/content/index.ts',
  },
  bundle: true,
  outdir,
  target:
    browser === 'firefox'
      ? `firefox${manifest.browser_specific_settings.gecko.strict_min_version}`
      : 'chrome120',
};

if (watch) {
  const ctx = await context(options);

  await ctx.watch();

  // Watch parent directories so deleted files are picked up when an editor recreates them.
  const staticDirectories = [
    ...new Set([...manifestFiles, ...staticFiles.map(([source]) => source)].map(dirname)),
  ];

  chokidar
    .watch(staticDirectories, { ignoreInitial: true, depth: 0 })
    .on('all', async (event, changedFile) => {
      if (!['add', 'change', 'unlink'].includes(event)) {
        return;
      }

      try {
        if (manifestFiles.includes(changedFile)) {
          await writeManifest(await readManifest());
          console.log(`Updated ${outdir}/manifest.json`);
          return;
        }

        const staticFile = staticFiles.find(([source]) => source === changedFile);

        if (!staticFile) {
          return;
        }

        const [source, destination] = staticFile;

        if (event === 'unlink') {
          await rm(join(outdir, destination), { force: true });
        } else {
          await copyStaticFile(source, destination);
        }

        console.log(`Updated ${join(outdir, destination)}`);
      } catch (error) {
        console.error(`Unable to update ${changedFile}:`, error);
      }
    });

  console.log(`Watching TypeScript, manifests, and static files for ${browser} in ${outdir}...`);
} else {
  await build(options);
}
