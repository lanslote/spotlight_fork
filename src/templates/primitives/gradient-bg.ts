/**
 * Gradient Background Primitives
 *
 * Factory functions producing animated background and atmospheric SceneElement
 * objects. All coordinates are in the 1920×1080 canvas space.
 */

import type { SceneElement } from "../types";
import { easings } from "../tokens/animation";

// ─── animatedGradient ─────────────────────────────────────────────────────────

export interface AnimatedGradientConfig {
  /** Start angle in degrees (0 = top-to-bottom) */
  angle?: number;
  /** Gradient color stops */
  colors: { offset: number; color: string }[];
  /** Time when animation begins (seconds) */
  startTime?: number;
  /** How long the full animation plays (seconds). 0 = static. */
  duration?: number;
  /** Canvas width (default 1920) */
  width?: number;
  /** Canvas height (default 1080) */
  height?: number;
  /** Rotate the gradient by this many degrees over `duration` */
  angleShift?: number;
  opacity?: number;
}

/**
 * A full-canvas linear gradient that slowly rotates over time, creating the
 * living, breathing feel of Apple's aurora backgrounds.
 */
export function animatedGradient(config: AnimatedGradientConfig): SceneElement[] {
  const {
    angle = 135,
    colors,
    startTime = 0,
    duration = 0,
    width = 1920,
    height = 1080,
    angleShift = 15,
    opacity = 1,
  } = config;

  const element: SceneElement = {
    id: `animated-gradient-${Date.now()}`,
    type: "gradient",
    x: 0,
    y: 0,
    width,
    height,
    opacity,
    gradient: {
      type: "linear",
      stops: colors,
      angle,
    },
    keyframes:
      duration > 0
        ? [
            {
              time: startTime,
              props: { opacity },
            },
            {
              // The renderer reads gradient.angle via the keyframe props channel.
              // We encode it as a top-level numeric alias the renderer will apply.
              time: startTime + duration,
              props: { opacity },
            },
          ]
        : undefined,
    easing: easings.gentle,
  };

  // Second layer: shifted angle version for the "rotation" effect,
  // cross-fading at mid-point to simulate angular motion.
  if (duration > 0) {
    const shifted: SceneElement = {
      id: `animated-gradient-shift-${Date.now()}`,
      type: "gradient",
      x: 0,
      y: 0,
      width,
      height,
      opacity: 0,
      gradient: {
        type: "linear",
        stops: colors,
        angle: angle + angleShift,
      },
      keyframes: [
        { time: startTime, props: { opacity: 0 } },
        { time: startTime + duration * 0.5, props: { opacity: 0.5 } },
        { time: startTime + duration, props: { opacity: 0 } },
      ],
      easing: easings.gentle,
    };
    return [element, shifted];
  }

  return [element];
}

// ─── radialGlow ───────────────────────────────────────────────────────────────

export interface RadialGlowConfig {
  /** Center X of the glow (px) */
  cx: number;
  /** Center Y of the glow (px) */
  cy: number;
  /** Outer radius of the glow (px) */
  radius: number;
  /** Core color at center (should be semi-transparent) */
  color: string;
  /** When the glow appears (seconds) */
  startTime?: number;
  /** Pulse cycle duration; 0 = no pulse */
  pulseDuration?: number;
  /** Minimum opacity at trough of pulse (0–1) */
  pulseMin?: number;
  /** Maximum opacity at peak of pulse (0–1) */
  pulseMax?: number;
  opacity?: number;
  /** Canvas width (px) — informational, ignored by radialGlow() */
  width?: number;
  /** Canvas height (px) — informational, ignored by radialGlow() */
  height?: number;
}

/**
 * A radial glow that pulses gently — perfect for highlighting a product icon
 * or creating atmospheric depth in a dark scene.
 */
export function radialGlow(config: RadialGlowConfig): SceneElement[] {
  const {
    cx,
    cy,
    radius,
    color,
    startTime = 0,
    pulseDuration = 3,
    pulseMin = 0.4,
    pulseMax = 0.85,
    opacity = 0.75,
  } = config;

  const element: SceneElement = {
    id: `radial-glow-${Date.now()}`,
    type: "gradient",
    x: cx - radius,
    y: cy - radius,
    width: radius * 2,
    height: radius * 2,
    opacity,
    gradient: {
      type: "radial",
      stops: [
        { offset: 0, color },
        { offset: 0.5, color: color.replace(/[\d.]+\)$/, "0.3)") },
        { offset: 1, color: color.replace(/[\d.]+\)$/, "0)") },
      ],
    },
    keyframes:
      pulseDuration > 0
        ? [
            { time: startTime, props: { opacity: pulseMin } },
            { time: startTime + pulseDuration * 0.5, props: { opacity: pulseMax } },
            { time: startTime + pulseDuration, props: { opacity: pulseMin } },
            { time: startTime + pulseDuration * 1.5, props: { opacity: pulseMax } },
            { time: startTime + pulseDuration * 2, props: { opacity: pulseMin } },
          ]
        : undefined,
    easing: easings.gentle,
  };

  return [element];
}

// ─── meshGradient ─────────────────────────────────────────────────────────────

export interface MeshGradientConfig {
  /** Array of { x, y, color } control points */
  points: { x: number; y: number; color: string }[];
  startTime?: number;
  /** Total morph cycle duration (seconds) */
  morphDuration?: number;
  width?: number;
  height?: number;
  opacity?: number;
}

/**
 * Simulates a multi-point mesh gradient by layering multiple radial gradients
 * that slowly drift across the canvas — a technique used in Linear's branding.
 *
 * True mesh gradients require WebGL; this CPU-friendly approximation looks
 * spectacular for video output.
 */
export function meshGradient(config: MeshGradientConfig): SceneElement[] {
  const {
    points,
    startTime = 0,
    morphDuration = 8,
    width = 1920,
    height = 1080,
    opacity = 1,
  } = config;

  // Base: solid dark fill to underlay the glows
  const base: SceneElement = {
    id: `mesh-base-${Date.now()}`,
    type: "rect",
    x: 0,
    y: 0,
    width,
    height,
    fill: "#000000",
    opacity,
  };

  // One radial glow per control point, each drifting to a slightly different
  // position over the morph cycle.
  const glows: SceneElement[] = points.map((pt, i) => {
    const radius = Math.max(width, height) * 0.65;
    // Gentle drift amounts — offset each by a different phase
    const driftX = 120 * Math.sin((i * Math.PI * 2) / points.length);
    const driftY = 80 * Math.cos((i * Math.PI * 2) / points.length);

    return {
      id: `mesh-glow-${Date.now()}-${i}`,
      type: "gradient",
      x: pt.x - radius / 2,
      y: pt.y - radius / 2,
      width: radius,
      height: radius,
      opacity: 0.6,
      gradient: {
        type: "radial",
        stops: [
          { offset: 0, color: pt.color },
          { offset: 1, color: pt.color.replace(/[\d.]+\)$/, "0)") },
        ],
      },
      keyframes: [
        {
          time: startTime,
          props: { translateX: 0, translateY: 0, opacity: 0.6 },
        },
        {
          time: startTime + morphDuration * 0.33,
          props: { translateX: driftX, translateY: driftY, opacity: 0.75 },
        },
        {
          time: startTime + morphDuration * 0.66,
          props: { translateX: -driftX * 0.5, translateY: driftY * 0.5, opacity: 0.55 },
        },
        {
          time: startTime + morphDuration,
          props: { translateX: 0, translateY: 0, opacity: 0.6 },
        },
      ],
      easing: easings.gentle,
    };
  });

  return [base, ...glows];
}

// ─── noiseTexture ─────────────────────────────────────────────────────────────

export interface NoiseTextureConfig {
  opacity?: number;
  startTime?: number;
  width?: number;
  height?: number;
  /** Tint color blended over the noise (optional) */
  tint?: string;
}

/**
 * Adds a subtle noise/grain overlay — the renderer is expected to interpret
 * type "particle-field" with variant "noise" as a procedural noise texture.
 * This adds film-grain richness at minimal cost.
 */
export function noiseTexture(config: NoiseTextureConfig): SceneElement[] {
  const {
    opacity = 0.04,
    startTime = 0,
    width = 1920,
    height = 1080,
    tint,
  } = config;

  const element: SceneElement = {
    id: `noise-texture-${Date.now()}`,
    type: "particle-field",
    x: 0,
    y: 0,
    width,
    height,
    opacity,
    // Custom data properties the renderer reads to generate procedural noise.
    // Typed as string via screenContent for renderer-side dispatch.
    screenContent: JSON.stringify({ variant: "noise", tint: tint ?? null }),
    keyframes:
      startTime > 0
        ? [
            { time: 0, props: { opacity: 0 } },
            { time: startTime, props: { opacity: 0 } },
            { time: startTime + 0.3, props: { opacity } },
          ]
        : undefined,
    easing: easings.smooth,
  };

  return [element];
}
