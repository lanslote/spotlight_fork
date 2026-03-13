/**
 * Landing Page Hero Template
 *
 * A seamlessly looping hero video for website headers.
 * Duration: 10–30s. Default aspect ratio: 16:9.
 *
 * Act 1 (0–6s)    : Headline reveal with gradient text effect
 * Act 2 (6–18s)   : Feature highlights cycling (one per 3s)
 * Act 3 (18–22s)  : Smooth crossfade back to start (enables seamless loop)
 */

import type { Scene, SceneElement } from "./types";
import type { LandingHeroProps } from "./schemas";
import { getTheme } from "./tokens/colors";
import { fontStacks, fontSizes, fontWeights } from "./tokens/typography";
import { easings, sceneTransitions } from "./tokens/animation";
import { characterReveal, lineReveal, fadeInText } from "./primitives/text-reveal";
import { animatedGradient, radialGlow, meshGradient, noiseTexture } from "./primitives/gradient-bg";
import { starField, particleField } from "./primitives/particle-field";

const W = 1920;
const H = 1080;
const CX = W / 2;
const CY = H / 2;

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function splitIntoLines(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxChars && current.length > 0) {
      lines.push(current.trim());
      current = word + " ";
    } else {
      current += word + " ";
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

// ─── Scene 1: Headline ────────────────────────────────────────────────────────

function buildScene1(props: LandingHeroProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 6;

  const bg = meshGradient({
    points: [
      { x: W * 0.2, y: H * 0.2, color: theme.glow },
      { x: W * 0.8, y: H * 0.3, color: theme.primary },
      { x: W * 0.5, y: H * 0.85, color: theme.accent },
    ],
    morphDuration: 10,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.035, width: W, height: H });

  // Subtle star field for depth
  const stars = starField({
    count: 120,
    sizeMin: 0.5,
    sizeMax: 2,
    width: W,
    height: H,
    opacity: 0.35,
    twinkleFraction: 0.25,
  });

  const topGlow = radialGlow({
    cx: CX,
    cy: CY * 0.4,
    radius: 600,
    color: theme.glow,
    pulseDuration: 6,
    pulseMin: 0.15,
    pulseMax: 0.4,
    opacity: 0.3,
  });

  // Product name (smaller, label-style) above headline
  const productLabel = fadeInText(props.productName.toUpperCase(), {
    x: CX,
    y: CY - 170,
    fontFamily: fontStacks.body,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: theme.primary,
    letterSpacing: fontSizes.base * 0.15,
    textAlign: "center",
    startTime: 0.4,
    duration: 0.7,
    easing: easings.smooth,
  });

  // Headline — gradient text simulation via layered elements
  const headlineLines = splitIntoLines(props.headline, 30);
  const hFontSize = headlineLines.length === 1 ? fontSizes["6xl"] : fontSizes["5xl"];
  const hTotalH = headlineLines.length * hFontSize * 1.15;

  // White/primary version (full)
  const headlineMain = lineReveal(headlineLines, {
    x: CX,
    y: CY - hTotalH / 2 - 20,
    width: W * 0.75,
    fontFamily: fontStacks.display,
    fontSize: hFontSize,
    fontWeight: fontWeights.black,
    color: theme.foreground,
    letterSpacing: -1.5,
    lineHeight: 1.1,
    textAlign: "center",
    startTime: 0.8,
    duration: 0.8,
    stagger: 0.25,
    easing: easings.smooth,
  });

  // Overlaid accent colour — simulates gradient text (right portion)
  const headlineAccent = lineReveal(headlineLines, {
    x: CX,
    y: CY - hTotalH / 2 - 20,
    width: W * 0.75,
    fontFamily: fontStacks.display,
    fontSize: hFontSize,
    fontWeight: fontWeights.black,
    color: theme.primary,
    letterSpacing: -1.5,
    lineHeight: 1.1,
    textAlign: "center",
    startTime: 0.82,
    duration: 0.8,
    stagger: 0.25,
    easing: easings.smooth,
    opacity: 0.35,
  });

  // Subheadline
  const subLines = splitIntoLines(props.subheadline || props.tagline, 55);
  const subElements = lineReveal(subLines, {
    x: CX,
    y: CY + hTotalH / 2 + 10,
    width: W * 0.6,
    fontFamily: fontStacks.heading,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.regular,
    color: theme.muted,
    lineHeight: 1.5,
    textAlign: "center",
    startTime: 1.8,
    duration: 0.7,
    stagger: 0.2,
    easing: easings.smooth,
  });

  // CTA button
  const ctaBtnW = 240;
  const ctaBtnH = 56;
  const ctaBtnX = CX - ctaBtnW / 2;
  const ctaBtnY = CY + hTotalH / 2 + subLines.length * fontSizes.xl * 1.7 + 15;

  const ctaBtn: SceneElement = {
    id: uid("hero-cta-btn"),
    type: "rect",
    x: ctaBtnX,
    y: ctaBtnY,
    width: ctaBtnW,
    height: ctaBtnH,
    fill: theme.primary,
    cornerRadius: ctaBtnH / 2,
    opacity: 0,
    keyframes: [
      { time: 2.6, props: { opacity: 0, scale: 0.9 } },
      { time: 3.2, props: { opacity: 1, scale: 1 } },
    ],
    easing: easings.bouncy,
  };

  const ctaBtnText: SceneElement = {
    id: uid("hero-cta-btn-text"),
    type: "text",
    x: CX,
    y: ctaBtnY + ctaBtnH * 0.27,
    text: props.ctaText,
    fontSize: fontSizes.lg,
    fontFamily: fontStacks.heading,
    fontWeight: fontWeights.semibold,
    color: "#ffffff",
    textAlign: "center",
    opacity: 0,
    keyframes: [
      { time: 2.6, props: { opacity: 0 } },
      { time: 3.2, props: { opacity: 1 } },
    ],
    easing: easings.bouncy,
  };

  return {
    id: uid("lh-headline"),
    name: "Headline",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 150,
    },
    transition: { type: sceneTransitions.crossfade.type, duration: 600 },
    elements: [
      ...bg,
      ...noise,
      ...stars,
      ...topGlow,
      ...productLabel,
      ...headlineMain,
      ...headlineAccent,
      ...subElements,
      ctaBtn,
      ctaBtnText,
    ],
  };
}

// ─── Scene 2: Feature highlights cycling ─────────────────────────────────────

function buildScene2(props: LandingHeroProps): Scene {
  const theme = getTheme(props.theme);
  const features = props.features.slice(0, 6);
  const perFeatureDuration = 3; // seconds each
  const sceneDuration = features.length * perFeatureDuration;

  const bg = animatedGradient({
    angle: 145,
    colors: theme.backgroundGradient,
    duration: sceneDuration,
    angleShift: 15,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04, width: W, height: H });

  const bgGlow = radialGlow({
    cx: CX,
    cy: CY,
    radius: 500,
    color: theme.glow,
    pulseDuration: perFeatureDuration,
    pulseMin: 0.2,
    pulseMax: 0.5,
    opacity: 0.35,
  });

  const particles = particleField({
    count: 50,
    colors: [theme.glow + "66", theme.accent + "44"],
    sizeMin: 1,
    sizeMax: 3,
    width: W,
    height: H,
    opacity: 0.4,
  });

  // Progress indicator dots at the bottom
  const dotElements: SceneElement[] = features.map((_, i): SceneElement => {
    const dotX = CX - (features.length * 20) / 2 + i * 20;
    return {
      id: uid(`dot-${i}`),
      type: "circle",
      x: dotX,
      y: H * 0.88,
      width: 8,
      height: 8,
      fill: theme.muted,
      opacity: 0.4,
      keyframes: [
        { time: i * perFeatureDuration, props: { fill: theme.primary, opacity: 1, scale: 1.3 } },
        { time: i * perFeatureDuration + perFeatureDuration - 0.3, props: { fill: theme.primary, opacity: 1, scale: 1.3 } },
        { time: i * perFeatureDuration + perFeatureDuration, props: { fill: theme.muted, opacity: 0.4, scale: 1 } },
      ],
      easing: easings.smooth,
    };
  });

  // Product name watermark
  const watermark: SceneElement = {
    id: uid("lh-watermark"),
    type: "text",
    x: W * 0.05,
    y: H * 0.06,
    text: props.productName,
    fontSize: fontSizes.lg,
    fontFamily: fontStacks.heading,
    fontWeight: fontWeights.semibold,
    color: theme.foreground,
    opacity: 0.7,
  };

  // Feature cards — each fades in/out on its time slice
  const featureElements: SceneElement[] = features.flatMap((feature, i) => {
    const start = i * perFeatureDuration;
    const end = start + perFeatureDuration;
    const showStart = start + 0.3;
    const showEnd = end - 0.4;

    // Feature number
    const numEl: SceneElement = {
      id: uid(`feat-num-${i}`),
      type: "text",
      x: CX,
      y: CY - 120,
      text: `${String(i + 1).padStart(2, "0")} / ${String(features.length).padStart(2, "0")}`,
      fontSize: fontSizes.sm,
      fontFamily: fontStacks.mono,
      fontWeight: fontWeights.regular,
      color: theme.muted,
      textAlign: "center",
      opacity: 0,
      keyframes: [
        { time: showStart, props: { opacity: 0 } },
        { time: showStart + 0.4, props: { opacity: 0.7 } },
        { time: showEnd, props: { opacity: 0.7 } },
        { time: showEnd + 0.3, props: { opacity: 0 } },
      ],
      easing: easings.smooth,
    };

    // Feature text — large and punchy
    const featTextEl: SceneElement = {
      id: uid(`feat-text-${i}`),
      type: "text",
      x: CX,
      y: CY - 50,
      width: W * 0.65,
      text: feature,
      fontSize: fontSizes["4xl"],
      fontFamily: fontStacks.display,
      fontWeight: fontWeights.black,
      color: theme.foreground,
      letterSpacing: -1,
      lineHeight: 1.1,
      textAlign: "center",
      opacity: 0,
      translateY: 30,
      keyframes: [
        { time: showStart, props: { opacity: 0, translateY: 30 } },
        { time: showStart + 0.5, props: { opacity: 1, translateY: 0 } },
        { time: showEnd, props: { opacity: 1, translateY: 0 } },
        { time: showEnd + 0.3, props: { opacity: 0, translateY: -20 } },
      ],
      easing: easings.smooth,
    };

    // Underline
    const lineEl: SceneElement = {
      id: uid(`feat-line-${i}`),
      type: "rect",
      x: CX - 150,
      y: CY + 70,
      width: 0,
      height: 3,
      fill: theme.primary,
      cornerRadius: 2,
      opacity: 0,
      keyframes: [
        { time: showStart, props: { opacity: 0, width: 0, x: CX } },
        { time: showStart + 0.6, props: { opacity: 1, width: 300, x: CX - 150 } },
        { time: showEnd, props: { opacity: 1, width: 300, x: CX - 150 } },
        { time: showEnd + 0.3, props: { opacity: 0, width: 0, x: CX + 150 } },
      ],
      easing: easings.smooth,
    };

    return [numEl, featTextEl, lineEl];
  });

  return {
    id: uid("lh-features"),
    name: "Feature Highlights",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 145,
    },
    transition: { type: sceneTransitions.crossfade.type, duration: 800 },
    elements: [
      ...bg,
      ...noise,
      ...bgGlow,
      ...particles,
      watermark,
      ...featureElements,
      ...dotElements,
    ],
  };
}

// ─── Scene 3: Loop bridge (crossfade back to start) ───────────────────────────

function buildScene3(props: LandingHeroProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 4;

  const bg = meshGradient({
    points: [
      { x: W * 0.2, y: H * 0.2, color: theme.glow },
      { x: W * 0.8, y: H * 0.3, color: theme.primary },
      { x: W * 0.5, y: H * 0.85, color: theme.accent },
    ],
    morphDuration: 6,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.035, width: W, height: H });

  const stars = starField({
    count: 100,
    sizeMin: 0.5,
    sizeMax: 2,
    width: W,
    height: H,
    opacity: 0.35,
    twinkleFraction: 0.25,
    startTime: 0,
  });

  // Minimal centred tagline — bridges back to Scene 1 headline energy
  const bridgeText = characterReveal(props.productName.toUpperCase(), {
    x: CX,
    y: CY - 30,
    fontFamily: fontStacks.display,
    fontSize: fontSizes["5xl"],
    fontWeight: fontWeights.black,
    color: theme.foreground,
    letterSpacing: 4,
    textAlign: "center",
    startTime: 0.5,
    duration: 0.5,
    stagger: 0.04,
    easing: easings.smooth,
    width: W,
  });

  const bridgeSub = fadeInText(props.tagline, {
    x: CX,
    y: CY + 65,
    width: W * 0.55,
    fontFamily: fontStacks.heading,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.regular,
    color: theme.muted,
    textAlign: "center",
    startTime: 1.5,
    duration: 0.6,
    easing: easings.smooth,
  });

  return {
    id: uid("lh-loop-bridge"),
    name: "Loop Bridge",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 150,
    },
    // Crossfade back to Scene 1 for a seamless loop
    transition: { type: sceneTransitions.crossfade.type, duration: 1200 },
    elements: [
      ...bg,
      ...noise,
      ...stars,
      ...bridgeText,
      ...bridgeSub,
    ],
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateLandingHero(props: LandingHeroProps): Scene[] {
  return [
    buildScene1(props),
    buildScene2(props),
    buildScene3(props),
  ];
}
