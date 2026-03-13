/**
 * App Store Preview Template
 *
 * A vertical (9:16) video designed to meet Apple App Store preview guidelines.
 * Duration: 15–30s across 5 acts.
 *
 * Act 1 (0–5s)    : App icon + name — identity reveal
 * Act 2 (5–12s)   : Screenshot 1 in phone mockup
 * Act 3 (12–19s)  : Screenshot 2 in phone mockup (if provided)
 * Act 4 (19–26s)  : Screenshot 3 in phone mockup (if provided)
 * Act 5 (26–32s)  : Download CTA
 */

import type { Scene, SceneElement } from "./types";
import type { AppStorePreviewProps } from "./schemas";
import { getTheme } from "./tokens/colors";
import { fontStacks, fontSizes, fontWeights } from "./tokens/typography";
import { easings, sceneTransitions } from "./tokens/animation";
import { characterReveal, lineReveal, fadeInText } from "./primitives/text-reveal";
import { animatedGradient, radialGlow, meshGradient, noiseTexture } from "./primitives/gradient-bg";
import { iphoneMockup } from "./primitives/device-mockup";
import { particleField, starField } from "./primitives/particle-field";

// 9:16 vertical canvas for App Store preview
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

// ─── Scene 1: App Icon + Name ─────────────────────────────────────────────────

function buildScene1(props: AppStorePreviewProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 5;

  const bg = meshGradient({
    points: [
      { x: CX, y: H * 0.25, color: theme.glow },
      { x: W * 0.1, y: H * 0.7, color: theme.primary },
      { x: W * 0.9, y: H * 0.55, color: theme.accent },
    ],
    morphDuration: 8,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04, width: W, height: H });

  const stars = starField({
    count: 80,
    sizeMin: 0.5,
    sizeMax: 2,
    width: W,
    height: H,
    opacity: 0.3,
    twinkleFraction: 0.3,
  });

  const centralGlow = radialGlow({
    cx: CX,
    cy: CY - 120,
    radius: 520,
    color: theme.glow,
    pulseDuration: 5,
    pulseMin: 0.25,
    pulseMax: 0.6,
    opacity: 0.45,
  });

  // App icon container (rounded square)
  const iconSize = 180;
  const iconX = CX - iconSize / 2;
  const iconY = CY - 260;
  const iconCornerRadius = iconSize * 0.225; // iOS icon corner radius

  const iconBg: SceneElement = {
    id: uid("icon-bg"),
    type: "rect",
    x: iconX,
    y: iconY,
    width: iconSize,
    height: iconSize,
    fill: props.appIcon.startsWith("#") ? props.appIcon : theme.primary,
    cornerRadius: iconCornerRadius,
    opacity: 0,
    keyframes: [
      { time: 0.3, props: { opacity: 0, scale: 0.5, rotation: -10 } },
      { time: 0.9, props: { opacity: 1, scale: 1, rotation: 0 } },
    ],
    easing: easings.bouncy,
  };

  // Subtle gradient overlay on icon
  const iconSheen: SceneElement = {
    id: uid("icon-sheen"),
    type: "gradient",
    x: iconX,
    y: iconY,
    width: iconSize,
    height: iconSize,
    cornerRadius: iconCornerRadius,
    opacity: 0,
    gradient: {
      type: "linear",
      stops: [
        { offset: 0, color: "rgba(255,255,255,0.2)" },
        { offset: 0.5, color: "rgba(255,255,255,0.05)" },
        { offset: 1, color: "rgba(0,0,0,0.1)" },
      ],
      angle: 135,
    },
    keyframes: [
      { time: 0.3, props: { opacity: 0 } },
      { time: 0.9, props: { opacity: 1 } },
    ],
    easing: easings.bouncy,
  };

  // Icon glow behind the icon
  const iconGlow = radialGlow({
    cx: CX,
    cy: iconY + iconSize / 2,
    radius: 200,
    color: theme.glow,
    pulseDuration: 3,
    pulseMin: 0.4,
    pulseMax: 0.8,
    opacity: 0.5,
  });

  // App name
  const appNameElements = characterReveal(props.appName.toUpperCase(), {
    x: CX,
    y: CY - 30,
    fontFamily: fontStacks.display,
    fontSize: fontSizes["5xl"],
    fontWeight: fontWeights.black,
    color: theme.foreground,
    letterSpacing: 1,
    textAlign: "center",
    startTime: 1.2,
    duration: 0.55,
    stagger: 0.05,
    easing: easings.smooth,
    width: W,
  });

  // App description
  const descLines = splitIntoLines(
    props.appDescription || props.tagline,
    22
  );
  const descElements = lineReveal(descLines, {
    x: CX,
    y: CY + 80,
    width: W * 0.85,
    fontFamily: fontStacks.heading,
    fontSize: fontSizes["2xl"],
    fontWeight: fontWeights.regular,
    color: theme.muted,
    lineHeight: 1.45,
    textAlign: "center",
    startTime: 2.2,
    duration: 0.65,
    stagger: 0.2,
    easing: easings.smooth,
  });

  // Category / rating badge
  const ratingBadgeW = 220;
  const ratingBadgeH = 44;
  const ratingBadgeX = CX - ratingBadgeW / 2;
  const ratingBadgeY = CY + descLines.length * fontSizes["2xl"] * 1.5 + 90;

  const ratingBg: SceneElement = {
    id: uid("rating-bg"),
    type: "rect",
    x: ratingBadgeX,
    y: ratingBadgeY,
    width: ratingBadgeW,
    height: ratingBadgeH,
    fill: theme.muted,
    cornerRadius: ratingBadgeH / 2,
    opacity: 0,
    keyframes: [
      { time: 2.8, props: { opacity: 0, scale: 0.9 } },
      { time: 3.3, props: { opacity: 0.3, scale: 1 } },
    ],
    easing: easings.smooth,
  };

  const ratingText: SceneElement = {
    id: uid("rating-text"),
    type: "text",
    x: CX,
    y: ratingBadgeY + ratingBadgeH * 0.22,
    text: "★★★★★  App of the Day",
    fontSize: fontSizes.sm,
    fontFamily: fontStacks.body,
    fontWeight: fontWeights.semibold,
    color: theme.foreground,
    textAlign: "center",
    opacity: 0,
    keyframes: [
      { time: 2.8, props: { opacity: 0 } },
      { time: 3.3, props: { opacity: 1 } },
    ],
    easing: easings.smooth,
  };

  return {
    id: uid("asp-icon"),
    name: "App Icon & Name",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 160,
    },
    transition: { type: sceneTransitions.dissolve.type, duration: sceneTransitions.dissolve.duration },
    elements: [
      ...bg,
      ...noise,
      ...stars,
      ...centralGlow,
      ...iconGlow,
      iconBg,
      iconSheen,
      ...appNameElements,
      ...descElements,
      ratingBg,
      ratingText,
    ],
  };
}

// ─── Screenshot scenes ────────────────────────────────────────────────────────

function buildScreenshotScene(
  props: AppStorePreviewProps,
  screenshotIndex: number,
  caption: string
): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 7;
  const screenshot = props.screenshots[screenshotIndex];

  const bg = animatedGradient({
    angle: 140 + screenshotIndex * 15,
    colors: theme.backgroundGradient,
    duration: sceneDuration,
    angleShift: 8,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04, width: W, height: H });

  const bgGlow = radialGlow({
    cx: CX,
    cy: CY,
    radius: 600,
    color: theme.glow,
    pulseDuration: 5,
    pulseMin: 0.15,
    pulseMax: 0.45,
    opacity: 0.3,
  });

  const particles = particleField({
    count: 30,
    colors: [theme.glow + "55"],
    sizeMin: 1,
    sizeMax: 3,
    width: W,
    height: H,
    opacity: 0.35,
  });

  // Phone mockup centred in upper portion
  const phoneH = H * 0.58;
  const phoneW = Math.round(phoneH * (393 / 852));
  const phoneX = CX - phoneW / 2;
  const phoneY = H * 0.07;

  const phone = iphoneMockup({
    x: phoneX,
    y: phoneY,
    height: phoneH,
    screenContent: screenshot ?? theme.primary,
    startTime: 0.4,
    frameColor: "#1a1a22",
    shadowOpacity: 0.55,
    opacity: 1,
  });

  // Screen number badge (top-right of phone frame)
  const badgeSize = 40;
  const badgeBg: SceneElement = {
    id: uid(`asp-badge-bg-${screenshotIndex}`),
    type: "rect",
    x: phone.screen.x + phone.screen.width - badgeSize / 2,
    y: phone.screen.y + 10,
    width: badgeSize,
    height: badgeSize,
    fill: theme.primary,
    cornerRadius: badgeSize / 2,
    opacity: 0,
    keyframes: [
      { time: 0.8, props: { opacity: 0, scale: 0.7 } },
      { time: 1.2, props: { opacity: 1, scale: 1 } },
    ],
    easing: easings.bouncy,
  };

  const badgeNum: SceneElement = {
    id: uid(`asp-badge-num-${screenshotIndex}`),
    type: "text",
    x: phone.screen.x + phone.screen.width - badgeSize / 2 + badgeSize / 2,
    y: phone.screen.y + 10 + badgeSize * 0.2,
    text: String(screenshotIndex + 1),
    fontSize: fontSizes.base,
    fontFamily: fontStacks.heading,
    fontWeight: fontWeights.bold,
    color: "#ffffff",
    textAlign: "center",
    opacity: 0,
    keyframes: [
      { time: 0.8, props: { opacity: 0 } },
      { time: 1.2, props: { opacity: 1 } },
    ],
    easing: easings.bouncy,
  };

  // Caption below phone
  const captionLines = splitIntoLines(caption, 22);
  const captionY = phoneY + phoneH + 50;

  const captionElements = lineReveal(captionLines, {
    x: CX,
    y: captionY,
    width: W * 0.88,
    fontFamily: fontStacks.display,
    fontSize: fontSizes["3xl"],
    fontWeight: fontWeights.bold,
    color: theme.foreground,
    letterSpacing: -0.5,
    lineHeight: 1.2,
    textAlign: "center",
    startTime: 0.9,
    duration: 0.7,
    stagger: 0.2,
    easing: easings.smooth,
  });

  // Tagline below caption
  const taglineEl = fadeInText(props.tagline, {
    x: CX,
    y: captionY + captionLines.length * fontSizes["3xl"] * 1.3 + 20,
    width: W * 0.82,
    fontFamily: fontStacks.heading,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.regular,
    color: theme.muted,
    textAlign: "center",
    startTime: 1.6,
    duration: 0.55,
    easing: easings.smooth,
  });

  return {
    id: uid(`asp-screenshot-${screenshotIndex}`),
    name: `Screenshot ${screenshotIndex + 1}`,
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 140 + screenshotIndex * 15,
    },
    transition: { type: sceneTransitions.wipeLeft.type, duration: sceneTransitions.wipeLeft.duration },
    elements: [
      ...bg,
      ...noise,
      ...bgGlow,
      ...particles,
      ...phone.elements,
      badgeBg,
      badgeNum,
      ...captionElements,
      ...taglineEl,
    ],
  };
}

// ─── Final scene: Download CTA ────────────────────────────────────────────────

function buildFinalScene(props: AppStorePreviewProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 6;

  const bg = meshGradient({
    points: [
      { x: CX, y: H * 0.2, color: theme.glow },
      { x: W * 0.15, y: H * 0.75, color: theme.primary },
      { x: W * 0.85, y: H * 0.65, color: theme.accent },
    ],
    morphDuration: 6,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04, width: W, height: H });
  const glow = radialGlow({
    cx: CX,
    cy: CY - 80,
    radius: 580,
    color: theme.glow,
    pulseDuration: 4,
    pulseMin: 0.3,
    pulseMax: 0.65,
    opacity: 0.45,
  });

  // App icon
  const iconSize = 140;
  const iconX = CX - iconSize / 2;
  const iconY = CY - 340;

  const iconBg: SceneElement = {
    id: uid("final-icon"),
    type: "rect",
    x: iconX,
    y: iconY,
    width: iconSize,
    height: iconSize,
    fill: props.appIcon.startsWith("#") ? props.appIcon : theme.primary,
    cornerRadius: iconSize * 0.225,
    opacity: 0,
    keyframes: [
      { time: 0.3, props: { opacity: 0, scale: 0.6 } },
      { time: 0.85, props: { opacity: 1, scale: 1 } },
    ],
    easing: easings.bouncy,
  };

  const appNameElements = characterReveal(props.appName.toUpperCase(), {
    x: CX,
    y: CY - 155,
    fontFamily: fontStacks.display,
    fontSize: fontSizes["4xl"],
    fontWeight: fontWeights.black,
    color: theme.foreground,
    letterSpacing: 1,
    textAlign: "center",
    startTime: 1.0,
    duration: 0.5,
    stagger: 0.04,
    easing: easings.smooth,
    width: W,
  });

  // Rating stars
  const starsText = fadeInText("★★★★★", {
    x: CX,
    y: CY - 65,
    fontFamily: fontStacks.body,
    fontSize: fontSizes["2xl"],
    fontWeight: fontWeights.regular,
    color: "#fbbf24", // amber
    textAlign: "center",
    startTime: 1.8,
    duration: 0.5,
    easing: easings.smooth,
  });

  const ratingLabel = fadeInText("4.9 · 12K Ratings", {
    x: CX,
    y: CY - 20,
    fontFamily: fontStacks.body,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.regular,
    color: theme.muted,
    textAlign: "center",
    startTime: 2.1,
    duration: 0.5,
    easing: easings.smooth,
  });

  // Download button
  const dlBtnW = W * 0.75;
  const dlBtnH = 84;
  const dlBtnX = CX - dlBtnW / 2;
  const dlBtnY = CY + 55;

  const dlBtn: SceneElement = {
    id: uid("dl-btn"),
    type: "rect",
    x: dlBtnX,
    y: dlBtnY,
    width: dlBtnW,
    height: dlBtnH,
    fill: theme.primary,
    cornerRadius: dlBtnH / 2,
    opacity: 0,
    keyframes: [
      { time: 2.5, props: { opacity: 0, scale: 0.88 } },
      { time: 3.1, props: { opacity: 1, scale: 1 } },
    ],
    easing: easings.bouncy,
  };

  const dlBtnText: SceneElement = {
    id: uid("dl-btn-text"),
    type: "text",
    x: CX,
    y: dlBtnY + dlBtnH * 0.28,
    text: "Download on the App Store",
    fontSize: fontSizes["2xl"],
    fontFamily: fontStacks.heading,
    fontWeight: fontWeights.bold,
    color: "#ffffff",
    textAlign: "center",
    opacity: 0,
    keyframes: [
      { time: 2.5, props: { opacity: 0 } },
      { time: 3.1, props: { opacity: 1 } },
    ],
    easing: easings.bouncy,
  };

  const freeLabel = fadeInText("Free · In-App Purchases Available", {
    x: CX,
    y: dlBtnY + dlBtnH + 30,
    fontFamily: fontStacks.body,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.regular,
    color: theme.muted,
    textAlign: "center",
    startTime: 3.5,
    duration: 0.5,
    easing: easings.smooth,
  });

  return {
    id: uid("asp-cta"),
    name: "Download CTA",
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
      ...glow,
      iconBg,
      ...appNameElements,
      ...starsText,
      ...ratingLabel,
      dlBtn,
      dlBtnText,
      ...freeLabel,
    ],
  };
}

// ─── Screenshot captions (generated from feature data) ────────────────────────

const SCREENSHOT_CAPTIONS = [
  "Beautiful by design.",
  "Built for speed.",
  "Made for you.",
];

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateAppStorePreview(props: AppStorePreviewProps): Scene[] {
  const scenes: Scene[] = [buildScene1(props)];

  const screenshotCount = Math.min(props.screenshots.length, 3);
  for (let i = 0; i < screenshotCount; i++) {
    const caption = SCREENSHOT_CAPTIONS[i] ?? `Feature ${i + 1}`;
    scenes.push(buildScreenshotScene(props, i, caption));
  }

  scenes.push(buildFinalScene(props));
  return scenes;
}
