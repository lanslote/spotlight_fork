/**
 * Particle Field Primitives
 *
 * Atmospheric particle and celebration effects. The renderer interprets
 * `type: "particle-field"` elements and reads a JSON config from `screenContent`
 * to drive the particle simulation. Each factory here assembles that config and
 * returns properly timed SceneElement objects.
 */

import type { SceneElement } from "../types";
import { easings } from "../tokens/animation";

// ─── Shared config ────────────────────────────────────────────────────────────

export interface ParticleFieldConfig {
  /** Number of particles (default varies per type) */
  count?: number;
  /** Particle color(s) — can be a single color or array for variation */
  colors?: string[];
  /** Minimum particle radius (px) */
  sizeMin?: number;
  /** Maximum particle radius (px) */
  sizeMax?: number;
  /** Canvas bounds */
  width?: number;
  height?: number;
  /** When the field appears (seconds) */
  startTime?: number;
  /** How long the field is visible (seconds); 0 = persist for scene duration */
  duration?: number;
  opacity?: number;
}

// ─── particleField ────────────────────────────────────────────────────────────

export interface ParticleFieldOptions extends ParticleFieldConfig {
  /** Drift speed multiplier (1 = normal, 2 = twice as fast) */
  speed?: number;
  /** Drift direction in degrees (0 = up, 90 = right) */
  direction?: number;
  /** Make particles slowly twirl (spin in place) */
  twirl?: boolean;
}

/**
 * Generates a field of slowly floating particles — perfect for depth and
 * atmosphere in dark, cinematic scenes.
 */
export function particleField(config: ParticleFieldOptions): SceneElement[] {
  const {
    count = 80,
    colors = ["rgba(255,255,255,0.6)", "rgba(180,180,255,0.5)", "rgba(200,255,220,0.4)"],
    sizeMin = 1,
    sizeMax = 4,
    width = 1920,
    height = 1080,
    startTime = 0,
    duration = 0,
    opacity = 0.6,
    speed = 1,
    direction = 355,
    twirl = false,
  } = config;

  const particleData = {
    variant: "float",
    count,
    colors,
    sizeMin,
    sizeMax,
    speed,
    direction,
    twirl,
  };

  const fadeInKf = [
    { time: startTime, props: { opacity: 0 } },
    { time: startTime + 1.2, props: { opacity } },
  ];

  const keyframes =
    duration > 0
      ? [
          ...fadeInKf,
          { time: startTime + duration - 0.8, props: { opacity } },
          { time: startTime + duration, props: { opacity: 0 } },
        ]
      : fadeInKf;

  const element: SceneElement = {
    id: `particle-field-${Date.now()}`,
    type: "particle-field",
    x: 0,
    y: 0,
    width,
    height,
    opacity: 0,
    screenContent: JSON.stringify(particleData),
    keyframes,
    easing: easings.gentle,
  };

  return [element];
}

// ─── starField ────────────────────────────────────────────────────────────────

export interface StarFieldOptions extends ParticleFieldConfig {
  /** Fraction of stars that twinkle actively (0–1, default 0.3) */
  twinkleFraction?: number;
  /** Whether to add a subtle parallax drift */
  parallax?: boolean;
}

/**
 * A twinkling star field — ideal for midnight/noir themes or for adding a
 * premium depth layer behind product showcases.
 */
export function starField(config: StarFieldOptions): SceneElement[] {
  const {
    count = 200,
    colors = ["rgba(255,255,255,0.9)", "rgba(220,230,255,0.7)", "rgba(255,240,200,0.8)"],
    sizeMin = 0.5,
    sizeMax = 2.5,
    width = 1920,
    height = 1080,
    startTime = 0,
    duration = 0,
    opacity = 0.8,
    twinkleFraction = 0.3,
    parallax = false,
  } = config;

  const starData = {
    variant: "stars",
    count,
    colors,
    sizeMin,
    sizeMax,
    twinkleFraction,
    parallax,
  };

  const keyframes = [
    { time: startTime, props: { opacity: 0 } },
    { time: startTime + 1.5, props: { opacity } },
    ...(duration > 0
      ? [
          { time: startTime + duration - 1, props: { opacity } },
          { time: startTime + duration, props: { opacity: 0 } },
        ]
      : []),
  ];

  const element: SceneElement = {
    id: `star-field-${Date.now()}`,
    type: "particle-field",
    x: 0,
    y: 0,
    width,
    height,
    opacity: 0,
    screenContent: JSON.stringify(starData),
    keyframes,
    easing: easings.gentle,
  };

  return [element];
}

// ─── confetti ─────────────────────────────────────────────────────────────────

export interface ConfettiOptions {
  /** Burst origin X (default: center of canvas) */
  originX?: number;
  /** Burst origin Y (default: upper third of canvas) */
  originY?: number;
  /** Total pieces of confetti */
  count?: number;
  /** Confetti color palette */
  colors?: string[];
  /** Width of each confetti piece (px) */
  pieceWidth?: number;
  /** Height of each confetti piece (px) */
  pieceHeight?: number;
  /** Gravity multiplier */
  gravity?: number;
  /** Initial spread angle (degrees) */
  spread?: number;
  width?: number;
  height?: number;
  startTime?: number;
  /** How long the confetti shower lasts (seconds) */
  duration?: number;
  opacity?: number;
}

/**
 * A celebratory confetti burst — for launch moments, milestones, and CTAs.
 * The renderer is responsible for simulating the physics; this element
 * declares the intent and parameters.
 */
export function confetti(config: ConfettiOptions): SceneElement[] {
  const {
    originX,
    originY,
    count = 150,
    colors = [
      "#6366f1", // indigo
      "#a78bfa", // violet
      "#34d399", // emerald
      "#fbbf24", // amber
      "#f43f5e", // rose
      "#60a5fa", // blue
      "#fb923c", // orange
    ],
    pieceWidth = 8,
    pieceHeight = 14,
    gravity = 1.0,
    spread = 120,
    width = 1920,
    height = 1080,
    startTime = 0,
    duration = 3,
    opacity = 1,
  } = config;

  const ox = originX ?? width / 2;
  const oy = originY ?? height * 0.35;

  const confettiData = {
    variant: "confetti",
    originX: ox,
    originY: oy,
    count,
    colors,
    pieceWidth,
    pieceHeight,
    gravity,
    spread,
  };

  const element: SceneElement = {
    id: `confetti-${Date.now()}`,
    type: "particle-field",
    x: 0,
    y: 0,
    width,
    height,
    opacity,
    screenContent: JSON.stringify(confettiData),
    keyframes: [
      { time: startTime, props: { opacity } },
      { time: startTime + duration * 0.7, props: { opacity } },
      { time: startTime + duration, props: { opacity: 0 } },
    ],
    easing: easings.easeOut,
  };

  return [element];
}
