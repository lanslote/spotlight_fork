/**
 * Feature Announcement Template
 *
 * A focused, high-impact video for announcing a single new feature.
 * Duration: 15–45 seconds across 4 acts.
 *
 * Act 1 (0–5s)   : Version badge + "Introducing" + feature title (reveal)
 * Act 2 (5–13s)  : Feature description with animated highlight callouts
 * Act 3 (13–21s) : Before/After showcase or device demo
 * Act 4 (21–28s) : Highlights summary + CTA
 */

import type { Scene, SceneElement } from "./types";
import type { FeatureAnnounceProps } from "./schemas";
import { getTheme } from "./tokens/colors";
import { fontStacks, fontSizes, fontWeights } from "./tokens/typography";
import { easings, sceneTransitions } from "./tokens/animation";
import { characterReveal, lineReveal, fadeInText, wordReveal } from "./primitives/text-reveal";
import { animatedGradient, radialGlow, noiseTexture, meshGradient } from "./primitives/gradient-bg";
import { browserMockup, iphoneMockup } from "./primitives/device-mockup";
import { particleField } from "./primitives/particle-field";

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

// ─── Scene 1: Version + Title ─────────────────────────────────────────────────

function buildScene1(props: FeatureAnnounceProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 5;

  const bg = animatedGradient({
    angle: 135,
    colors: theme.backgroundGradient,
    duration: sceneDuration,
    angleShift: 10,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04 });

  const centralGlow = radialGlow({
    cx: CX,
    cy: CY - 60,
    radius: 380,
    color: theme.glow,
    pulseDuration: 5,
    pulseMin: 0.2,
    pulseMax: 0.5,
    opacity: 0.45,
  });

  // Version badge
  const badgeW = 140;
  const badgeH = 38;
  const badgeX = CX - badgeW / 2;
  const badgeY = CY - 175;

  const versionBadgeBg: SceneElement = {
    id: uid("version-badge-bg"),
    type: "rect",
    x: badgeX,
    y: badgeY,
    width: badgeW,
    height: badgeH,
    fill: theme.primary,
    cornerRadius: badgeH / 2,
    opacity: 0,
    keyframes: [
      { time: 0.2, props: { opacity: 0, scale: 0.8 } },
      { time: 0.7, props: { opacity: 1, scale: 1 } },
    ],
    easing: easings.bouncy,
  };

  const versionBadgeText: SceneElement = {
    id: uid("version-badge-text"),
    type: "text",
    x: CX,
    y: badgeY + badgeH * 0.22,
    text: `v${props.version}`,
    fontSize: fontSizes.sm,
    fontFamily: fontStacks.mono,
    fontWeight: fontWeights.bold,
    color: "#ffffff",
    letterSpacing: 1,
    textAlign: "center",
    opacity: 0,
    keyframes: [
      { time: 0.2, props: { opacity: 0 } },
      { time: 0.7, props: { opacity: 1 } },
    ],
    easing: easings.bouncy,
  };

  // "Introducing" text
  const introducingText = fadeInText("Introducing", {
    x: CX,
    y: CY - 120,
    fontFamily: fontStacks.body,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.medium,
    color: theme.secondary,
    letterSpacing: fontSizes.xl * 0.06,
    textAlign: "center",
    startTime: 0.8,
    duration: 0.5,
    easing: easings.smooth,
  });

  // Feature title — large, dramatic word reveal
  const titleWords = wordReveal(props.featureTitle, {
    x: CX - (props.featureTitle.length * fontSizes["5xl"] * 0.28),
    y: CY - 60,
    fontFamily: fontStacks.display,
    fontSize: fontSizes["5xl"],
    fontWeight: fontWeights.black,
    color: theme.foreground,
    letterSpacing: -1,
    textAlign: "left",
    startTime: 1.2,
    duration: 0.65,
    stagger: 0.1,
    easing: easings.smooth,
  });

  // Underline beneath feature title
  const titleUnderline: SceneElement = {
    id: uid("title-underline"),
    type: "rect",
    x: CX - 200,
    y: CY + 55,
    width: 0,
    height: 4,
    fill: theme.primary,
    cornerRadius: 2,
    opacity: 0,
    keyframes: [
      { time: 2.0, props: { opacity: 0, width: 0, x: CX } },
      { time: 2.8, props: { opacity: 1, width: 400, x: CX - 200 } },
    ],
    easing: easings.smooth,
  };

  // Product name attribution
  const attribution = fadeInText(`${props.productName} · New`, {
    x: CX,
    y: CY + 90,
    fontFamily: fontStacks.mono,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.regular,
    color: theme.muted,
    textAlign: "center",
    startTime: 2.5,
    duration: 0.6,
    easing: easings.smooth,
  });

  return {
    id: uid("fa-scene-intro"),
    name: "Version & Title",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 135,
    },
    transition: { type: sceneTransitions.dissolve.type, duration: sceneTransitions.dissolve.duration },
    elements: [
      ...bg,
      ...noise,
      ...centralGlow,
      versionBadgeBg,
      versionBadgeText,
      ...introducingText,
      ...titleWords,
      titleUnderline,
      ...attribution,
    ],
  };
}

// ─── Scene 2: Feature description ────────────────────────────────────────────

function buildScene2(props: FeatureAnnounceProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 8;

  const bg = animatedGradient({
    angle: 145,
    colors: theme.backgroundGradient,
    duration: sceneDuration,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04 });

  const leftGlow = radialGlow({
    cx: W * 0.15,
    cy: CY,
    radius: 320,
    color: theme.glow,
    pulseDuration: 4,
    pulseMin: 0.15,
    pulseMax: 0.4,
    opacity: 0.3,
  });

  // Section label
  const sectionLabel = fadeInText("WHAT'S NEW", {
    x: W * 0.08,
    y: H * 0.15,
    fontFamily: fontStacks.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: theme.primary,
    letterSpacing: fontSizes.xs * 0.15,
    textAlign: "left",
    startTime: 0.3,
    duration: 0.5,
    easing: easings.smooth,
  });

  // Feature title (smaller, as section header)
  const featureTitle = lineReveal([props.featureTitle], {
    x: W * 0.08,
    y: H * 0.23,
    width: W * 0.45,
    fontFamily: fontStacks.heading,
    fontSize: fontSizes["3xl"],
    fontWeight: fontWeights.bold,
    color: theme.foreground,
    letterSpacing: -0.5,
    textAlign: "left",
    startTime: 0.5,
    duration: 0.7,
    easing: easings.smooth,
  });

  // Feature description
  const descLines = splitIntoLines(props.featureDescription, 42);
  const descElements = lineReveal(descLines, {
    x: W * 0.08,
    y: H * 0.39,
    width: W * 0.44,
    fontFamily: fontStacks.body,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.regular,
    color: theme.muted,
    lineHeight: 1.6,
    textAlign: "left",
    startTime: 1.0,
    duration: 0.65,
    stagger: 0.2,
    easing: easings.smooth,
  });

  // Highlight pills
  const highlights = props.highlights.slice(0, 3);
  const highlightElements: SceneElement[] = highlights.flatMap((hl, i) => {
    const pillY = H * 0.68 + i * 52;
    const pillW = hl.length * 10 + 60;
    const pillBg: SceneElement = {
      id: uid(`hl-pill-${i}`),
      type: "rect",
      x: W * 0.08,
      y: pillY,
      width: pillW,
      height: 40,
      fill: theme.primary,
      cornerRadius: 20,
      opacity: 0,
      keyframes: [
        { time: 1.8 + i * 0.2, props: { opacity: 0, translateX: -20 } },
        { time: 2.3 + i * 0.2, props: { opacity: 0.15, translateX: 0 } },
      ],
      easing: easings.smooth,
    };

    const checkmark: SceneElement = {
      id: uid(`hl-check-${i}`),
      type: "text",
      x: W * 0.08 + 14,
      y: pillY + 10,
      text: "✓",
      fontSize: fontSizes.base,
      fontFamily: fontStacks.body,
      fontWeight: fontWeights.bold,
      color: theme.primary,
      opacity: 0,
      keyframes: [
        { time: 1.8 + i * 0.2, props: { opacity: 0 } },
        { time: 2.3 + i * 0.2, props: { opacity: 1 } },
      ],
      easing: easings.smooth,
    };

    const hlText: SceneElement = {
      id: uid(`hl-text-${i}`),
      type: "text",
      x: W * 0.08 + 36,
      y: pillY + 11,
      text: hl,
      fontSize: fontSizes.base,
      fontFamily: fontStacks.body,
      fontWeight: fontWeights.medium,
      color: theme.foreground,
      opacity: 0,
      keyframes: [
        { time: 1.8 + i * 0.2, props: { opacity: 0, translateX: -10 } },
        { time: 2.3 + i * 0.2, props: { opacity: 1, translateX: 0 } },
      ],
      easing: easings.smooth,
    };

    return [pillBg, checkmark, hlText];
  });

  // Right side decorative large text (blurred, atmospheric)
  const bigBg: SceneElement = {
    id: uid("big-bg-text"),
    type: "text",
    x: W * 0.55,
    y: CY - 120,
    text: props.featureTitle.split(" ")[0],
    fontSize: 200,
    fontFamily: fontStacks.display,
    fontWeight: fontWeights.black,
    color: theme.primary,
    opacity: 0,
    keyframes: [
      { time: 0, props: { opacity: 0 } },
      { time: 0.5, props: { opacity: 0.05 } },
    ],
    easing: easings.gentle,
  };

  return {
    id: uid("fa-scene-desc"),
    name: "Feature Description",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 145,
    },
    transition: { type: sceneTransitions.wipeLeft.type, duration: sceneTransitions.wipeLeft.duration },
    elements: [
      ...bg,
      ...noise,
      ...leftGlow,
      bigBg,
      ...sectionLabel,
      ...featureTitle,
      ...descElements,
      ...highlightElements,
    ],
  };
}

// ─── Scene 3: Before/After or Demo ───────────────────────────────────────────

function buildScene3(props: FeatureAnnounceProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 8;

  const bg = meshGradient({
    points: [
      { x: W * 0.3, y: H * 0.3, color: theme.glow },
      { x: W * 0.7, y: H * 0.7, color: theme.primary },
    ],
    morphDuration: sceneDuration,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04 });

  const particles = particleField({
    count: 40,
    colors: [theme.glow + "66"],
    sizeMin: 1,
    sizeMax: 3,
    width: W,
    height: H,
    opacity: 0.4,
  });

  let contentElements: SceneElement[] = [];

  if (props.beforeAfter) {
    // Before/After layout — side-by-side browser mockups
    const mockupH = H * 0.58;

    // "Before" browser
    const beforeBrowser = browserMockup({
      x: W * 0.06,
      y: CY - mockupH / 2 + 20,
      height: mockupH,
      width: W * 0.38,
      screenContent: theme.muted,
      startTime: 0.5,
      theme: props.theme === "frost" ? "light" : "dark",
      url: "before.app",
      opacity: 1,
    });

    const beforeLabel: SceneElement = {
      id: uid("before-label"),
      type: "text",
      x: W * 0.06 + (W * 0.38) / 2,
      y: CY - mockupH / 2 - 40,
      text: props.beforeAfter.beforeLabel,
      fontSize: fontSizes.xl,
      fontFamily: fontStacks.heading,
      fontWeight: fontWeights.semibold,
      color: theme.muted,
      textAlign: "center",
      opacity: 0,
      keyframes: [
        { time: 0.5, props: { opacity: 0, translateY: 10 } },
        { time: 1.0, props: { opacity: 1, translateY: 0 } },
      ],
      easing: easings.smooth,
    };

    // "After" browser
    const afterBrowser = browserMockup({
      x: W * 0.56,
      y: CY - mockupH / 2 + 20,
      height: mockupH,
      width: W * 0.38,
      screenContent: theme.primary,
      startTime: 0.9,
      theme: props.theme === "frost" ? "light" : "dark",
      url: `${props.productName.toLowerCase().replace(/\s/g, "")}.app`,
      opacity: 1,
    });

    const afterLabel: SceneElement = {
      id: uid("after-label"),
      type: "text",
      x: W * 0.56 + (W * 0.38) / 2,
      y: CY - mockupH / 2 - 40,
      text: props.beforeAfter.afterLabel,
      fontSize: fontSizes.xl,
      fontFamily: fontStacks.heading,
      fontWeight: fontWeights.semibold,
      color: theme.foreground,
      textAlign: "center",
      opacity: 0,
      keyframes: [
        { time: 0.9, props: { opacity: 0, translateY: 10 } },
        { time: 1.4, props: { opacity: 1, translateY: 0 } },
      ],
      easing: easings.smooth,
    };

    // Arrow between the two
    const arrowBg: SceneElement = {
      id: uid("ba-arrow-bg"),
      type: "rect",
      x: CX - 28,
      y: CY - 20,
      width: 56,
      height: 40,
      fill: theme.primary,
      cornerRadius: 20,
      opacity: 0,
      keyframes: [
        { time: 1.2, props: { opacity: 0, scale: 0.7 } },
        { time: 1.7, props: { opacity: 1, scale: 1 } },
      ],
      easing: easings.bouncy,
    };

    const arrowText: SceneElement = {
      id: uid("ba-arrow"),
      type: "text",
      x: CX - 8,
      y: CY - 7,
      text: "→",
      fontSize: fontSizes["2xl"],
      fontFamily: fontStacks.body,
      fontWeight: fontWeights.bold,
      color: "#ffffff",
      opacity: 0,
      keyframes: [
        { time: 1.2, props: { opacity: 0 } },
        { time: 1.7, props: { opacity: 1 } },
      ],
      easing: easings.bouncy,
    };

    contentElements = [
      ...beforeBrowser.elements,
      beforeLabel,
      ...afterBrowser.elements,
      afterLabel,
      arrowBg,
      arrowText,
    ];
  } else {
    // Generic device demo — centred phone mockup
    const phoneH = H * 0.75;
    const phone = iphoneMockup({
      x: CX - Math.round(phoneH * (393 / 852)) / 2,
      y: CY - phoneH / 2,
      height: phoneH,
      screenContent: theme.primary,
      startTime: 0.5,
      frameColor: "#1a1a22",
      opacity: 1,
    });

    const demoTitle = fadeInText(`See ${props.featureTitle} in action`, {
      x: CX,
      y: H * 0.1,
      width: W * 0.6,
      fontFamily: fontStacks.heading,
      fontSize: fontSizes["2xl"],
      fontWeight: fontWeights.bold,
      color: theme.foreground,
      textAlign: "center",
      startTime: 0.5,
      duration: 0.6,
      easing: easings.smooth,
    });

    contentElements = [...phone.elements, ...demoTitle];
  }

  const sceneTitle = fadeInText(props.featureTitle, {
    x: CX,
    y: H * 0.88,
    fontFamily: fontStacks.mono,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: theme.muted,
    textAlign: "center",
    startTime: 2.0,
    duration: 0.5,
    easing: easings.smooth,
  });

  return {
    id: uid("fa-scene-demo"),
    name: "Demo / Before & After",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 150,
    },
    transition: { type: sceneTransitions.zoomIn.type, duration: sceneTransitions.zoomIn.duration },
    elements: [...bg, ...noise, ...particles, ...contentElements, ...sceneTitle],
  };
}

// ─── Scene 4: Summary + CTA ───────────────────────────────────────────────────

function buildScene4(props: FeatureAnnounceProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 7;

  const bg = animatedGradient({
    angle: 155,
    colors: theme.backgroundGradient,
    duration: sceneDuration,
    angleShift: 12,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04 });
  const glow = radialGlow({
    cx: CX,
    cy: CY - 50,
    radius: 450,
    color: theme.glow,
    pulseDuration: 4,
    pulseMin: 0.2,
    pulseMax: 0.5,
    opacity: 0.4,
  });

  const summaryLabel = fadeInText("SUMMARY", {
    x: CX,
    y: H * 0.14,
    fontFamily: fontStacks.body,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: theme.primary,
    letterSpacing: fontSizes.xs * 0.2,
    textAlign: "center",
    startTime: 0.3,
    duration: 0.5,
    easing: easings.smooth,
  });

  const summaryTitle = lineReveal([props.featureTitle], {
    x: CX,
    y: CY - 130,
    width: W * 0.65,
    fontFamily: fontStacks.display,
    fontSize: fontSizes["4xl"],
    fontWeight: fontWeights.black,
    color: theme.foreground,
    letterSpacing: -1,
    textAlign: "center",
    startTime: 0.5,
    duration: 0.7,
    easing: easings.smooth,
  });

  // Highlight pills in a row
  const activeHighlights = props.highlights.slice(0, 4);
  const pillElements: SceneElement[] = activeHighlights.flatMap((hl, i) => {
    const totalW = activeHighlights.reduce((s, h) => s + h.length * 9 + 40, 0) + (activeHighlights.length - 1) * 16;
    let xStart = CX - totalW / 2;
    for (let j = 0; j < i; j++) {
      xStart += activeHighlights[j].length * 9 + 40 + 16;
    }
    const pillW = hl.length * 9 + 40;
    const pillH = 36;
    const pillY = CY - 30;

    const bg2: SceneElement = {
      id: uid(`summary-pill-bg-${i}`),
      type: "rect",
      x: xStart,
      y: pillY,
      width: pillW,
      height: pillH,
      fill: theme.primary,
      cornerRadius: pillH / 2,
      opacity: 0,
      keyframes: [
        { time: 1.2 + i * 0.15, props: { opacity: 0, scale: 0.85 } },
        { time: 1.65 + i * 0.15, props: { opacity: 0.18, scale: 1 } },
      ],
      easing: easings.bouncy,
    };

    const txt: SceneElement = {
      id: uid(`summary-pill-txt-${i}`),
      type: "text",
      x: xStart + 16,
      y: pillY + 10,
      text: hl,
      fontSize: fontSizes.sm,
      fontFamily: fontStacks.body,
      fontWeight: fontWeights.medium,
      color: theme.foreground,
      opacity: 0,
      keyframes: [
        { time: 1.2 + i * 0.15, props: { opacity: 0 } },
        { time: 1.65 + i * 0.15, props: { opacity: 1 } },
      ],
      easing: easings.bouncy,
    };

    return [bg2, txt];
  });

  // Version badge
  const versionText = fadeInText(`Available in v${props.version}`, {
    x: CX,
    y: CY + 55,
    fontFamily: fontStacks.mono,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.regular,
    color: theme.secondary,
    textAlign: "center",
    startTime: 2.0,
    duration: 0.5,
    easing: easings.smooth,
  });

  // CTA
  const ctaBtnW = 280;
  const ctaBtnH = 56;
  const ctaBtnX = CX - ctaBtnW / 2;
  const ctaBtnY = CY + 105;

  const ctaBtn: SceneElement = {
    id: uid("fa-cta-btn"),
    type: "rect",
    x: ctaBtnX,
    y: ctaBtnY,
    width: ctaBtnW,
    height: ctaBtnH,
    fill: theme.primary,
    cornerRadius: ctaBtnH / 2,
    opacity: 0,
    keyframes: [
      { time: 2.5, props: { opacity: 0, scale: 0.9 } },
      { time: 3.0, props: { opacity: 1, scale: 1 } },
    ],
    easing: easings.bouncy,
  };

  const ctaBtnTxt: SceneElement = {
    id: uid("fa-cta-btn-txt"),
    type: "text",
    x: CX,
    y: ctaBtnY + ctaBtnH * 0.27,
    text: "Update now →",
    fontSize: fontSizes.lg,
    fontFamily: fontStacks.heading,
    fontWeight: fontWeights.semibold,
    color: "#ffffff",
    textAlign: "center",
    opacity: 0,
    keyframes: [
      { time: 2.5, props: { opacity: 0 } },
      { time: 3.0, props: { opacity: 1 } },
    ],
    easing: easings.bouncy,
  };

  return {
    id: uid("fa-scene-summary"),
    name: "Summary & CTA",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 155,
    },
    transition: { type: sceneTransitions.crossfade.type, duration: sceneTransitions.crossfade.duration },
    elements: [
      ...bg,
      ...noise,
      ...glow,
      ...summaryLabel,
      ...summaryTitle,
      ...pillElements,
      ...versionText,
      ctaBtn,
      ctaBtnTxt,
    ],
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateFeatureAnnounce(props: FeatureAnnounceProps): Scene[] {
  return [
    buildScene1(props),
    buildScene2(props),
    buildScene3(props),
    buildScene4(props),
  ];
}
