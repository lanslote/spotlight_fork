/**
 * Product Hunt Launch Template
 *
 * A dramatic, Apple-keynote-quality launch video tuned for Product Hunt.
 * Duration: 30–60 seconds across 6 acts.
 *
 * Act 1 (0–6s)    : Gradient backdrop → Product name (character reveal) + tagline
 * Act 2 (6–12s)   : Problem statement — bold typography on dark canvas
 * Act 3 (12–19s)  : Feature 1 — device mockup + animated copy
 * Act 4 (19–26s)  : Feature 2 — device mockup + animated copy
 * Act 5 (26–33s)  : Feature 3 — device mockup + animated copy
 * Act 6 (33–40s)  : CTA — website URL + "Available on Product Hunt"
 */

import type { Scene, SceneElement } from "./types";
import type { ProductHuntProps } from "./schemas";
import { getTheme } from "./tokens/colors";
import { fontStacks, fontSizes, fontWeights } from "./tokens/typography";
import { easings, durations, sceneTransitions } from "./tokens/animation";
import { characterReveal, lineReveal, fadeInText } from "./primitives/text-reveal";
import { animatedGradient, radialGlow, meshGradient, noiseTexture } from "./primitives/gradient-bg";
import { iphoneMockup } from "./primitives/device-mockup";
import { particleField } from "./primitives/particle-field";

// ─── Canvas constants (16:9 default) ─────────────────────────────────────────
const W = 1920;
const H = 1080;
const CX = W / 2;
const CY = H / 2;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function changeBadgeColors(type: "added" | "improved" | "fixed"): { bg: string; text: string } {
  switch (type) {
    case "added":
      return { bg: "#10b981", text: "#ffffff" };
    case "improved":
      return { bg: "#6366f1", text: "#ffffff" };
    case "fixed":
      return { bg: "#f43f5e", text: "#ffffff" };
  }
}

// ─── Scene 1: Hero intro ──────────────────────────────────────────────────────

function buildScene1(props: ProductHuntProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 6;

  const bgElements = meshGradient({
    points: [
      { x: W * 0.2, y: H * 0.3, color: theme.glow },
      { x: W * 0.75, y: H * 0.6, color: theme.primary.replace(/^#/, "") === theme.primary ? theme.primary : theme.primary },
      { x: W * 0.5, y: H * 0.8, color: theme.accent },
    ],
    morphDuration: 8,
    width: W,
    height: H,
    opacity: 1,
  });

  const noise = noiseTexture({ opacity: 0.035, width: W, height: H });

  // Floating particles for depth
  const particles = particleField({
    count: 60,
    colors: [theme.glow, theme.accent + "88", "#ffffff44"],
    sizeMin: 1,
    sizeMax: 3,
    width: W,
    height: H,
    opacity: 0.5,
  });

  // Large atmospheric glow behind product name
  const centralGlow = radialGlow({
    cx: CX,
    cy: CY - 40,
    radius: 420,
    color: theme.glow,
    pulseDuration: 4,
    pulseMin: 0.3,
    pulseMax: 0.65,
    opacity: 0.5,
  });

  // "Introducing" label above product name
  const introLabel = fadeInText("Introducing", {
    x: CX,
    y: CY - 165,
    fontFamily: fontStacks.body,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.medium,
    color: theme.secondary,
    letterSpacing: fontSizes.xl * 0.08,
    textAlign: "center",
    startTime: 0.4,
    duration: 0.6,
    easing: easings.smooth,
  });

  // Product name — character-by-character reveal
  const productName = characterReveal(props.productName.toUpperCase(), {
    x: CX,
    y: CY - 90,
    fontFamily: fontStacks.display,
    fontSize: fontSizes["6xl"],
    fontWeight: fontWeights.black,
    color: theme.foreground,
    letterSpacing: -2,
    textAlign: "center",
    startTime: 0.9,
    duration: 0.55,
    stagger: 0.045,
    easing: easings.smooth,
  });

  // Tagline line-reveal
  const tagline = lineReveal([props.tagline], {
    x: CX,
    y: CY + 60,
    width: W * 0.65,
    fontFamily: fontStacks.heading,
    fontSize: fontSizes["2xl"],
    fontWeight: fontWeights.regular,
    color: theme.muted,
    letterSpacing: 0,
    textAlign: "center",
    startTime: 2.2,
    duration: 0.7,
    easing: easings.smooth,
  });

  // Thin horizontal rule beneath tagline
  const rule: SceneElement = {
    id: uid("ph-rule"),
    type: "rect",
    x: CX - 120,
    y: CY + 108,
    width: 0,
    height: 1.5,
    fill: theme.muted,
    opacity: 0,
    cornerRadius: 1,
    keyframes: [
      { time: 2.8, props: { opacity: 0, width: 0 } },
      { time: 3.5, props: { opacity: 0.5, width: 240 } },
    ],
    easing: easings.smooth,
  };

  // Subtitle (if provided)
  const subtitleElements: SceneElement[] = props.subtitle
    ? fadeInText(props.subtitle, {
        x: CX,
        y: CY + 130,
        width: W * 0.55,
        fontFamily: fontStacks.body,
        fontSize: fontSizes.lg,
        fontWeight: fontWeights.regular,
        color: theme.muted,
        textAlign: "center",
        startTime: 3.2,
        duration: 0.6,
        easing: easings.smooth,
      })
    : [];

  return {
    id: uid("scene-hero"),
    name: "Hero Intro",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 160,
    },
    transition: { type: sceneTransitions.crossfade.type, duration: sceneTransitions.crossfade.duration },
    elements: [
      ...bgElements,
      ...noise,
      ...particles,
      ...centralGlow,
      ...introLabel,
      ...productName,
      ...tagline,
      rule,
      ...subtitleElements,
    ],
  };
}

// ─── Scene 2: Problem statement ───────────────────────────────────────────────

function buildScene2(props: ProductHuntProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 6;

  const bg = animatedGradient({
    angle: 140,
    colors: theme.backgroundGradient,
    duration: sceneDuration,
    angleShift: 8,
    width: W,
    height: H,
    opacity: 1,
  });

  const noise = noiseTexture({ opacity: 0.04, width: W, height: H });

  // Oversized decorative quote mark
  const quoteMark: SceneElement = {
    id: uid("quote"),
    type: "text",
    x: CX - W * 0.38,
    y: CY - H * 0.35,
    text: "\u201C",
    fontSize: 320,
    fontFamily: fontStacks.display,
    fontWeight: fontWeights.black,
    color: theme.primary,
    opacity: 0,
    keyframes: [
      { time: 0.2, props: { opacity: 0 } },
      { time: 0.9, props: { opacity: 0.08 } },
    ],
    easing: easings.gentle,
  };

  // Problem statement — usually the tagline rephrased as a pain point
  const problemLines = [
    "The old way is broken.",
    props.tagline,
  ];

  const problemText = lineReveal(problemLines, {
    x: CX,
    y: CY - 80,
    width: W * 0.7,
    fontFamily: fontStacks.display,
    fontSize: fontSizes["4xl"],
    fontWeight: fontWeights.regular,
    color: theme.foreground,
    letterSpacing: -0.5,
    lineHeight: 1.2,
    textAlign: "center",
    startTime: 0.5,
    duration: 0.8,
    stagger: 0.3,
    easing: easings.smooth,
  });

  // Accent underline on second line
  const underline: SceneElement = {
    id: uid("underline"),
    type: "rect",
    x: CX - W * 0.25,
    y: CY + 40,
    width: 0,
    height: 3,
    fill: theme.primary,
    cornerRadius: 2,
    opacity: 0,
    keyframes: [
      { time: 1.4, props: { opacity: 0, width: 0, x: CX } },
      { time: 2.2, props: { opacity: 1, width: W * 0.5, x: CX - W * 0.25 } },
    ],
    easing: easings.smooth,
  };

  const productLabel = fadeInText(`But ${props.productName} changes everything.`, {
    x: CX,
    y: CY + 110,
    width: W * 0.55,
    fontFamily: fontStacks.heading,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.medium,
    color: theme.primary,
    textAlign: "center",
    startTime: 2.8,
    duration: 0.7,
    easing: easings.smooth,
  });

  return {
    id: uid("scene-problem"),
    name: "Problem Statement",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 140,
    },
    transition: { type: sceneTransitions.dissolve.type, duration: sceneTransitions.dissolve.duration },
    elements: [...bg, ...noise, quoteMark, ...problemText, underline, ...productLabel],
  };
}

// ─── Scene 3–5: Feature showcases ────────────────────────────────────────────

function buildFeatureScene(
  props: ProductHuntProps,
  featureIndex: number,
  sceneIndex: number
): Scene {
  const theme = getTheme(props.theme);
  const feature = props.features[featureIndex];
  if (!feature) return buildScene1(props); // safety fallback
  const sceneDuration = 7;

  const bg = animatedGradient({
    angle: 125 + featureIndex * 15,
    colors: theme.backgroundGradient,
    duration: sceneDuration,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.035, width: W, height: H });

  // Glow blob on the left side
  const glow = radialGlow({
    cx: W * 0.28,
    cy: H * 0.5,
    radius: 350,
    color: theme.glow,
    pulseDuration: 5,
    pulseMin: 0.2,
    pulseMax: 0.5,
    opacity: 0.35,
  });

  // Phone mockup right side
  const phoneH = H * 0.72;
  const phone = iphoneMockup({
    x: W * 0.57,
    y: CY - phoneH / 2,
    height: phoneH,
    screenContent: theme.primary,
    startTime: 0.6,
    frameColor: "#1a1a22",
    shadowOpacity: 0.5,
    opacity: 1,
  });

  // Screen content on the phone — product name + feature icon
  const screenCX = phone.screen.x + phone.screen.width / 2;
  const screenCY = phone.screen.y + phone.screen.height / 2;

  const screenIcon: SceneElement = {
    id: uid("feature-screen-icon"),
    type: "text",
    x: screenCX,
    y: screenCY - 60,
    text: feature.icon,
    fontSize: 80,
    fontFamily: fontStacks.body,
    fontWeight: fontWeights.regular,
    color: "#ffffff",
    textAlign: "center",
    opacity: 0,
    keyframes: [
      { time: 0.9, props: { opacity: 0, scale: 0.6 } },
      { time: 1.5, props: { opacity: 1, scale: 1 } },
    ],
    easing: easings.bouncy,
  };

  const screenText: SceneElement = {
    id: uid("feature-screen-text"),
    type: "text",
    x: screenCX,
    y: screenCY + 40,
    width: phone.screen.width * 0.85,
    text: feature.title,
    fontSize: Math.round(phone.screen.width * 0.075),
    fontFamily: fontStacks.heading,
    fontWeight: fontWeights.bold,
    color: "#ffffff",
    textAlign: "center",
    opacity: 0,
    keyframes: [
      { time: 1.2, props: { opacity: 0, translateY: 20 } },
      { time: 1.8, props: { opacity: 1, translateY: 0 } },
    ],
    easing: easings.smooth,
  };

  // Left column — textual content
  const featureNumber: SceneElement = {
    id: uid("feature-number"),
    type: "text",
    x: W * 0.07,
    y: H * 0.18,
    text: `0${featureIndex + 1}`,
    fontSize: fontSizes["7xl"],
    fontFamily: fontStacks.display,
    fontWeight: fontWeights.black,
    color: theme.primary,
    opacity: 0,
    keyframes: [
      { time: 0.2, props: { opacity: 0 } },
      { time: 0.7, props: { opacity: 0.15 } },
    ],
    easing: easings.smooth,
  };

  const featureBadge: SceneElement = {
    id: uid("feature-badge"),
    type: "rect",
    x: W * 0.07,
    y: H * 0.27,
    width: feature.icon.length * 14 + 90,
    height: 36,
    fill: theme.primary,
    cornerRadius: 18,
    opacity: 0,
    keyframes: [
      { time: 0.3, props: { opacity: 0, scale: 0.85 } },
      { time: 0.75, props: { opacity: 1, scale: 1 } },
    ],
    easing: easings.bouncy,
  };

  const featureBadgeText: SceneElement = {
    id: uid("feature-badge-text"),
    type: "text",
    x: W * 0.07 + 16,
    y: H * 0.27 + 9,
    text: `${feature.icon}  Feature`,
    fontSize: fontSizes.sm,
    fontFamily: fontStacks.body,
    fontWeight: fontWeights.bold,
    color: "#ffffff",
    letterSpacing: 1,
    opacity: 0,
    keyframes: [
      { time: 0.3, props: { opacity: 0 } },
      { time: 0.75, props: { opacity: 1 } },
    ],
    easing: easings.bouncy,
  };

  const titleElements = lineReveal([feature.title], {
    x: W * 0.07,
    y: H * 0.36,
    width: W * 0.46,
    fontFamily: fontStacks.heading,
    fontSize: fontSizes["4xl"],
    fontWeight: fontWeights.bold,
    color: theme.foreground,
    letterSpacing: -0.5,
    lineHeight: 1.1,
    textAlign: "left",
    startTime: 0.8,
    duration: 0.75,
    easing: easings.smooth,
  });

  const descElements = lineReveal(
    splitIntoLines(feature.description, 38),
    {
      x: W * 0.07,
      y: H * 0.52,
      width: W * 0.44,
      fontFamily: fontStacks.body,
      fontSize: fontSizes.lg,
      fontWeight: fontWeights.regular,
      color: theme.muted,
      lineHeight: 1.55,
      textAlign: "left",
      startTime: 1.3,
      duration: 0.65,
      stagger: 0.15,
      easing: easings.smooth,
    }
  );

  return {
    id: uid(`scene-feature-${sceneIndex}`),
    name: `Feature: ${feature.title}`,
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 125 + featureIndex * 15,
    },
    transition: { type: sceneTransitions.wipeLeft.type, duration: sceneTransitions.wipeLeft.duration },
    elements: [
      ...bg,
      ...noise,
      ...glow,
      ...phone.elements,
      screenIcon,
      screenText,
      featureNumber,
      featureBadge,
      featureBadgeText,
      ...titleElements,
      ...descElements,
    ],
  };
}

// ─── Scene 6: CTA ─────────────────────────────────────────────────────────────

function buildSceneCTA(props: ProductHuntProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 7;

  const bgElements = meshGradient({
    points: [
      { x: CX, y: H * 0.3, color: theme.glow },
      { x: W * 0.3, y: H * 0.7, color: theme.primary },
    ],
    morphDuration: 6,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04, width: W, height: H });

  const centralGlow = radialGlow({
    cx: CX,
    cy: CY,
    radius: 500,
    color: theme.glow,
    pulseDuration: 3,
    pulseMin: 0.25,
    pulseMax: 0.6,
    opacity: 0.4,
  });

  const ctaLine1 = characterReveal(props.productName.toUpperCase(), {
    x: CX,
    y: CY - 130,
    fontFamily: fontStacks.display,
    fontSize: fontSizes["5xl"],
    fontWeight: fontWeights.black,
    color: theme.foreground,
    letterSpacing: 2,
    textAlign: "center",
    startTime: 0.4,
    duration: 0.5,
    stagger: 0.04,
    easing: easings.smooth,
  });

  const ctaTagline = fadeInText(props.tagline, {
    x: CX,
    y: CY - 30,
    width: W * 0.6,
    fontFamily: fontStacks.heading,
    fontSize: fontSizes["2xl"],
    fontWeight: fontWeights.regular,
    color: theme.secondary,
    textAlign: "center",
    startTime: 1.4,
    duration: 0.6,
    easing: easings.smooth,
  });

  // CTA button
  const btnWidth = 340;
  const btnHeight = 64;
  const btnX = CX - btnWidth / 2;
  const btnY = CY + 55;

  const ctaButton: SceneElement = {
    id: uid("cta-btn"),
    type: "rect",
    x: btnX,
    y: btnY,
    width: btnWidth,
    height: btnHeight,
    fill: theme.primary,
    cornerRadius: btnHeight / 2,
    opacity: 0,
    keyframes: [
      { time: 2.0, props: { opacity: 0, scale: 0.9 } },
      { time: 2.6, props: { opacity: 1, scale: 1 } },
    ],
    easing: easings.bouncy,
  };

  const ctaButtonText: SceneElement = {
    id: uid("cta-btn-text"),
    type: "text",
    x: CX,
    y: btnY + btnHeight * 0.27,
    text: props.ctaText,
    fontSize: fontSizes.lg,
    fontFamily: fontStacks.heading,
    fontWeight: fontWeights.semibold,
    color: "#ffffff",
    textAlign: "center",
    opacity: 0,
    keyframes: [
      { time: 2.0, props: { opacity: 0 } },
      { time: 2.6, props: { opacity: 1 } },
    ],
    easing: easings.bouncy,
  };

  const urlText = fadeInText(props.websiteUrl, {
    x: CX,
    y: btnY + btnHeight + 30,
    fontFamily: fontStacks.mono,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.regular,
    color: theme.muted,
    textAlign: "center",
    startTime: 3.0,
    duration: 0.5,
    easing: easings.smooth,
  });

  const phBadge = fadeInText("Available on Product Hunt", {
    x: CX,
    y: btnY + btnHeight + 70,
    fontFamily: fontStacks.heading,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: theme.accent,
    textAlign: "center",
    startTime: 3.5,
    duration: 0.5,
    easing: easings.smooth,
  });

  return {
    id: uid("scene-cta"),
    name: "CTA",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 160,
    },
    transition: { type: sceneTransitions.crossfade.type, duration: sceneTransitions.crossfade.duration },
    elements: [
      ...bgElements,
      ...noise,
      ...centralGlow,
      ...ctaLine1,
      ...ctaTagline,
      ctaButton,
      ctaButtonText,
      ...urlText,
      ...phBadge,
    ],
  };
}

// ─── Utility: split long text into lines ─────────────────────────────────────

function splitIntoLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxCharsPerLine && current.length > 0) {
      lines.push(current.trim());
      current = word + " ";
    } else {
      current += word + " ";
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate the full Product Hunt launch video scene array.
 * Props should be pre-validated with ProductHuntPropsSchema.
 */
export function generateProductHunt(props: ProductHuntProps): Scene[] {
  const scenes: Scene[] = [
    buildScene1(props),
    buildScene2(props),
  ];

  // Add 1–3 feature scenes depending on how many features are provided
  const featureCount = Math.min(props.features.length, 3);
  for (let i = 0; i < featureCount; i++) {
    scenes.push(buildFeatureScene(props, i, i + 3));
  }

  scenes.push(buildSceneCTA(props));
  return scenes;
}
