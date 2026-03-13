/**
 * Changelog / Update Video Template
 *
 * A clean, editorial changelog that celebrates each change with its own moment.
 * Duration: 15–45s depending on the number of changes.
 *
 * Act 1       (0–4s)  : Version number + date
 * Acts 2…N+1  (4–Ns)  : One scene per change item (3s each)
 * Final act           : Summary + "Update now" CTA
 */

import type { Scene, SceneElement } from "./types";
import type { ChangelogProps, ChangeItem } from "./schemas";
import { getTheme } from "./tokens/colors";
import { fontStacks, fontSizes, fontWeights } from "./tokens/typography";
import { easings, sceneTransitions } from "./tokens/animation";
import { lineReveal, fadeInText, characterReveal } from "./primitives/text-reveal";
import { animatedGradient, radialGlow, noiseTexture, meshGradient } from "./primitives/gradient-bg";
import { particleField } from "./primitives/particle-field";

const W = 1920;
const H = 1080;
const CX = W / 2;
const CY = H / 2;

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Change type colors ────────────────────────────────────────────────────────

interface BadgeStyle {
  bg: string;
  label: string;
  icon: string;
}

function getBadgeStyle(type: ChangeItem["type"], primaryColor: string): BadgeStyle {
  switch (type) {
    case "added":
      return { bg: "#10b981", label: "Added", icon: "+" };
    case "improved":
      return { bg: primaryColor, label: "Improved", icon: "↑" };
    case "fixed":
      return { bg: "#f43f5e", label: "Fixed", icon: "✓" };
  }
}

// ─── Scene 1: Version + Date ──────────────────────────────────────────────────

function buildScene1(props: ChangelogProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 4;

  const bg = meshGradient({
    points: [
      { x: W * 0.25, y: H * 0.25, color: theme.glow },
      { x: W * 0.75, y: H * 0.65, color: theme.primary },
    ],
    morphDuration: 8,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04, width: W, height: H });

  const centralGlow = radialGlow({
    cx: CX,
    cy: CY - 30,
    radius: 400,
    color: theme.glow,
    pulseDuration: 4,
    pulseMin: 0.2,
    pulseMax: 0.55,
    opacity: 0.4,
  });

  // Product name
  const productName = fadeInText(props.productName, {
    x: CX,
    y: CY - 160,
    fontFamily: fontStacks.body,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.medium,
    color: theme.secondary,
    letterSpacing: fontSizes.xl * 0.08,
    textAlign: "center",
    startTime: 0.3,
    duration: 0.6,
    easing: easings.smooth,
  });

  // "What's new in" label
  const newLabel = fadeInText("What's new in", {
    x: CX,
    y: CY - 110,
    fontFamily: fontStacks.heading,
    fontSize: fontSizes["2xl"],
    fontWeight: fontWeights.regular,
    color: theme.muted,
    textAlign: "center",
    startTime: 0.5,
    duration: 0.5,
    easing: easings.smooth,
  });

  // Version — dramatic, large
  const versionText = characterReveal(`v${props.version}`, {
    x: CX,
    y: CY - 30,
    fontFamily: fontStacks.display,
    fontSize: fontSizes["6xl"],
    fontWeight: fontWeights.black,
    color: theme.foreground,
    letterSpacing: -1,
    textAlign: "center",
    startTime: 0.9,
    duration: 0.55,
    stagger: 0.06,
    easing: easings.smooth,
    width: W,
  });

  // Date
  // Format: "March 12, 2026" from "2026-03-12"
  const dateParts = props.date.split("-");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const formattedDate = `${months[parseInt(dateParts[1]) - 1]} ${parseInt(dateParts[2])}, ${dateParts[0]}`;

  const dateText = fadeInText(formattedDate, {
    x: CX,
    y: CY + 85,
    fontFamily: fontStacks.mono,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.regular,
    color: theme.muted,
    textAlign: "center",
    startTime: 2.0,
    duration: 0.5,
    easing: easings.smooth,
  });

  // Thin separator line
  const separator: SceneElement = {
    id: uid("cl-sep"),
    type: "rect",
    x: CX - 80,
    y: CY + 130,
    width: 0,
    height: 1,
    fill: theme.muted,
    cornerRadius: 1,
    opacity: 0,
    keyframes: [
      { time: 2.2, props: { opacity: 0, width: 0, x: CX } },
      { time: 2.8, props: { opacity: 0.4, width: 160, x: CX - 80 } },
    ],
    easing: easings.smooth,
  };

  // Change count summary
  const changeCount = fadeInText(
    `${props.changes.length} ${props.changes.length === 1 ? "change" : "changes"}`,
    {
      x: CX,
      y: CY + 155,
      fontFamily: fontStacks.body,
      fontSize: fontSizes.base,
      fontWeight: fontWeights.regular,
      color: theme.muted,
      textAlign: "center",
      startTime: 2.6,
      duration: 0.5,
      easing: easings.smooth,
    }
  );

  return {
    id: uid("cl-version"),
    name: "Version & Date",
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 145,
    },
    transition: { type: sceneTransitions.dissolve.type, duration: sceneTransitions.dissolve.duration },
    elements: [
      ...bg,
      ...noise,
      ...centralGlow,
      ...productName,
      ...newLabel,
      ...versionText,
      ...dateText,
      separator,
      ...changeCount,
    ],
  };
}

// ─── Change item scenes ────────────────────────────────────────────────────────

function buildChangeScene(
  props: ChangelogProps,
  change: ChangeItem,
  index: number,
  total: number
): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 3.5;
  const badge = getBadgeStyle(change.type, theme.primary);

  const bg = animatedGradient({
    angle: 130 + index * 8,
    colors: theme.backgroundGradient,
    duration: sceneDuration,
    angleShift: 6,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04, width: W, height: H });

  // Left accent bar that extends top-to-bottom
  const accentBar: SceneElement = {
    id: uid(`cl-accent-bar-${index}`),
    type: "rect",
    x: W * 0.08 - 6,
    y: 0,
    width: 4,
    height: 0,
    fill: badge.bg,
    cornerRadius: 2,
    opacity: 0,
    keyframes: [
      { time: 0.2, props: { opacity: 0, height: 0 } },
      { time: 0.7, props: { opacity: 0.8, height: H } },
    ],
    easing: easings.smooth,
  };

  // Progress indicator: "change N of M"
  const progressText = fadeInText(`${index + 1} / ${total}`, {
    x: W * 0.92,
    y: H * 0.06,
    fontFamily: fontStacks.mono,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.regular,
    color: theme.muted,
    textAlign: "right",
    startTime: 0.3,
    duration: 0.4,
    easing: easings.smooth,
  });

  // Type badge (Added / Improved / Fixed)
  const badgeW = badge.label.length * 11 + 48;
  const badgeH = 42;
  const badgeX = W * 0.08;
  const badgeY = CY - 95;

  const badgeBg: SceneElement = {
    id: uid(`cl-badge-bg-${index}`),
    type: "rect",
    x: badgeX,
    y: badgeY,
    width: badgeW,
    height: badgeH,
    fill: badge.bg,
    cornerRadius: badgeH / 2,
    opacity: 0,
    keyframes: [
      { time: 0.3, props: { opacity: 0, scale: 0.8 } },
      { time: 0.7, props: { opacity: 1, scale: 1 } },
    ],
    easing: easings.bouncy,
  };

  const badgeIconEl: SceneElement = {
    id: uid(`cl-badge-icon-${index}`),
    type: "text",
    x: badgeX + 16,
    y: badgeY + badgeH * 0.22,
    text: badge.icon,
    fontSize: fontSizes.base,
    fontFamily: fontStacks.body,
    fontWeight: fontWeights.bold,
    color: "#ffffff",
    opacity: 0,
    keyframes: [
      { time: 0.3, props: { opacity: 0 } },
      { time: 0.7, props: { opacity: 1 } },
    ],
    easing: easings.bouncy,
  };

  const badgeLabelEl: SceneElement = {
    id: uid(`cl-badge-label-${index}`),
    type: "text",
    x: badgeX + 36,
    y: badgeY + badgeH * 0.22,
    text: badge.label,
    fontSize: fontSizes.base,
    fontFamily: fontStacks.body,
    fontWeight: fontWeights.bold,
    color: "#ffffff",
    opacity: 0,
    keyframes: [
      { time: 0.3, props: { opacity: 0 } },
      { time: 0.7, props: { opacity: 1 } },
    ],
    easing: easings.bouncy,
  };

  // Change description — the main event
  // Wrap at ~45 chars for comfortable reading at this size
  const changeLines = splitIntoLines(change.text, 45);
  const cFontSize = changeLines.length === 1 ? fontSizes["4xl"] : fontSizes["3xl"];

  const changeTextElements = lineReveal(changeLines, {
    x: W * 0.08,
    y: CY - 20,
    width: W * 0.82,
    fontFamily: fontStacks.display,
    fontSize: cFontSize,
    fontWeight: fontWeights.regular,
    color: theme.foreground,
    letterSpacing: -0.5,
    lineHeight: 1.25,
    textAlign: "left",
    startTime: 0.75,
    duration: 0.7,
    stagger: 0.18,
    easing: easings.smooth,
  });

  // Version attribution at bottom right
  const versionAttr = fadeInText(`v${props.version}`, {
    x: W * 0.92,
    y: H * 0.92,
    fontFamily: fontStacks.mono,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    color: theme.muted,
    textAlign: "right",
    startTime: 1.5,
    duration: 0.4,
    easing: easings.smooth,
  });

  // Decorative large type number in background
  const bigNum: SceneElement = {
    id: uid(`cl-bignum-${index}`),
    type: "text",
    x: W * 0.65,
    y: CY - 160,
    text: String(index + 1).padStart(2, "0"),
    fontSize: 280,
    fontFamily: fontStacks.display,
    fontWeight: fontWeights.black,
    color: badge.bg,
    opacity: 0,
    keyframes: [
      { time: 0, props: { opacity: 0 } },
      { time: 0.4, props: { opacity: 0.05 } },
    ],
    easing: easings.gentle,
  };

  return {
    id: uid(`cl-change-${index}`),
    name: `${badge.label}: ${change.text.slice(0, 30)}…`,
    duration: sceneDuration,
    background: {
      type: "linear",
      stops: theme.backgroundGradient,
      angle: 130 + index * 8,
    },
    transition: { type: sceneTransitions.wipeLeft.type, duration: 500 },
    elements: [
      ...bg,
      ...noise,
      accentBar,
      bigNum,
      ...progressText,
      badgeBg,
      badgeIconEl,
      badgeLabelEl,
      ...changeTextElements,
      ...versionAttr,
    ],
  };
}

// ─── Final scene: Summary + CTA ───────────────────────────────────────────────

function buildFinalScene(props: ChangelogProps): Scene {
  const theme = getTheme(props.theme);
  const sceneDuration = 6;

  const bg = meshGradient({
    points: [
      { x: CX, y: H * 0.2, color: theme.glow },
      { x: W * 0.2, y: H * 0.8, color: theme.primary },
      { x: W * 0.8, y: H * 0.6, color: theme.accent },
    ],
    morphDuration: 6,
    width: W,
    height: H,
    opacity: 1,
  });
  const noise = noiseTexture({ opacity: 0.04 });

  const glow = radialGlow({
    cx: CX,
    cy: CY - 50,
    radius: 480,
    color: theme.glow,
    pulseDuration: 4,
    pulseMin: 0.25,
    pulseMax: 0.6,
    opacity: 0.4,
  });

  const particles = particleField({
    count: 45,
    colors: [theme.glow + "66"],
    sizeMin: 1,
    sizeMax: 3,
    width: W,
    height: H,
    opacity: 0.4,
  });

  const versionLabel = fadeInText(`v${props.version}`, {
    x: CX,
    y: CY - 180,
    fontFamily: fontStacks.mono,
    fontSize: fontSizes["2xl"],
    fontWeight: fontWeights.bold,
    color: theme.primary,
    textAlign: "center",
    startTime: 0.3,
    duration: 0.6,
    easing: easings.smooth,
  });

  const summaryTitle = lineReveal(["That's everything", "in this release."], {
    x: CX,
    y: CY - 100,
    width: W * 0.65,
    fontFamily: fontStacks.display,
    fontSize: fontSizes["5xl"],
    fontWeight: fontWeights.black,
    color: theme.foreground,
    letterSpacing: -1.5,
    lineHeight: 1.1,
    textAlign: "center",
    startTime: 0.7,
    duration: 0.75,
    stagger: 0.25,
    easing: easings.smooth,
  });

  // Change type summary row
  const addedCount = props.changes.filter(c => c.type === "added").length;
  const improvedCount = props.changes.filter(c => c.type === "improved").length;
  const fixedCount = props.changes.filter(c => c.type === "fixed").length;

  const summaryItems: { label: string; count: number; color: string }[] = [
    { label: "Added", count: addedCount, color: "#10b981" },
    { label: "Improved", count: improvedCount, color: theme.primary },
    { label: "Fixed", count: fixedCount, color: "#f43f5e" },
  ].filter(item => item.count > 0);

  const summaryWidth = summaryItems.length * 180;
  const summaryStartX = CX - summaryWidth / 2;

  const summaryElements: SceneElement[] = summaryItems.flatMap((item, i) => {
    const itemX = summaryStartX + i * 180;
    const countEl: SceneElement = {
      id: uid(`summary-count-${i}`),
      type: "text",
      x: itemX,
      y: CY + 50,
      text: String(item.count),
      fontSize: fontSizes["4xl"],
      fontFamily: fontStacks.display,
      fontWeight: fontWeights.black,
      color: item.color,
      textAlign: "center",
      opacity: 0,
      keyframes: [
        { time: 1.5 + i * 0.15, props: { opacity: 0, scale: 0.7 } },
        { time: 2.0 + i * 0.15, props: { opacity: 1, scale: 1 } },
      ],
      easing: easings.bouncy,
    };

    const labelEl: SceneElement = {
      id: uid(`summary-label-${i}`),
      type: "text",
      x: itemX,
      y: CY + 105,
      text: item.label,
      fontSize: fontSizes.sm,
      fontFamily: fontStacks.body,
      fontWeight: fontWeights.medium,
      color: theme.muted,
      textAlign: "center",
      opacity: 0,
      keyframes: [
        { time: 1.5 + i * 0.15, props: { opacity: 0 } },
        { time: 2.0 + i * 0.15, props: { opacity: 1 } },
      ],
      easing: easings.smooth,
    };

    return [countEl, labelEl];
  });

  // CTA button
  const ctaBtnW = 300;
  const ctaBtnH = 60;
  const ctaBtnX = CX - ctaBtnW / 2;
  const ctaBtnY = CY + 175;

  const ctaBtn: SceneElement = {
    id: uid("cl-cta-btn"),
    type: "rect",
    x: ctaBtnX,
    y: ctaBtnY,
    width: ctaBtnW,
    height: ctaBtnH,
    fill: theme.primary,
    cornerRadius: ctaBtnH / 2,
    opacity: 0,
    keyframes: [
      { time: 2.8, props: { opacity: 0, scale: 0.9 } },
      { time: 3.3, props: { opacity: 1, scale: 1 } },
    ],
    easing: easings.bouncy,
  };

  const ctaBtnText: SceneElement = {
    id: uid("cl-cta-btn-text"),
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
      { time: 2.8, props: { opacity: 0 } },
      { time: 3.3, props: { opacity: 1 } },
    ],
    easing: easings.bouncy,
  };

  return {
    id: uid("cl-final"),
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
      ...particles,
      ...versionLabel,
      ...summaryTitle,
      ...summaryElements,
      ctaBtn,
      ctaBtnText,
    ],
  };
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

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateChangelog(props: ChangelogProps): Scene[] {
  return [
    buildScene1(props),
    ...props.changes.map((change, i) =>
      buildChangeScene(props, change, i, props.changes.length)
    ),
    buildFinalScene(props),
  ];
}
