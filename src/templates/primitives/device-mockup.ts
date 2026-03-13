/**
 * Device Mockup Primitives
 *
 * Factory functions that generate the SceneElement arrays needed to render
 * photorealistic device frames. The renderer draws the chrome; templates supply
 * the screen content (color fill or image reference).
 *
 * Every function returns:
 *  - `elements`  — SceneElement[] to push into your Scene
 *  - `screen`    — { x, y, width, height } rect describing the usable screen
 *                  area inside the bezel, so templates can place content on top
 */

import type { SceneElement } from "../types";
import { easings, durations } from "../tokens/animation";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface DeviceResult {
  elements: SceneElement[];
  /** Safe inner area available for screen content */
  screen: { x: number; y: number; width: number; height: number };
}

export interface BaseDeviceConfig {
  /** Left edge of the device frame (px) */
  x: number;
  /** Top edge of the device frame (px) */
  y: number;
  /** Total device height (px); width is derived from aspect ratio */
  height: number;
  /** Color or image ref rendered inside the screen area */
  screenContent?: string;
  /** Device frame entrance animation start time (seconds) */
  startTime?: number;
  /** Frame color (default: sleek space gray) */
  frameColor?: string;
  /** Shadow intensity 0–1 */
  shadowOpacity?: number;
  opacity?: number;
}

// ─── iphoneMockup ─────────────────────────────────────────────────────────────

export interface IphoneMockupConfig extends BaseDeviceConfig {
  /** "14" | "15" | "pro" — affects notch/island style */
  model?: "14" | "15" | "pro";
}

export function iphoneMockup(config: IphoneMockupConfig): DeviceResult {
  const {
    x,
    y,
    height,
    screenContent = "#000000",
    startTime = 0,
    frameColor = "#1a1a1e",
    shadowOpacity = 0.45,
    opacity = 1,
  } = config;

  // iPhone aspect ratio: 19.5:9 (393 × 852 logical pts on iPhone 14 Pro)
  const aspectRatio = 393 / 852;
  const width = Math.round(height * aspectRatio);

  // Bezel sizes relative to total height
  const cornerRadius = width * 0.12;
  const bezelSide = width * 0.04;
  const bezelTop = height * 0.048;
  const bezelBottom = height * 0.038;

  const screenX = x + bezelSide;
  const screenY = y + bezelTop;
  const screenW = width - bezelSide * 2;
  const screenH = height - bezelTop - bezelBottom;

  // Dynamic Island pill
  const islandW = screenW * 0.28;
  const islandH = height * 0.025;
  const islandX = screenX + screenW / 2 - islandW / 2;
  const islandY = screenY + height * 0.012;

  const enterKf = [
    { time: startTime, props: { opacity: 0, translateY: 60, scale: 0.9 } },
    {
      time: startTime + durations.slow / 1000,
      props: { opacity, translateY: 0, scale: 1 },
    },
  ];

  // Drop shadow
  const shadow: SceneElement = {
    id: `iphone-shadow-${Date.now()}`,
    type: "gradient",
    x: x - width * 0.1,
    y: y + height * 0.85,
    width: width * 1.2,
    height: height * 0.18,
    opacity: shadowOpacity,
    gradient: {
      type: "radial",
      stops: [
        { offset: 0, color: "rgba(0,0,0,0.7)" },
        { offset: 1, color: "rgba(0,0,0,0)" },
      ],
    },
    keyframes: enterKf,
    easing: easings.smooth,
  };

  // Device body
  const body: SceneElement = {
    id: `iphone-body-${Date.now()}`,
    type: "device",
    x,
    y,
    width,
    height,
    fill: frameColor,
    cornerRadius,
    deviceType: "iphone",
    screenContent,
    opacity,
    keyframes: enterKf,
    easing: easings.bouncy,
  };

  // Screen fill (rounded slightly less than body)
  const screen: SceneElement = {
    id: `iphone-screen-${Date.now()}`,
    type: "rect",
    x: screenX,
    y: screenY,
    width: screenW,
    height: screenH,
    fill: screenContent,
    cornerRadius: cornerRadius * 0.7,
    opacity,
    keyframes: enterKf,
    easing: easings.bouncy,
  };

  // Dynamic Island pill
  const island: SceneElement = {
    id: `iphone-island-${Date.now()}`,
    type: "rect",
    x: islandX,
    y: islandY,
    width: islandW,
    height: islandH,
    fill: "#000000",
    cornerRadius: islandH / 2,
    opacity,
    keyframes: enterKf,
    easing: easings.bouncy,
  };

  // Side button (right edge)
  const sideButton: SceneElement = {
    id: `iphone-side-btn-${Date.now()}`,
    type: "rect",
    x: x + width - 2,
    y: y + height * 0.28,
    width: 4,
    height: height * 0.14,
    fill: "#2a2a2e",
    cornerRadius: 2,
    opacity,
    keyframes: enterKf,
    easing: easings.bouncy,
  };

  return {
    elements: [shadow, body, screen, island, sideButton],
    screen: { x: screenX, y: screenY, width: screenW, height: screenH },
  };
}

// ─── macbookMockup ────────────────────────────────────────────────────────────

export interface MacbookMockupConfig extends BaseDeviceConfig {
  /** Show keyboard / trackpad area (default true) */
  showBase?: boolean;
}

export function macbookMockup(config: MacbookMockupConfig): DeviceResult {
  const {
    x,
    y,
    height,
    screenContent = "#1e1e20",
    startTime = 0,
    frameColor = "#d1d1d6",
    shadowOpacity = 0.4,
    opacity = 1,
    showBase = true,
  } = config;

  // MacBook Pro 14": screen is 16:10
  const lidAspect = 16 / 10;
  const lidHeight = height * 0.62;
  const lidWidth = lidHeight * lidAspect;
  const totalWidth = lidWidth * 1.08; // base is slightly wider

  const bezel = lidWidth * 0.025;
  const topBezel = lidHeight * 0.055;
  const bottomBezel = lidHeight * 0.04; // thin chin
  const cornerRadius = lidWidth * 0.025;

  const screenX = x + bezel;
  const screenY = y + topBezel;
  const screenW = lidWidth - bezel * 2;
  const screenH = lidHeight - topBezel - bottomBezel;

  const enterKf = [
    { time: startTime, props: { opacity: 0, scale: 0.88, translateY: 40 } },
    {
      time: startTime + durations.dramatic / 1000,
      props: { opacity, scale: 1, translateY: 0 },
    },
  ];

  const shadow: SceneElement = {
    id: `macbook-shadow-${Date.now()}`,
    type: "gradient",
    x: x - totalWidth * 0.08,
    y: y + height * 0.88,
    width: totalWidth * 1.16,
    height: height * 0.12,
    opacity: shadowOpacity,
    gradient: {
      type: "radial",
      stops: [
        { offset: 0, color: "rgba(0,0,0,0.65)" },
        { offset: 1, color: "rgba(0,0,0,0)" },
      ],
    },
    keyframes: enterKf,
    easing: easings.gentle,
  };

  const lid: SceneElement = {
    id: `macbook-lid-${Date.now()}`,
    type: "device",
    x,
    y,
    width: lidWidth,
    height: lidHeight,
    fill: frameColor,
    cornerRadius,
    deviceType: "macbook",
    screenContent,
    opacity,
    keyframes: enterKf,
    easing: easings.gentle,
  };

  const screenRect: SceneElement = {
    id: `macbook-screen-${Date.now()}`,
    type: "rect",
    x: screenX,
    y: screenY,
    width: screenW,
    height: screenH,
    fill: screenContent,
    cornerRadius: cornerRadius * 0.5,
    opacity,
    keyframes: enterKf,
    easing: easings.gentle,
  };

  // Notch (camera cutout at top center of screen)
  const notchW = screenW * 0.045;
  const notchH = screenH * 0.022;
  const notch: SceneElement = {
    id: `macbook-notch-${Date.now()}`,
    type: "rect",
    x: screenX + screenW / 2 - notchW / 2,
    y: screenY,
    width: notchW,
    height: notchH,
    fill: frameColor,
    cornerRadius: notchH / 2,
    opacity,
    keyframes: enterKf,
    easing: easings.gentle,
  };

  const elements: SceneElement[] = [shadow, lid, screenRect, notch];

  if (showBase) {
    const baseY = y + lidHeight;
    const baseH = height - lidHeight;

    const base: SceneElement = {
      id: `macbook-base-${Date.now()}`,
      type: "rect",
      x: x - (totalWidth - lidWidth) / 2,
      y: baseY,
      width: totalWidth,
      height: baseH * 0.55,
      fill: frameColor,
      cornerRadius: 2,
      opacity,
      keyframes: enterKf,
      easing: easings.gentle,
    };

    const hinge: SceneElement = {
      id: `macbook-hinge-${Date.now()}`,
      type: "rect",
      x: x + lidWidth * 0.1,
      y: baseY - 3,
      width: lidWidth * 0.8,
      height: 5,
      fill: "#b0b0b8",
      cornerRadius: 2,
      opacity,
      keyframes: enterKf,
      easing: easings.gentle,
    };

    elements.push(base, hinge);
  }

  return {
    elements,
    screen: { x: screenX, y: screenY, width: screenW, height: screenH },
  };
}

// ─── browserMockup ────────────────────────────────────────────────────────────

export interface BrowserMockupConfig extends BaseDeviceConfig {
  /** URL to display in address bar */
  url?: string;
  /** Chrome theme: "light" | "dark" */
  theme?: "light" | "dark";
  /** Width of the browser window (px); height is derived */
  width?: number;
}

export function browserMockup(config: BrowserMockupConfig): DeviceResult {
  const {
    x,
    y,
    height,
    screenContent = "#ffffff",
    startTime = 0,
    shadowOpacity = 0.35,
    opacity = 1,
    theme = "dark",
    width: explicitWidth,
  } = config;

  const width = explicitWidth ?? Math.round(height * (16 / 10));
  const chromeH = height * 0.07; // browser toolbar height
  const cornerRadius = 10;

  const chromeFill = theme === "dark" ? "#1e1e20" : "#f0f0f2";
  const addressBarFill = theme === "dark" ? "#2d2d30" : "#e0e0e4";
  const addressTextColor = theme === "dark" ? "#a0a0a8" : "#606068";

  const screenX = x;
  const screenY = y + chromeH;
  const screenW = width;
  const screenH = height - chromeH;

  const enterKf = [
    { time: startTime, props: { opacity: 0, translateY: 30, scale: 0.93 } },
    {
      time: startTime + durations.slow / 1000,
      props: { opacity, translateY: 0, scale: 1 },
    },
  ];

  const shadow: SceneElement = {
    id: `browser-shadow-${Date.now()}`,
    type: "gradient",
    x: x - width * 0.05,
    y: y + height * 0.9,
    width: width * 1.1,
    height: height * 0.12,
    opacity: shadowOpacity,
    gradient: {
      type: "radial",
      stops: [
        { offset: 0, color: "rgba(0,0,0,0.6)" },
        { offset: 1, color: "rgba(0,0,0,0)" },
      ],
    },
    keyframes: enterKf,
    easing: easings.smooth,
  };

  const windowFrame: SceneElement = {
    id: `browser-frame-${Date.now()}`,
    type: "rect",
    x,
    y,
    width,
    height,
    fill: chromeFill,
    cornerRadius,
    opacity,
    keyframes: enterKf,
    easing: easings.smooth,
  };

  // Address bar
  const abW = width * 0.45;
  const abH = chromeH * 0.52;
  const abX = x + width / 2 - abW / 2;
  const abY = y + chromeH * 0.24;

  const addressBar: SceneElement = {
    id: `browser-address-${Date.now()}`,
    type: "rect",
    x: abX,
    y: abY,
    width: abW,
    height: abH,
    fill: addressBarFill,
    cornerRadius: abH / 2,
    opacity,
    keyframes: enterKf,
    easing: easings.smooth,
  };

  const addressText: SceneElement = {
    id: `browser-url-${Date.now()}`,
    type: "text",
    x: abX + abH * 0.7,
    y: abY + abH * 0.18,
    width: abW - abH,
    text: config.url ?? "yourproduct.com",
    fontSize: abH * 0.52,
    fontFamily: '"Inter", sans-serif',
    fontWeight: 400,
    color: addressTextColor,
    textAlign: "center",
    opacity,
    keyframes: enterKf,
    easing: easings.smooth,
  };

  // Traffic-light buttons
  const dotColors = ["#ff5f57", "#ffbd2e", "#28c840"];
  const dots = dotColors.map((dotColor, i): SceneElement => ({
    id: `browser-dot-${Date.now()}-${i}`,
    type: "circle",
    x: x + 20 + i * 22,
    y: y + chromeH * 0.5 - 6,
    width: 12,
    height: 12,
    fill: dotColor,
    opacity,
    keyframes: enterKf,
    easing: easings.smooth,
  }));

  // Screen / content area
  const screenRect: SceneElement = {
    id: `browser-screen-${Date.now()}`,
    type: "rect",
    x: screenX,
    y: screenY,
    width: screenW,
    height: screenH,
    fill: screenContent,
    cornerRadius: 0,
    opacity,
    keyframes: enterKf,
    easing: easings.smooth,
  };

  return {
    elements: [shadow, windowFrame, screenRect, addressBar, addressText, ...dots],
    screen: { x: screenX, y: screenY, width: screenW, height: screenH },
  };
}

// ─── genericDevice ────────────────────────────────────────────────────────────

export interface GenericDeviceConfig extends BaseDeviceConfig {
  /** Total device width (px); if omitted, height × aspectRatio is used */
  width?: number;
  /** Width:Height aspect ratio (default 9:16) */
  aspectRatio?: number;
  /** Bezel thickness as a fraction of width (default 0.05) */
  bezelFraction?: number;
  /** Corner radius as a fraction of width (default 0.08) */
  cornerFraction?: number;
}

export function genericDevice(config: GenericDeviceConfig): DeviceResult {
  const {
    x,
    y,
    height,
    screenContent = "#000000",
    startTime = 0,
    frameColor = "#1c1c1e",
    shadowOpacity = 0.4,
    opacity = 1,
    aspectRatio = 9 / 16,
    bezelFraction = 0.05,
    cornerFraction = 0.08,
    width: explicitWidth,
  } = config;

  const width = explicitWidth ?? Math.round(height * aspectRatio);
  const bezel = width * bezelFraction;
  const cornerRadius = width * cornerFraction;

  const screenX = x + bezel;
  const screenY = y + bezel;
  const screenW = width - bezel * 2;
  const screenH = height - bezel * 2;

  const enterKf = [
    { time: startTime, props: { opacity: 0, scale: 0.88, translateY: 50 } },
    {
      time: startTime + durations.slow / 1000,
      props: { opacity, scale: 1, translateY: 0 },
    },
  ];

  const shadow: SceneElement = {
    id: `generic-shadow-${Date.now()}`,
    type: "gradient",
    x: x - width * 0.1,
    y: y + height * 0.85,
    width: width * 1.2,
    height: height * 0.18,
    opacity: shadowOpacity,
    gradient: {
      type: "radial",
      stops: [
        { offset: 0, color: "rgba(0,0,0,0.65)" },
        { offset: 1, color: "rgba(0,0,0,0)" },
      ],
    },
    keyframes: enterKf,
    easing: easings.smooth,
  };

  const body: SceneElement = {
    id: `generic-body-${Date.now()}`,
    type: "rect",
    x,
    y,
    width,
    height,
    fill: frameColor,
    cornerRadius,
    opacity,
    keyframes: enterKf,
    easing: easings.bouncy,
  };

  const screenRect: SceneElement = {
    id: `generic-screen-${Date.now()}`,
    type: "rect",
    x: screenX,
    y: screenY,
    width: screenW,
    height: screenH,
    fill: screenContent,
    cornerRadius: cornerRadius * 0.75,
    opacity,
    keyframes: enterKf,
    easing: easings.bouncy,
  };

  return {
    elements: [shadow, body, screenRect],
    screen: { x: screenX, y: screenY, width: screenW, height: screenH },
  };
}
