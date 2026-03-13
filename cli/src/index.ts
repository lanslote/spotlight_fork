#!/usr/bin/env node

/**
 * Spotlight CLI
 * Create Apple-quality product launch videos from the command line.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { createCommand } from './commands/create.js';
import { listCommand } from './commands/list.js';
import { renderCommand } from './commands/render.js';
import { initCommand } from './commands/init.js';

// ─── Brand palette ───────────────────────────────────────────────────────────
export const brand = {
  primary: chalk.hex('#A855F7'),    // violet-500
  secondary: chalk.hex('#7C3AED'), // violet-700
  accent: chalk.hex('#C084FC'),    // violet-400
  dim: chalk.hex('#6B7280'),       // gray-500
  success: chalk.hex('#10B981'),   // emerald-500
  warning: chalk.hex('#F59E0B'),   // amber-500
  error: chalk.hex('#EF4444'),     // red-500
  white: chalk.white,
  bold: chalk.bold,
};

// ─── ASCII banner ─────────────────────────────────────────────────────────────
function printBanner(): void {
  const art = [
    brand.primary('  ██╗      █████╗ ██╗   ██╗███╗   ██╗ ██████╗██╗  ██╗██╗  ██╗██╗████████╗'),
    brand.primary('  ██║     ██╔══██╗██║   ██║████╗  ██║██╔════╝██║  ██║██║ ██╔╝██║╚══██╔══╝'),
    brand.accent( '  ██║     ███████║██║   ██║██╔██╗ ██║██║     ███████║█████╔╝ ██║   ██║   '),
    brand.accent( '  ██║     ██╔══██║██║   ██║██║╚██╗██║██║     ██╔══██║██╔═██╗ ██║   ██║   '),
    brand.secondary('  ███████╗██║  ██║╚██████╔╝██║ ╚████║╚██████╗██║  ██║██║  ██╗██║   ██║   '),
    brand.secondary('  ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝   ╚═╝   '),
  ].join('\n');

  const tagline = brand.dim('  Apple-quality product launch videos — from your terminal');
  const version = brand.dim('  v0.1.0');

  console.log('\n' + art);
  console.log(tagline + '  ' + version + '\n');
}

// ─── CLI definition ───────────────────────────────────────────────────────────
const program = new Command();

program
  .name('spotlight')
  .description('Create Apple-quality product launch videos from the command line')
  .version('0.1.0', '-v, --version', 'Print the current version')
  .helpOption('-h, --help', 'Show help information')
  .addHelpText('beforeAll', () => {
    printBanner();
    return '';
  });

// Prettify the default help output — Commander v12 uses formatHelp hook
program.configureHelp({
  subcommandTerm: (cmd) => brand.accent(cmd.name()),
});

// ─── Commands ─────────────────────────────────────────────────────────────────

program
  .command('create')
  .description('Interactive wizard to create a new launch video project')
  .option('-o, --output <path>', 'Output config file path', 'spotlight.config.json')
  .option('--no-banner', 'Skip the welcome banner')
  .action(async (options: { output: string; banner: boolean }) => {
    if (options.banner) printBanner();
    await createCommand(options.output);
  });

program
  .command('templates')
  .alias('list')
  .description('Browse all available video templates')
  .option('--json', 'Output as raw JSON')
  .action(async (options: { json: boolean }) => {
    printBanner();
    await listCommand(options.json);
  });

program
  .command('render')
  .description('Render a config file to a finished video')
  .argument('[config]', 'Path to config file', 'spotlight.config.json')
  .option('-o, --output <path>', 'Output video file path')
  .option('-q, --quality <level>', 'Render quality: draft | standard | ultra', 'standard')
  .option('--no-preview', 'Skip opening preview after render')
  .action(async (config: string, options: { output?: string; quality: string; preview: boolean }) => {
    printBanner();
    await renderCommand(config, options);
  });

program
  .command('init')
  .description('Scaffold a new Spotlight project in the current (or given) directory')
  .argument('[directory]', 'Target directory', '.')
  .option('-t, --template <name>', 'Bootstrap from a specific template')
  .option('--ts', 'Generate a TypeScript config schema alongside the JSON config')
  .action(async (directory: string, options: { template?: string; ts: boolean }) => {
    printBanner();
    await initCommand(directory, options);
  });

// ─── Unknown command handler ──────────────────────────────────────────────────

program.on('command:*', (operands: string[]) => {
  console.error(
    boxen(
      brand.error(`Unknown command: ${brand.bold(operands[0])}\n\n`) +
        brand.dim(`Run ${brand.white('spotlight --help')} to see all available commands.`),
      {
        padding: 1,
        margin: { top: 1, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'red',
      },
    ),
  );
  process.exit(1);
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Show banner when no command is given
  if (process.argv.length <= 2) {
    printBanner();

    console.log(
      boxen(
        [
          brand.primary(brand.bold('Get started in seconds')),
          '',
          `  ${brand.accent('$')} ${brand.white('spotlight create')}       ${brand.dim('— launch the interactive wizard')}`,
          `  ${brand.accent('$')} ${brand.white('spotlight templates')}     ${brand.dim('— browse all templates')}`,
          `  ${brand.accent('$')} ${brand.white('spotlight init my-app')}   ${brand.dim('— scaffold a new project')}`,
          `  ${brand.accent('$')} ${brand.white('spotlight render')}        ${brand.dim('— render your config to video')}`,
          '',
          brand.dim(`Run ${brand.white('spotlight --help')} for full documentation.`),
        ].join('\n'),
        {
          padding: 1,
          margin: { top: 0, bottom: 1, left: 2, right: 2 },
          borderStyle: 'round',
          borderColor: '#7C3AED',
          title: brand.secondary(' Spotlight '),
          titleAlignment: 'center',
        },
      ),
    );

    process.exit(0);
  }

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(
    '\n' +
      boxen(brand.error(brand.bold('Fatal error\n\n')) + brand.dim(message), {
        padding: 1,
        margin: { top: 0, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: 'red',
      }),
  );
  process.exit(1);
});
