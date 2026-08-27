import { Command, Option } from 'commander';

import { handleConfig } from './commands/config.js';
import { handleDocs } from './commands/docs.js';
import { handleAdd, handleList, type SourceCommandOptions, handleView } from './commands/source.js';

const program = new Command();

interface DocsCommandOptions {
  readonly framework?: string | undefined;
  readonly list?: boolean | undefined;
  readonly preset?: string | undefined;
  readonly skin?: string | undefined;
  readonly media?: string | undefined;
  readonly sourceUrl?: string | undefined;
  readonly installMethod?: string | undefined;
}

program
  .name('videojs')
  .description('Inspect documentation and own editable Video.js UI source.')
  .version(`@videojs/cli v${__CLI_VERSION__}`, '-v, --version');

program
  .command('docs [slug]')
  .description('Read a bundled documentation page.')
  .option('-l, --list', 'List available documentation.')
  .option('-f, --framework <framework>', 'Framework: html or react.')
  .option('--preset <preset>', 'Installation preset.')
  .option('--skin <skin>', 'Packaged skin.')
  .option('--media <media>', 'Media implementation.')
  .option('--source-url <url>', 'Media source URL.')
  .option('--install-method <method>', 'Package or CDN installation method.')
  .action(async (slug: string | undefined, options: DocsCommandOptions) => {
    await handleDocs(
      {
        framework: options.framework,
        list: Boolean(options.list),
        preset: options.preset,
        skin: options.skin,
        media: options.media,
        'source-url': options.sourceUrl,
        'install-method': options.installMethod,
      },
      slug ? [slug] : []
    );
  });

const config = program.command('config').description('Manage CLI preferences.');

config
  .command('set <key> <value>')
  .description('Set a preference.')
  .action((key: string, value: string) => handleConfig(['set', key, value]));
config
  .command('get <key>')
  .description('Read a preference.')
  .action((key: string) => handleConfig(['get', key]));
config
  .command('list')
  .description('List preferences.')
  .action(() => handleConfig(['list']));

addSourceOptions(program.command('list [kind]').description('List source-owned skins and components.'), false).action(
  (kind: string | undefined, options: SourceCommandOptions) => handleList(kind, options)
);

addSourceOptions(
  program.command('view <kind> <name>').description('Inspect the exact files for a source-owned item.'),
  false
).action(async (kind: string, name: string, options: SourceCommandOptions) => handleView(kind, name, options));

addSourceOptions(
  program.command('add <kind> <name>').description('Add editable Video.js UI source to a project.'),
  true
).action(async (kind: string, name: string, options: SourceCommandOptions) => handleAdd(kind, name, options));

try {
  await program.parseAsync();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function addSourceOptions(command: Command, writable: boolean): Command {
  command
    .option('--cwd <directory>', 'Project directory.', process.cwd())
    .addOption(new Option('--framework <framework>', 'Framework target.').choices(['react', 'html']))
    .addOption(new Option('--style <style>', 'Styling output.').choices(['css', 'tailwind']))
    .option('--json', 'Print machine-readable JSON.');

  if (writable) {
    command
      .option('--path <directory>', 'Installation directory.')
      .option('-y, --yes', 'Skip confirmation.')
      .option('--overwrite', 'Replace files that differ.')
      .option('--dry-run', 'Plan without writing.')
      .option('--diff [directory]', 'Show the catalog diff without writing.');
  }

  return command;
}
