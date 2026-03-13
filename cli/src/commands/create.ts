/**
 * Spotlight — `create` command
 *
 * Interactive wizard that guides the user through every decision
 * needed to produce a spotlight.config.json project file.
 */

import { writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { brand } from '../index.js';
import { TEMPLATES, THEMES, type Template, type Theme } from '../data/catalog.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpotlightConfig {
  version: '1';
  meta: {
    createdAt: string;
    cliVersion: string;
  };
  project: {
    name: string;
    tagline: string;
    description?: string;
    url?: string;
  };
  video: {
    template: string;
    theme: string;
    aspectRatio: string;
    duration: number;
    fps: number;
    quality: 'draft' | 'standard' | 'ultra';
  };
  assets: {
    logo?: string;
    screenshots: string[];
    music?: string;
  };
  export: {
    format: 'mp4' | 'webm' | 'gif';
    outputPath: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function separator(label?: string): { type: 'separator'; line?: string } {
  return {
    type: 'separator',
    line: label
      ? brand.dim(`  ── ${label} ──`)
      : brand.dim('  ────────────────────────'),
  } as { type: 'separator'; line?: string };
}

function buildTemplateChoices() {
  const groups: Record<string, Template[]> = {};
  for (const tpl of TEMPLATES) {
    if (!groups[tpl.category]) groups[tpl.category] = [];
    groups[tpl.category].push(tpl);
  }

  const choices: Array<{ name: string; value: string } | { type: 'separator'; line?: string }> = [];
  for (const [category, templates] of Object.entries(groups)) {
    choices.push(separator(category));
    for (const tpl of templates) {
      choices.push({
        name: [
          brand.accent(tpl.name.padEnd(22)),
          brand.dim(tpl.description),
        ].join(' '),
        value: tpl.id,
      });
    }
  }
  return choices;
}

function buildThemeChoices() {
  return THEMES.map((t: Theme) => ({
    name: [
      chalk.hex(t.primaryColor)('■ '),
      brand.white(t.name.padEnd(12)),
      brand.dim(t.description),
    ].join(''),
    value: t.id,
  }));
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export async function createCommand(outputPath: string): Promise<void> {
  console.log(
    boxen(
      [
        brand.primary(brand.bold('Welcome to the Spotlight wizard')),
        '',
        brand.dim('Answer a few questions and we\'ll generate your'),
        brand.dim('project config. You can edit it anytime afterwards.'),
      ].join('\n'),
      {
        padding: 1,
        margin: { top: 0, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: '#A855F7',
      },
    ),
  );

  // ── Step 1: Template ───────────────────────────────────────────────────────
  const { templateId } = await inquirer.prompt<{ templateId: string }>([
    {
      type: 'list',
      name: 'templateId',
      message: brand.primary('Choose a template:'),
      pageSize: 14,
      choices: buildTemplateChoices(),
    },
  ]);

  const selectedTemplate = TEMPLATES.find((t) => t.id === templateId)!;

  // ── Step 2: Project info ───────────────────────────────────────────────────
  const { productName, tagline, description, url } = await inquirer.prompt<{
    productName: string;
    tagline: string;
    description: string;
    url: string;
  }>([
    {
      type: 'input',
      name: 'productName',
      message: brand.primary('Product name:'),
      validate: (v: string) => (v.trim().length > 0 ? true : 'Product name cannot be empty'),
      filter: (v: string) => v.trim(),
    },
    {
      type: 'input',
      name: 'tagline',
      message: brand.primary('Tagline:'),
      default: 'The fastest way to ship.',
      validate: (v: string) => (v.trim().length <= 80 ? true : 'Tagline must be 80 characters or fewer'),
      filter: (v: string) => v.trim(),
    },
    {
      type: 'input',
      name: 'description',
      message: brand.primary('Short description') + brand.dim(' (optional):'),
      filter: (v: string) => v.trim(),
    },
    {
      type: 'input',
      name: 'url',
      message: brand.primary('Product URL') + brand.dim(' (optional):'),
      filter: (v: string) => v.trim(),
      validate: (v: string) => {
        if (!v) return true;
        try {
          new URL(v);
          return true;
        } catch {
          return 'Enter a valid URL (e.g. https://example.com)';
        }
      },
    },
  ]);

  // ── Step 3: Visual settings ────────────────────────────────────────────────
  const { themeId, aspectRatio, duration, fps } = await inquirer.prompt<{
    themeId: string;
    aspectRatio: string;
    duration: number;
    fps: number;
  }>([
    {
      type: 'list',
      name: 'themeId',
      message: brand.primary('Choose a theme:'),
      choices: buildThemeChoices(),
    },
    {
      type: 'list',
      name: 'aspectRatio',
      message: brand.primary('Aspect ratio:'),
      choices: selectedTemplate.aspectRatios.map((ar) => ({
        name: `${brand.accent(ar.ratio.padEnd(8))} ${brand.dim(`${ar.width}×${ar.height} — ${ar.label}`)}`,
        value: ar.ratio,
      })),
    },
    {
      type: 'list',
      name: 'duration',
      message: brand.primary('Video duration:'),
      choices: [
        { name: `${brand.accent('15s')} ${brand.dim('— Perfect for social stories')}`, value: 15 },
        { name: `${brand.accent('30s')} ${brand.dim('— Standard social ad')}`, value: 30 },
        { name: `${brand.accent('45s')} ${brand.dim('— Feature-rich showcase')}`, value: 45 },
        { name: `${brand.accent('60s')} ${brand.dim('— Full product walkthrough')}`, value: 60 },
        { name: `${brand.accent('90s')} ${brand.dim('— Long-form launch film')}`, value: 90 },
      ].filter((c) => {
        const { minDuration, maxDuration } = selectedTemplate;
        return c.value >= minDuration && c.value <= maxDuration;
      }),
    },
    {
      type: 'list',
      name: 'fps',
      message: brand.primary('Frame rate:'),
      choices: [
        { name: `${brand.accent('24 fps')} ${brand.dim('— Cinematic film look')}`, value: 24 },
        { name: `${brand.accent('30 fps')} ${brand.dim('— Standard broadcast (recommended)')}`, value: 30 },
        { name: `${brand.accent('60 fps')} ${brand.dim('— Ultra-smooth motion')}`, value: 60 },
      ],
      default: 30,
    },
  ]);

  // ── Step 4: Export settings ────────────────────────────────────────────────
  // Split into two prompts so that the outputFile default can reference format.
  const { format, quality } = await inquirer.prompt<{
    format: 'mp4' | 'webm' | 'gif';
    quality: 'draft' | 'standard' | 'ultra';
  }>([
    {
      type: 'list',
      name: 'format',
      message: brand.primary('Export format:'),
      choices: [
        { name: `${brand.accent('mp4')}  ${brand.dim('— H.264 / H.265. Best compatibility')}`, value: 'mp4' },
        { name: `${brand.accent('webm')} ${brand.dim('— VP9. Ideal for web embedding')}`, value: 'webm' },
        { name: `${brand.accent('gif')}  ${brand.dim('— Animated GIF. Great for READMEs')}`, value: 'gif' },
      ],
    },
    {
      type: 'list',
      name: 'quality',
      message: brand.primary('Render quality:'),
      choices: [
        { name: `${brand.accent('draft')}    ${brand.dim('— Fast preview, lower quality')}`, value: 'draft' },
        { name: `${brand.accent('standard')} ${brand.dim('— Balanced (recommended)')}`, value: 'standard' },
        { name: `${brand.accent('ultra')}    ${brand.dim('— Maximum quality, slower render')}`, value: 'ultra' },
      ],
      default: 'standard',
    },
  ]);

  const { outputFile } = await inquirer.prompt<{ outputFile: string }>([
    {
      type: 'input',
      name: 'outputFile',
      message: brand.primary('Output file name:'),
      default: `${productName.toLowerCase().replace(/\s+/g, '-')}-launch.${format}`,
      filter: (v: string) => v.trim(),
    },
  ]);

  // ── Build config ───────────────────────────────────────────────────────────
  const config: SpotlightConfig = {
    version: '1',
    meta: {
      createdAt: new Date().toISOString(),
      cliVersion: '0.1.0',
    },
    project: {
      name: productName,
      tagline,
      ...(description && { description }),
      ...(url && { url }),
    },
    video: {
      template: templateId,
      theme: themeId,
      aspectRatio,
      duration,
      fps,
      quality,
    },
    assets: {
      screenshots: [],
    },
    export: {
      format,
      outputPath: outputFile,
    },
  };

  // ── Write file ─────────────────────────────────────────────────────────────
  const spinner = ora({
    text: brand.dim('Generating project config…'),
    color: 'magenta',
  }).start();

  const resolvedPath = resolve(outputPath);
  const alreadyExists = existsSync(resolvedPath);

  await new Promise<void>((res) => setTimeout(res, 600)); // brief theatrical pause

  try {
    writeFileSync(resolvedPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
    spinner.succeed(brand.success(`Config written to ${brand.bold(resolvedPath)}`));
  } catch (err) {
    spinner.fail(brand.error('Failed to write config file'));
    throw err;
  }

  if (alreadyExists) {
    console.log(brand.dim('\n  (Existing file was overwritten)\n'));
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const selectedTheme = THEMES.find((t) => t.id === themeId)!;

  console.log(
    boxen(
      [
        brand.primary(brand.bold('Your project is ready!')),
        '',
        `  ${brand.dim('Template  ')} ${brand.white(selectedTemplate.name)}`,
        `  ${brand.dim('Theme     ')} ${chalk.hex(selectedTheme.primaryColor)(selectedTheme.name)}`,
        `  ${brand.dim('Duration  ')} ${brand.white(`${duration}s @ ${fps} fps`)}`,
        `  ${brand.dim('Format    ')} ${brand.white(`${format.toUpperCase()} / ${quality}`)}`,
        `  ${brand.dim('Output    ')} ${brand.white(outputFile)}`,
        '',
        brand.primary(brand.bold('Next steps:')),
        '',
        `  ${brand.accent('1.')} Add screenshots & logo to the ${brand.white('assets/')} folder`,
        `  ${brand.accent('2.')} Edit ${brand.white(outputPath)} to fine-tune settings`,
        `  ${brand.accent('3.')} Run ${brand.white('spotlight render')} to produce your video`,
        '',
        brand.dim(`Tip: run ${brand.white('spotlight templates')} to explore all available templates.`),
      ].join('\n'),
      {
        padding: 1,
        margin: { top: 1, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: '#A855F7',
        title: brand.secondary(' done '),
        titleAlignment: 'center',
      },
    ),
  );
}
