/**
 * Typography Design Tokens
 *
 * A complete, opinionated type system sized for cinematic video output.
 * All sizes are in pixels (the renderer works in px on a 1920×1080 canvas).
 */

// ─── Font stacks ──────────────────────────────────────────────────────────────

export const fontStacks = {
  /** High-contrast serif for hero headlines and editorial moments */
  display: '"Instrument Serif", Georgia, "Times New Roman", serif',
  /** Clean geometric sans for UI headings */
  heading: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
  /** Comfortable reading sans for body copy */
  body: '"Inter", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
  /** Fixed-width for code snippets and version strings */
  mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Menlo", monospace',
} as const;

export type FontFamily = keyof typeof fontStacks;

// ─── Size scale (px) ──────────────────────────────────────────────────────────

export const fontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
  "4xl": 48,
  "5xl": 64,
  "6xl": 80,
  "7xl": 96,
} as const;

export type FontSize = keyof typeof fontSizes;

// ─── Weight scale ─────────────────────────────────────────────────────────────

export const fontWeights = {
  thin: 100,
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  black: 900,
} as const;

export type FontWeight = keyof typeof fontWeights;

// ─── Letter spacing ───────────────────────────────────────────────────────────

export const letterSpacings = {
  tight: "-0.03em",
  snug: "-0.02em",
  normal: "0em",
  wide: "0.02em",
  wider: "0.05em",
} as const;

export type LetterSpacing = keyof typeof letterSpacings;

// ─── Line height scale ────────────────────────────────────────────────────────

export const lineHeights = {
  none: 1,
  tight: 1.15,
  snug: 1.3,
  normal: 1.5,
  relaxed: 1.65,
  loose: 2,
} as const;

export type LineHeight = keyof typeof lineHeights;

// ─── Composed text style ──────────────────────────────────────────────────────

export interface TextStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  letterSpacing: string;
  lineHeight: number;
}

/**
 * Compose a complete TextStyle object from token keys.
 *
 * @param size        - key from fontSizes (default "base")
 * @param weight      - key from fontWeights (default "regular")
 * @param family      - key from fontStacks (default "body")
 * @param spacing     - key from letterSpacings (default "normal")
 * @param leading     - key from lineHeights (default "normal")
 */
export function getTextStyle(
  size: FontSize = "base",
  weight: FontWeight = "regular",
  family: FontFamily = "body",
  spacing: LetterSpacing = "normal",
  leading: LineHeight = "normal"
): TextStyle {
  return {
    fontSize: fontSizes[size],
    fontFamily: fontStacks[family],
    fontWeight: fontWeights[weight],
    letterSpacing: letterSpacings[spacing],
    lineHeight: lineHeights[leading],
  };
}

// ─── Semantic presets ─────────────────────────────────────────────────────────
// Convenience composites for the most common text roles in templates.

export const textPresets = {
  heroDisplay: getTextStyle("7xl", "black", "display", "tight", "tight"),
  heroHeadline: getTextStyle("6xl", "bold", "heading", "tight", "tight"),
  sectionHeadline: getTextStyle("5xl", "bold", "heading", "snug", "tight"),
  cardHeadline: getTextStyle("4xl", "semibold", "heading", "snug", "snug"),
  subheadline: getTextStyle("2xl", "medium", "heading", "normal", "snug"),
  bodyLarge: getTextStyle("xl", "regular", "body", "normal", "normal"),
  body: getTextStyle("base", "regular", "body", "normal", "normal"),
  caption: getTextStyle("sm", "regular", "body", "wide", "normal"),
  label: getTextStyle("xs", "semibold", "body", "wider", "none"),
  code: getTextStyle("base", "regular", "mono", "normal", "normal"),
  versionBadge: getTextStyle("sm", "bold", "mono", "wider", "none"),
} as const;
