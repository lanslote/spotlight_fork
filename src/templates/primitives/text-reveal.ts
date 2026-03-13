/**
 * Text Reveal Primitives
 *
 * Factory functions that return arrays of SceneElement objects implementing
 * common cinematic text animations. All positions / sizes are in the 1920×1080
 * canvas coordinate space unless explicitly noted.
 */

import type { SceneElement } from "../types";
import { easings, durations } from "../tokens/animation";
import { fontStacks, fontSizes, fontWeights } from "../tokens/typography";

// ─── Shared config shape ──────────────────────────────────────────────────────

export interface TextRevealConfig {
  /** Top-left anchor of the text block */
  x: number;
  y: number;
  /** Maximum width before wrapping (px) */
  width?: number;
  /** Font size key or raw px value */
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
  /** When (in scene seconds) this animation begins */
  startTime?: number;
  /** Total duration of the reveal animation (seconds) */
  duration?: number;
  /** Per-character / per-word / per-line stagger (seconds) */
  stagger?: number;
  easing?: string;
  opacity?: number;
}

const DEFAULTS: Required<Omit<TextRevealConfig, "x" | "y">> = {
  width: 1600,
  fontSize: fontSizes["4xl"],
  fontFamily: fontStacks.heading,
  fontWeight: fontWeights.bold,
  color: "#ffffff",
  textAlign: "center",
  letterSpacing: 0,
  lineHeight: 1.15,
  startTime: 0,
  duration: durations.slow / 1000,
  stagger: 0.04,
  easing: easings.smooth,
  opacity: 1,
};

function cfg(config: TextRevealConfig): Required<TextRevealConfig> {
  return { ...DEFAULTS, ...config } as Required<TextRevealConfig>;
}

// ─── characterReveal ──────────────────────────────────────────────────────────

/**
 * Reveals text one character at a time by fading + sliding each glyph up
 * from slightly below its resting position.
 *
 * Characters are modelled as individual text elements so the renderer can
 * animate them independently. Spaces are included as zero-width spacer elements
 * to preserve natural character positions.
 */
export function characterReveal(text: string, config: TextRevealConfig): SceneElement[] {
  const c = cfg(config);
  const chars = text.split("");
  // Estimate character width for horizontal layout
  const estimatedCharWidth = c.fontSize * 0.58;
  const totalWidth = chars.length * estimatedCharWidth;
  const startX =
    c.textAlign === "center"
      ? c.x - totalWidth / 2
      : c.textAlign === "right"
      ? c.x - totalWidth
      : c.x;

  return chars.map((char, i) => {
    const charX = startX + i * estimatedCharWidth;
    const animStart = c.startTime + i * c.stagger;
    const animEnd = animStart + c.duration;

    const element: SceneElement = {
      id: `char-reveal-${Date.now()}-${i}`,
      type: "text",
      x: charX,
      y: c.y,
      text: char === " " ? "\u00A0" : char,
      fontSize: c.fontSize,
      fontFamily: c.fontFamily,
      fontWeight: c.fontWeight,
      color: c.color,
      letterSpacing: c.letterSpacing,
      lineHeight: c.lineHeight,
      textAlign: "left",
      opacity: 0,
      translateY: 20,
      keyframes: [
        { time: animStart, props: { opacity: 0, translateY: 20 } },
        { time: animEnd, props: { opacity: c.opacity, translateY: 0 } },
      ],
      easing: c.easing,
    };

    return element;
  });
}

// ─── wordReveal ───────────────────────────────────────────────────────────────

/**
 * Reveals each word sequentially with a slide-up + fade.
 * Positions words with natural spacing based on estimated glyph metrics.
 */
export function wordReveal(text: string, config: TextRevealConfig): SceneElement[] {
  const c = cfg(config);
  const words = text.split(/\s+/).filter(Boolean);

  // Estimate word widths for layout
  const wordWidths = words.map((w) => w.length * c.fontSize * 0.55 + c.fontSize * 0.35);
  const totalWidth = wordWidths.reduce((a, b) => a + b, 0);

  let cursorX =
    c.textAlign === "center"
      ? c.x - totalWidth / 2
      : c.textAlign === "right"
      ? c.x - totalWidth
      : c.x;

  return words.map((word, i) => {
    const wordX = cursorX;
    cursorX += wordWidths[i];
    const animStart = c.startTime + i * c.stagger;
    const animEnd = animStart + c.duration;

    const element: SceneElement = {
      id: `word-reveal-${Date.now()}-${i}`,
      type: "text",
      x: wordX,
      y: c.y,
      text: word,
      fontSize: c.fontSize,
      fontFamily: c.fontFamily,
      fontWeight: c.fontWeight,
      color: c.color,
      letterSpacing: c.letterSpacing,
      lineHeight: c.lineHeight,
      textAlign: "left",
      opacity: 0,
      translateY: 30,
      keyframes: [
        { time: animStart, props: { opacity: 0, translateY: 30 } },
        { time: animEnd, props: { opacity: c.opacity, translateY: 0 } },
      ],
      easing: c.easing,
    };

    return element;
  });
}

// ─── lineReveal ───────────────────────────────────────────────────────────────

/**
 * Reveals an array of lines one at a time with a stagger between them.
 * Each line uses the "revealUp" motion (slide from below + fade).
 *
 * @param lines - array of strings; each string is one rendered line
 */
export function lineReveal(lines: string[], config: TextRevealConfig): SceneElement[] {
  const c = cfg(config);
  const lineSpacing = c.fontSize * (c.lineHeight + 0.15);

  return lines.flatMap((line, i) => {
    const lineY = c.y + i * lineSpacing;
    const animStart = c.startTime + i * c.stagger;
    const animEnd = animStart + c.duration;

    const element: SceneElement = {
      id: `line-reveal-${Date.now()}-${i}`,
      type: "text",
      x: c.x,
      y: lineY,
      width: c.width,
      text: line,
      fontSize: c.fontSize,
      fontFamily: c.fontFamily,
      fontWeight: c.fontWeight,
      color: c.color,
      letterSpacing: c.letterSpacing,
      lineHeight: c.lineHeight,
      textAlign: c.textAlign,
      opacity: 0,
      translateY: 48,
      keyframes: [
        { time: animStart, props: { opacity: 0, translateY: 48 } },
        { time: animEnd, props: { opacity: c.opacity, translateY: 0 } },
      ],
      easing: c.easing,
    };

    return [element];
  });
}

// ─── typewriter ───────────────────────────────────────────────────────────────

/**
 * Classic typewriter effect: renders text progressively by showing one extra
 * character per step, with a blinking cursor appended.
 *
 * Implementation: one element per character prefix, each fading in instantly
 * (opacity 0 → 1 in a single frame) and the previous prefix fading out.
 */
export function typewriter(text: string, config: TextRevealConfig): SceneElement[] {
  const c = cfg(config);
  const chars = text.split("");
  const totalDuration = c.duration;
  const perChar = totalDuration / chars.length;
  const elements: SceneElement[] = [];

  // The text element that grows character by character
  // We simulate via per-char keyframes on a single element using opacity steps
  // that the renderer's keyframe system will interpolate as step functions.
  for (let i = 0; i <= chars.length; i++) {
    const prefix = text.slice(0, i);
    const showTime = c.startTime + i * perChar;
    const hideTime = i < chars.length ? showTime + perChar : c.startTime + totalDuration + 9999;

    elements.push({
      id: `typewriter-${Date.now()}-${i}`,
      type: "text",
      x: c.x,
      y: c.y,
      width: c.width,
      text: prefix + (i < chars.length ? "|" : ""),
      fontSize: c.fontSize,
      fontFamily: c.fontFamily,
      fontWeight: c.fontWeight,
      color: c.color,
      letterSpacing: c.letterSpacing,
      lineHeight: c.lineHeight,
      textAlign: c.textAlign,
      opacity: 0,
      keyframes: [
        { time: Math.max(0, showTime - 0.001), props: { opacity: 0 } },
        { time: showTime, props: { opacity: c.opacity } },
        { time: hideTime - 0.001, props: { opacity: c.opacity } },
        { time: hideTime, props: { opacity: 0 } },
      ],
      easing: "linear",
    });
  }

  // Blinking cursor that persists after text is fully typed
  const cursorStart = c.startTime + totalDuration;
  elements.push({
    id: `typewriter-cursor-${Date.now()}`,
    type: "text",
    x: c.x + text.length * c.fontSize * 0.55,
    y: c.y,
    text: "|",
    fontSize: c.fontSize,
    fontFamily: c.fontFamily,
    fontWeight: fontWeights.thin,
    color: c.color,
    opacity: 0,
    keyframes: [
      { time: cursorStart, props: { opacity: 0 } },
      { time: cursorStart + 0.3, props: { opacity: c.opacity } },
      { time: cursorStart + 0.6, props: { opacity: 0 } },
      { time: cursorStart + 0.9, props: { opacity: c.opacity } },
      { time: cursorStart + 1.2, props: { opacity: 0 } },
      { time: cursorStart + 1.5, props: { opacity: c.opacity } },
    ],
    easing: "linear",
  });

  return elements;
}

// ─── fadeInText ───────────────────────────────────────────────────────────────

/**
 * Simple opacity fade-in for a text block. The cleanest, most versatile reveal.
 * Optionally combined with a very subtle upward drift for a "floating in" feel.
 */
export function fadeInText(text: string, config: TextRevealConfig): SceneElement[] {
  const c = cfg(config);
  const animEnd = c.startTime + c.duration;

  const element: SceneElement = {
    id: `fade-text-${Date.now()}`,
    type: "text",
    x: c.x,
    y: c.y,
    width: c.width,
    text,
    fontSize: c.fontSize,
    fontFamily: c.fontFamily,
    fontWeight: c.fontWeight,
    color: c.color,
    letterSpacing: c.letterSpacing,
    lineHeight: c.lineHeight,
    textAlign: c.textAlign,
    opacity: 0,
    translateY: 12,
    keyframes: [
      { time: c.startTime, props: { opacity: 0, translateY: 12 } },
      { time: animEnd, props: { opacity: c.opacity, translateY: 0 } },
    ],
    easing: c.easing,
  };

  return [element];
}
