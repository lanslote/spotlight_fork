/**
 * Social Media Teaser Template
 *
 * Short, punchy vertical video optimised for TikTok / Instagram / Twitter.
 * Default aspect ratio: 9:16 (1080×1920). Duration: 15–30s.
 *
 * Act 1 (0–5s)   : Bold hook text — large, attention-grabbing
 * Act 2 (5–13s)  : Product showcase in phone mockup
 * Act 3 (13–19s) : Key benefit copy
 * Act 4 (19–25s) : CTA + branding
 */

import type { Scene, SceneElement } from "./types";
import type { SocialTeaserProps } from "./schemas";
import { getTheme } from "./tokens/colors";
import { fontStacks, fontSizes, fontWeights } from "./tokens/typography";
import { easings, sceneTransitions } from "./tokens/animation";
import { characterReveal, lineReveal, fadeInText, wordReveal } from "./primitives/text-reveal";
import { animatedGradient, radialGlow, meshGradient, noiseTexture } from "./primitives/gradient-bg";
import { iphoneMockup } from "./primitives/device-mockup";
import { particleField, confetti } from "./primitives/particle-field";

// 9:16 canvas
const W = 1080;
const H = 1920;
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

// ─── Scene 1: Hook ────────────────────────────────────────────────────────────

function buildScene1(props: SocialTeaserProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 5;

  const bg = meshGradient({
    points: [
      { x: CX, y: H * 0.25, color: theme.glow },
      { x: W * 0.15, y: H * 0.7, color: theme.primary },
      { x: W * 0.85, y: H * 0.6, color: theme.accent },
    ],
    morphDuration: 8,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04, width: W, height: H });

  const topGlow = radialGlow({
    cx: CX,
    cy: H * 0.3,
    radius: 600,
    color: theme.glow,
    pulseDuration: 5,
    pulseMin: 0.3,
    pulseMax: 0.65,
    opacity: 0.5,
    width: W,
    height: H,
  });

  const particles = particleField({
    count: 50,
    colors: [theme.glow + "88", theme.accent + "66"],
    sizeMin: 1,
    sizeMax: 4,
    width: W,
    height: H,
    opacity: 0.5,
  });

  // Attention-grabbing hook — huge type, fills the screen
  const hookLines = splitIntoLines(props.hookText, 14);
  const hookFontSize = hookLines.length === 1 ? fontSizes["7xl"] : fontSizes["6xl"];

  const hookElements = lineReveal(hookLines, {
    x: CX,
    y: CY - (hookLines.length * hookFontSize * 1.15) / 2,
    width: W * 0.9,
    fontFamily: fontStacks.display,
    fontSize: hookFontSize,
    fontWeight: fontWeights.black,
    color: theme.foreground,
    letterSpacing: -2,
    lineHeight: 1.1,
    textAlign: "center",
    startTime: 0.3,
    duration: 0.7,
    stagger: 0.2,
    easing: easings.bouncy,
  });

  // Accent word highlight (visual only — colour the first word differently)
  const accentLine: SceneElement = {
    id: uid("hook-accent-line"),
    type: "rect",
    x: W * 0.1,
    y: CY + (hookLines.length * hookFontSize * 0.65) + 10,
    width: 0,
    height: 5,
    fill: theme.primary,
    cornerRadius: 3,
    opacity: 0,
    keyframes: [
      { time: 1.2, props: { opacity: 0, width: 0, x: CX } },
      { time: 2.0, props: { opacity: 1, width: W * 0.8, x: W * 0.1 } },
    ],
    easing: easings.smooth,
  };

  // Product name small credit at bottom
  const credit = fadeInText(props.productName, {
    x: CX,
    y: H * 0.9,
    fontFamily: fontStacks.body,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.medium,
    color: theme.secondary,
    textAlign: "center",
    width: W,
    startTime: 2.5,
    duration: 0.5,
    easing: easings.smooth,
  });

  return {
    id: uid("social-hook"),
    name: "Hook",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 160,
    },
    transition: { type: sceneTransitions.wipeLeft.type, duration: sceneTransitions.wipeLeft.duration },
    elements: [
      ...bg,
      ...noise,
      ...topGlow,
      ...particles,
      ...hookElements,
      accentLine,
      ...credit,
    ],
  };
}

// ─── Scene 2: Product showcase ────────────────────────────────────────────────

function buildScene2(props: SocialTeaserProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 8;

  const bg = animatedGradient({
    angle: 140,
    colors: theme.backgroundGradient,
    duration: sceneDuration,
    angleShift: 10,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04, width: W, height: H });

  // Phone centred in upper 60% of canvas
  const phoneH = H * 0.55;
  const phoneW = Math.round(phoneH * (393 / 852));
  const phoneX = CX - phoneW / 2;
  const phoneY = H * 0.1;

  const phone = iphoneMockup({
    x: phoneX,
    y: phoneY,
    height: phoneH,
    screenContent: theme.primary,
    startTime: 0.4,
    frameColor: "#1a1a22",
    shadowOpacity: 0.5,
    opacity: 1,
  });

  // Screen content inside phone
  const screenCX = phone.screen.x + phone.screen.width / 2;

  const appName: SceneElement = {
    id: uid("showcase-app-name"),
    type: "text",
    x: screenCX,
    y: phone.screen.y + phone.screen.height * 0.2,
    width: phone.screen.width * 0.85,
    text: props.productName,
    fontSize: Math.round(phone.screen.width * 0.095),
    fontFamily: fontStacks.heading,
    fontWeight: fontWeights.bold,
    color: "#ffffff",
    textAlign: "center",
    opacity: 0,
    keyframes: [
      { time: 0.8, props: { opacity: 0, translateY: 15 } },
      { time: 1.3, props: { opacity: 1, translateY: 0 } },
    ],
    easing: easings.smooth,
  };

  const appTagline: SceneElement = {
    id: uid("showcase-app-tagline"),
    type: "text",
    x: screenCX,
    y: phone.screen.y + phone.screen.height * 0.38,
    width: phone.screen.width * 0.8,
    text: props.tagline,
    fontSize: Math.round(phone.screen.width * 0.05),
    fontFamily: fontStacks.body,
    fontWeight: fontWeights.regular,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    opacity: 0,
    keyframes: [
      { time: 1.1, props: { opacity: 0, translateY: 10 } },
      { time: 1.6, props: { opacity: 1, translateY: 0 } },
    ],
    easing: easings.smooth,
  };

  // Body text below phone
  const bodyLines = splitIntoLines(props.bodyText || props.tagline, 22);
  const bodyElements = lineReveal(bodyLines, {
    x: CX,
    y: H * 0.71,
    width: W * 0.85,
    fontFamily: fontStacks.heading,
    fontSize: fontSizes["2xl"],
    fontWeight: fontWeights.medium,
    color: theme.foreground,
    letterSpacing: -0.3,
    lineHeight: 1.35,
    textAlign: "center",
    startTime: 1.4,
    duration: 0.7,
    stagger: 0.18,
    easing: easings.smooth,
  });

  return {
    id: uid("social-showcase"),
    name: "Product Showcase",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 140,
    },
    transition: { type: sceneTransitions.dissolve.type, duration: sceneTransitions.dissolve.duration },
    elements: [
      ...bg,
      ...noise,
      ...phone.elements,
      appName,
      appTagline,
      ...bodyElements,
    ],
  };
}

// ─── Scene 3: Key benefit ─────────────────────────────────────────────────────

function buildScene3(props: SocialTeaserProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 6;

  const bg = animatedGradient({
    angle: 150,
    colors: theme.backgroundGradient,
    duration: sceneDuration,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04, width: W, height: H });

  const centerGlow = radialGlow({
    cx: CX,
    cy: CY,
    radius: 500,
    color: theme.glow,
    pulseDuration: 4,
    pulseMin: 0.25,
    pulseMax: 0.6,
    opacity: 0.4,
    width: W,
    height: H,
  });

  // Large decorative number or emoji
  const decoEl: SceneElement = {
    id: uid("benefit-deco"),
    type: "text",
    x: CX,
    y: CY - 250,
    text: "✦",
    fontSize: 100,
    fontFamily: fontStacks.body,
    fontWeight: fontWeights.regular,
    color: theme.primary,
    textAlign: "center",
    opacity: 0,
    keyframes: [
      { time: 0.3, props: { opacity: 0, scale: 0.5, rotation: -15 } },
      { time: 0.9, props: { opacity: 1, scale: 1, rotation: 0 } },
    ],
    easing: easings.bouncy,
  };

  const benefitLines = splitIntoLines(props.bodyText || props.tagline, 16);
  const benefitElements = lineReveal(benefitLines, {
    x: CX,
    y: CY - 100,
    width: W * 0.88,
    fontFamily: fontStacks.display,
    fontSize: fontSizes["4xl"],
    fontWeight: fontWeights.black,
    color: theme.foreground,
    letterSpacing: -1,
    lineHeight: 1.1,
    textAlign: "center",
    startTime: 0.6,
    duration: 0.75,
    stagger: 0.22,
    easing: easings.smooth,
  });

  // Accent pill
  const pillW = 240;
  const pillH = 50;
  const pillX = CX - pillW / 2;
  const pillY = CY + benefitLines.length * (fontSizes["4xl"] * 1.2) + 30;

  const pill: SceneElement = {
    id: uid("benefit-pill"),
    type: "rect",
    x: pillX,
    y: pillY,
    width: pillW,
    height: pillH,
    fill: theme.primary,
    cornerRadius: pillH / 2,
    opacity: 0,
    keyframes: [
      { time: 1.8, props: { opacity: 0, scale: 0.8 } },
      { time: 2.3, props: { opacity: 1, scale: 1 } },
    ],
    easing: easings.bouncy,
  };

  const pillTxt: SceneElement = {
    id: uid("benefit-pill-txt"),
    type: "text",
    x: CX,
    y: pillY + pillH * 0.26,
    text: props.productName,
    fontSize: fontSizes.lg,
    fontFamily: fontStacks.heading,
    fontWeight: fontWeights.semibold,
    color: "#ffffff",
    textAlign: "center",
    opacity: 0,
    keyframes: [
      { time: 1.8, props: { opacity: 0 } },
      { time: 2.3, props: { opacity: 1 } },
    ],
    easing: easings.bouncy,
  };

  return {
    id: uid("social-benefit"),
    name: "Key Benefit",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 150,
    },
    transition: { type: sceneTransitions.wipeRight.type, duration: sceneTransitions.wipeRight.duration },
    elements: [
      ...bg,
      ...noise,
      ...centerGlow,
      decoEl,
      ...benefitElements,
      pill,
      pillTxt,
    ],
  };
}

// ─── Scene 4: CTA ─────────────────────────────────────────────────────────────

function buildScene4(props: SocialTeaserProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 6;

  const bg = meshGradient({
    points: [
      { x: CX * 0.6, y: H * 0.3, color: theme.glow },
      { x: CX * 1.4, y: H * 0.7, color: theme.primary },
    ],
    morphDuration: 6,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04, width: W, height: H });

  const confettiEls = confetti({
    originX: CX,
    originY: H * 0.25,
    count: 100,
    width: W,
    height: H,
    startTime: 0.5,
    duration: 3.5,
    opacity: 0.9,
  });

  const glow = radialGlow({
    cx: CX,
    cy: CY - 100,
    radius: 550,
    color: theme.glow,
    pulseDuration: 3,
    pulseMin: 0.3,
    pulseMax: 0.65,
    opacity: 0.45,
    width: W,
    height: H,
  });

  const ctaTitle = characterReveal(props.productName.toUpperCase(), {
    x: CX,
    y: CY - 220,
    fontFamily: fontStacks.display,
    fontSize: fontSizes["5xl"],
    fontWeight: fontWeights.black,
    color: theme.foreground,
    letterSpacing: 2,
    textAlign: "center",
    startTime: 0.4,
    duration: 0.55,
    stagger: 0.05,
    easing: easings.smooth,
    width: W,
  });

  const ctaTagline = fadeInText(props.tagline, {
    x: CX,
    y: CY - 100,
    width: W * 0.85,
    fontFamily: fontStacks.heading,
    fontSize: fontSizes["2xl"],
    fontWeight: fontWeights.regular,
    color: theme.secondary,
    textAlign: "center",
    startTime: 1.4,
    duration: 0.6,
    easing: easings.smooth,
  });

  // Big CTA button
  const ctaBtnW = W * 0.78;
  const ctaBtnH = 90;
  const ctaBtnX = CX - ctaBtnW / 2;
  const ctaBtnY = CY + 30;

  const ctaBtn: SceneElement = {
    id: uid("social-cta-btn"),
    type: "rect",
    x: ctaBtnX,
    y: ctaBtnY,
    width: ctaBtnW,
    height: ctaBtnH,
    fill: theme.primary,
    cornerRadius: ctaBtnH / 2,
    opacity: 0,
    keyframes: [
      { time: 2.0, props: { opacity: 0, scale: 0.88 } },
      { time: 2.6, props: { opacity: 1, scale: 1 } },
    ],
    easing: easings.bouncy,
  };

  const ctaBtnText: SceneElement = {
    id: uid("social-cta-btn-text"),
    type: "text",
    x: CX,
    y: ctaBtnY + ctaBtnH * 0.28,
    text: props.ctaText,
    fontSize: fontSizes["2xl"],
    fontFamily: fontStacks.heading,
    fontWeight: fontWeights.bold,
    color: "#ffffff",
    textAlign: "center",
    opacity: 0,
    keyframes: [
      { time: 2.0, props: { opacity: 0 } },
      { time: 2.6, props: { opacity: 1 } },
    ],
    easing: easings.bouncy,
  };

  const subtext = fadeInText("Link in bio ↓", {
    x: CX,
    y: ctaBtnY + ctaBtnH + 40,
    fontFamily: fontStacks.body,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.medium,
    color: theme.muted,
    textAlign: "center",
    startTime: 3.2,
    duration: 0.5,
    easing: easings.smooth,
  });

  return {
    id: uid("social-cta"),
    name: "CTA",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 165,
    },
    transition: { type: sceneTransitions.crossfade.type, duration: sceneTransitions.crossfade.duration },
    elements: [
      ...bg,
      ...noise,
      ...confettiEls,
      ...glow,
      ...ctaTitle,
      ...ctaTagline,
      ctaBtn,
      ctaBtnText,
      ...subtext,
    ],
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateSocialTeaser(props: SocialTeaserProps): Scene[] {
  return [
    buildScene1(props),
    buildScene2(props),
    buildScene3(props),
    buildScene4(props),
  ];
}
