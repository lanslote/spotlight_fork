/**
 * Spotlight — `templates` / `list` command
 *
 * Renders a beautiful table of all available templates,
 * grouped by category, with colour-coded metadata.
 */

import chalk, { type ChalkInstance } from 'chalk';
import boxen from 'boxen';
import { brand } from '../index.js';
import { TEMPLATES, THEMES, type Template } from '../data/catalog.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Right-pad a string to a fixed width (no ANSI codes in the content itself). */
function pad(str: string, width: number): string {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

/** Truncate a string and add an ellipsis if it exceeds maxLen. */
function trunc(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

function categoryColor(category: string): ChalkInstance {
  const map: Record<string, ChalkInstance> = {
    'Launch': chalk.hex('#A855F7'),
    'Social': chalk.hex('#06B6D4'),
    'Product': chalk.hex('#10B981'),
    'App Store': chalk.hex('#F59E0B'),
    'Changelog': chalk.hex('#6366F1'),
  };
  return map[category] ?? chalk.white;
}

function durationBadge(min: number, max: number): string {
  if (min === max) return brand.dim(`${min}s`);
  return brand.dim(`${min}–${max}s`);
}

function ratioList(tpl: Template): string {
  return tpl.aspectRatios.map((ar) => brand.dim(ar.ratio)).join(brand.dim(', '));
}

// ─── Table renderer ───────────────────────────────────────────────────────────

function renderTable(): void {
  // Column widths (content, excluding ANSI)
  const COL = {
    id: 24,
    name: 22,
    cat: 12,
    dur: 9,
    ratios: 30,
    desc: 40,
  };

  const hr = brand.dim(
    '  ' +
      '─'.repeat(COL.id + COL.name + COL.cat + COL.dur + COL.ratios + 11),
  );

  const header = [
    '  ',
    brand.primary(brand.bold(pad('ID', COL.id))),
    brand.primary(brand.bold(pad('Name', COL.name))),
    brand.primary(brand.bold(pad('Category', COL.cat))),
    brand.primary(brand.bold(pad('Duration', COL.dur))),
    brand.primary(brand.bold('Aspect Ratios')),
  ].join('  ');

  console.log('');
  console.log(header);
  console.log(hr);

  // Group by category
  const groups: Record<string, Template[]> = {};
  for (const tpl of TEMPLATES) {
    if (!groups[tpl.category]) groups[tpl.category] = [];
    groups[tpl.category].push(tpl);
  }

  for (const [_category, templates] of Object.entries(groups)) {
    for (const tpl of templates) {
      const catChalk = categoryColor(tpl.category);
      const row = [
        '  ',
        brand.accent(pad(tpl.id, COL.id)),
        brand.white(pad(trunc(tpl.name, COL.name), COL.name)),
        catChalk(pad(tpl.category, COL.cat)),
        pad(durationBadge(tpl.minDuration, tpl.maxDuration), COL.dur + 14), // +14 accounts for ANSI codes in dim
        ratioList(tpl),
      ].join('  ');

      console.log(row);

      // Description on its own indented line
      console.log(
        '  ' +
          ' '.repeat(COL.id + 2) +
          brand.dim(trunc(tpl.description, COL.desc)),
      );
      console.log('');
    }
    console.log(hr);
  }
}

// ─── Theme swatch ─────────────────────────────────────────────────────────────

function renderThemes(): void {
  const swatches = THEMES.map((t) => {
    const swatch = chalk.hex(t.primaryColor)('██');
    const name = chalk.hex(t.primaryColor)(brand.bold(t.name.padEnd(8)));
    return `${swatch} ${name}`;
  }).join('   ');

  console.log(
    boxen(
      [
        brand.primary(brand.bold('Available Themes')),
        '',
        '  ' + swatches,
        '',
        brand.dim('  Set a theme with the ') +
          brand.white('"theme"') +
          brand.dim(' key in your config, or pick one during ') +
          brand.white('spotlight create') +
          brand.dim('.'),
      ].join('\n'),
      {
        padding: 1,
        margin: { top: 1, bottom: 1, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: '#7C3AED',
      },
    ),
  );
}

// ─── JSON output ──────────────────────────────────────────────────────────────

function renderJson(): void {
  const output = {
    templates: TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
      minDuration: t.minDuration,
      maxDuration: t.maxDuration,
      aspectRatios: t.aspectRatios,
    })),
    themes: THEMES,
  };
  console.log(JSON.stringify(output, null, 2));
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function listCommand(json: boolean): Promise<void> {
  if (json) {
    renderJson();
    return;
  }

  console.log(
    boxen(
      [
        brand.primary(brand.bold(`${TEMPLATES.length} templates across ${Object.keys(
          TEMPLATES.reduce<Record<string, true>>((acc, t) => { acc[t.category] = true; return acc; }, {}),
        ).length} categories`)),
        '',
        brand.dim('Use ') +
          brand.white('spotlight create') +
          brand.dim(' to start a new project with any template below.'),
        brand.dim('Use ') +
          brand.white('spotlight templates --json') +
          brand.dim(' to get raw JSON output.'),
      ].join('\n'),
      {
        padding: 1,
        margin: { top: 0, bottom: 0, left: 2, right: 2 },
        borderStyle: 'round',
        borderColor: '#A855F7',
      },
    ),
  );

  renderTable();
  renderThemes();
}
