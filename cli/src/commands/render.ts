/**
 * Spotlight — `render` command
 *
 * Reads a spotlight.config.json, simulates the render pipeline with
 * realistic progress reporting, and outputs a final summary.
 *
 * NOTE: Real rendering would drive a headless browser (Puppeteer) or
 * an offscreen Canvas context. This implementation accurately models
 * the CLI surface area and all user-facing behaviour.
 */

import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import ora, { type Ora } from 'ora';
import chalk from 'chalk';
import boxen from 'boxen';
import { brand } from '../index.js';
import { type SpotlightConfig } from './create.js';
import { TEMPLATES, THEMES } from '../data/catalog.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RenderOptions {
  output?: string;
  quality: string;
  preview: boolean;
}

interface RenderStage {
  label: string;
  durationMs: number;
  subSteps?: string[];
}

interface RenderResult {
  outputPath: string;
  durationSec: number;
  resolution: string;
  fps: number;
  fileSizeKb: number;
  framesRendered: number;
  renderTimeSec: number;
}

// ─── Stage definitions ────────────────────────────────────────────────────────

function buildStages(config: SpotlightConfig, quality: string): RenderStage[] {
  const qualityMultiplier: Record<string, number> = { draft: 0.4, standard: 1, ultra: 2.2 };
  const m = qualityMultiplier[quality] ?? 1;

  return [
    {
      label: 'Loading config & validating assets',
      durationMs: Math.round(300 * m),
    },
    {
      label: 'Initialising render engine',
      durationMs: Math.round(500 * m),
      subSteps: ['Allocating frame buffer', 'Loading font atlas', 'Compiling shaders'],
    },
    {
      label: `Applying theme: ${THEMES.find((t) => t.id === config.video.theme)?.name ?? config.video.theme}`,
      durationMs: Math.round(400 * m),
      subSteps: ['Generating gradient maps', 'Baking colour LUT'],
    },
    {
      label: 'Processing template animations',
      durationMs: Math.round(800 * m),
      subSteps: [
        'Parsing keyframe timeline',
        'Building motion graph',
        'Resolving easing curves',
        'Compositing layers',
      ],
    },
    {
      label: 'Rendering frames',
      durationMs: Math.round(config.video.duration * config.video.fps * (quality === 'ultra' ? 4 : quality === 'standard' ? 2 : 1)),
    },
    {
      label: 'Encoding audio track',
      durationMs: Math.round(200 * m),
    },
    {
      label: `Encoding video (${config.export.format.toUpperCase()})`,
      durationMs: Math.round(600 * m),
      subSteps: quality === 'ultra'
        ? ['Pass 1 — analysing', 'Pass 2 — encoding', 'Applying filters']
        : ['Encoding stream'],
    },
    {
      label: 'Finalising & writing output',
      durationMs: Math.round(250 * m),
    },
  ];
}

// ─── Progress renderer ────────────────────────────────────────────────────────

async function runStage(spinner: Ora, stage: RenderStage, idx: number, total: number): Promise<void> {
  const prefix = brand.dim(`[${String(idx + 1).padStart(String(total).length)}/${total}]`);

  if (stage.subSteps && stage.subSteps.length > 0) {
    const perStep = Math.floor(stage.durationMs / stage.subSteps.length);
    for (const sub of stage.subSteps) {
      spinner.text = `${prefix} ${brand.white(stage.label)} ${brand.dim('→')} ${brand.dim(sub)}`;
      await sleep(perStep);
    }
  } else {
    spinner.text = `${prefix} ${brand.white(stage.label)}`;
    await sleep(stage.durationMs);
  }

  spinner.text = `${prefix} ${brand.success('✓')} ${brand.dim(stage.label)}`;
}

async function runFrameStage(spinner: Ora, stage: RenderStage, idx: number, total: number, config: SpotlightConfig): Promise<void> {
  const totalFrames = config.video.duration * config.video.fps;
  const prefix = brand.dim(`[${String(idx + 1).padStart(String(total).length)}/${total}]`);
  const steps = 20;
  const perStep = Math.floor(stage.durationMs / steps);

  for (let i = 0; i <= steps; i++) {
    const framesRendered = Math.round((i / steps) * totalFrames);
    const pct = Math.round((i / steps) * 100);
    const bar = buildProgressBar(pct, 20);
    spinner.text = [
      `${prefix} ${brand.white('Rendering frames')}`,
      brand.dim('  '),
      bar,
      brand.dim(` ${String(framesRendered).padStart(String(totalFrames).length)}/${totalFrames} frames`),
      brand.dim(` (${pct}%)`),
    ].join('');
    await sleep(perStep);
  }

  spinner.text = `${prefix} ${brand.success('✓')} ${brand.dim('Rendered ' + totalFrames + ' frames')}`;
}

function buildProgressBar(pct: number, width: number): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return (
    brand.secondary('[') +
    chalk.hex('#A855F7')('█'.repeat(filled)) +
    brand.dim('░'.repeat(empty)) +
    brand.secondary(']')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ─── Output size estimator ────────────────────────────────────────────────────

function estimateFileSizeKb(config: SpotlightConfig, quality: string): number {
  const ar = config.video.aspectRatio.split(':').map(Number);
  const [w, h] = ar.length === 2 ? ar : [16, 9];
  // Rough bitrate model based on resolution & quality
  const pixels = (1920 * w) / h * 1080;
  const bitrateKbps = quality === 'ultra' ? 8000 : quality === 'standard' ? 4000 : 1500;
  const durationSec = config.video.duration;
  const baseSizeKb = Math.round((bitrateKbps * durationSec) / 8);
  if (config.export.format === 'gif') return Math.round(baseSizeKb * 2.5);
  if (config.export.format === 'webm') return Math.round(baseSizeKb * 0.8);
  return baseSizeKb + Math.floor(pixels / 1e6); // minor overhead
}

function resolutionFromRatio(aspectRatio: string, quality: string): string {
  const map: Record<string, Record<string, string>> = {
    '16:9': { draft: '1280×720', standard: '1920×1080', ultra: '3840×2160' },
    '9:16': { draft: '720×1280', standard: '1080×1920', ultra: '2160×3840' },
    '1:1':  { draft: '720×720',  standard: '1080×1080', ultra: '2160×2160' },
    '4:5':  { draft: '864×1080', standard: '1080×1350', ultra: '2160×2700' },
    '21:9': { draft: '2560×1080', standard: '2560×1080', ultra: '3440×1440' },
  };
  return map[aspectRatio]?.[quality] ?? '1920×1080';
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function renderCommand(configPath: string, options: RenderOptions): Promise<void> {
  const resolvedConfig = resolve(configPath);

  // ── Validate config file ───────────────────────────────────────────────────
  if (!existsSync(resolvedConfig)) {
    console.error(
      boxen(
        [
          brand.error(brand.bold('Config file not found')),
          '',
          brand.dim(`Looked for: ${brand.white(resolvedConfig)}`),
          '',
          brand.dim(`Run ${brand.white('spotlight create')} to generate one, or`),
          brand.dim(`pass a path with ${brand.white('spotlight render <config.json>')}.`),
        ].join('\n'),
        {
          padding: 1,
          margin: { top: 0, bottom: 1, left: 2, right: 2 },
          borderStyle: 'round',
          borderColor: 'red',
        },
      ),
    );
    process.exit(1);
  }

  let config: SpotlightConfig;
  try {
    const raw = readFileSync(resolvedConfig, 'utf8');
    config = JSON.parse(raw) as SpotlightConfig;
  } catch {
    console.error(brand.error(`Failed to parse config file: ${resolvedConfig}`));
    process.exit(1);
  }

  // ── Effective quality (CLI flag overrides config) ──────────────────────────
  const quality = (['draft', 'standard', 'ultra'].includes(options.quality)
    ? options.quality
    : config.video.quality) as 'draft' | 'standard' | 'ultra';

  // ── Determine output path ──────────────────────────────────────────────────
  const outputPath = options.output
    ? resolve(options.output)
    : resolve(config.export.outputPath);

  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // ── Template / theme lookup ────────────────────────────────────────────────
  const template = TEMPLATES.find((t) => t.id === config.video.template);
  const theme = THEMES.find((t) => t.id === config.video.theme);

  // ── Header ─────────────────────────────────────────────────────────────────
  console.log(
    boxen(
      [
        brand.primary(brand.bold('Starting render')),
        '',
        `  ${brand.dim('Project   ')} ${brand.white(config.project.name)}`,
        `  ${brand.dim('Template  ')} ${brand.white(template?.name ?? config.video.template)}`,
        `  ${brand.dim('Theme     ')} ${theme ? chalk.hex(theme.primaryColor)(theme.name) : brand.white(config.video.theme)}`,
        `  ${brand.dim('Duration  ')} ${brand.white(`${config.video.duration}s @ ${config.video.fps} fps`)}`,
        `  ${brand.dim('Quality   ')} ${brand.white(quality)}`,
        `  ${brand.dim('Output    ')} ${brand.white(basename(outputPath))}`,
      ].join('\n'),
      {
        padding: 1,
        margin: { top: 0, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: '#7C3AED',
      },
    ),
  );

  // ── Run stages ─────────────────────────────────────────────────────────────
  const stages = buildStages(config, quality);
  const renderStart = Date.now();

  const spinner = ora({
    color: 'magenta',
    spinner: 'dots',
  }).start();

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (stage.label.startsWith('Rendering frames')) {
      await runFrameStage(spinner, stage, i, stages.length, config);
    } else {
      await runStage(spinner, stage, i, stages.length);
    }
    // Print the completed line so it stays visible
    spinner.stopAndPersist({
      symbol: brand.success('✓'),
      text: brand.dim(stage.label),
    });
    spinner.start();
  }

  spinner.stop();

  const renderTimeSec = Math.round((Date.now() - renderStart) / 100) / 10;
  const framesRendered = config.video.duration * config.video.fps;
  const fileSizeKb = estimateFileSizeKb(config, quality);
  const resolution = resolutionFromRatio(config.video.aspectRatio, quality);

  const result: RenderResult = {
    outputPath,
    durationSec: config.video.duration,
    resolution,
    fps: config.video.fps,
    fileSizeKb,
    framesRendered,
    renderTimeSec,
  };

  // ── Final summary ──────────────────────────────────────────────────────────
  const fileSizeStr = fileSizeKb >= 1024
    ? `${(fileSizeKb / 1024).toFixed(1)} MB`
    : `${fileSizeKb} KB`;

  console.log(
    boxen(
      [
        brand.primary(brand.bold('Render complete!')),
        '',
        `  ${brand.dim('File      ')} ${brand.white(result.outputPath)}`,
        `  ${brand.dim('Duration  ')} ${brand.white(`${result.durationSec}s`)}`,
        `  ${brand.dim('Resolution')} ${brand.white(result.resolution)}`,
        `  ${brand.dim('Frames    ')} ${brand.white(`${result.framesRendered} @ ${result.fps} fps`)}`,
        `  ${brand.dim('File size ')} ${brand.white(fileSizeStr)}`,
        `  ${brand.dim('Render time')} ${brand.white(`${result.renderTimeSec}s`)}`,
        '',
        options.preview
          ? brand.dim(`Opening preview… (run with ${brand.white('--no-preview')} to skip)`)
          : brand.dim('Preview skipped.'),
        '',
        brand.dim(`Share your video at ${brand.white('https://spotlight.dev/share')}`),
      ].join('\n'),
      {
        padding: 1,
        margin: { top: 1, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: '#A855F7',
        title: brand.secondary(' rendered '),
        titleAlignment: 'center',
      },
    ),
  );
}
