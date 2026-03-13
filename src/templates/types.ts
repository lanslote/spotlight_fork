/**
 * Core type definitions shared across the Spotlight template system.
 *
 * These interfaces are designed to match the canvas-based rendering engine's
 * expected input format exactly. All coordinates are in px, all times in seconds.
 */

// ─── SceneElement ─────────────────────────────────────────────────────────────

export interface SceneElement {
  /** Unique element identifier within a scene */
  id: string;

  /**
   * Renderer dispatch type.
   *  - "text"          : rendered as canvas fillText
   *  - "rect"          : fillRect with optional cornerRadius
   *  - "circle"        : arc fill
   *  - "gradient"      : full-rect gradient fill
   *  - "device"        : composite device frame (renderer uses deviceType)
   *  - "image"         : drawImage from an asset reference
   *  - "particle-field": renderer-driven particle simulation
   */
  type: "text" | "rect" | "circle" | "gradient" | "device" | "image" | "particle-field";

  /** Position — top-left corner for rects; center for circles */
  x: number;
  y: number;
  width?: number;
  height?: number;

  // ── Text properties ──────────────────────────────────────────────────────────
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  /** CSS letter-spacing value (e.g. "0.05em" or a raw pixel number) */
  letterSpacing?: number;
  lineHeight?: number;
  color?: string;
  textAlign?: "left" | "center" | "right";

  // ── Shape / fill properties ───────────────────────────────────────────────
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;

  // ── Gradient properties ───────────────────────────────────────────────────
  gradient?: {
    type: "linear" | "radial";
    stops: { offset: number; color: string }[];
    /** Degrees clockwise from top (linear only) */
    angle?: number;
  };

  // ── Device properties ─────────────────────────────────────────────────────
  deviceType?: "iphone" | "macbook" | "browser";
  /** CSS color or asset reference (path / URL) for the screen fill */
  screenContent?: string;

  // ── Transform & opacity ───────────────────────────────────────────────────
  opacity?: number;
  scale?: number;
  rotation?: number;
  translateX?: number;
  translateY?: number;

  // ── Animation ─────────────────────────────────────────────────────────────
  /**
   * Keyframe track for this element. Each entry specifies a time (seconds
   * relative to scene start) and a set of property overrides. The renderer
   * linearly interpolates numeric props between adjacent keyframes.
   */
  keyframes?: {
    time: number;
    props: Partial<Omit<SceneElement, "id" | "type" | "keyframes">>;
  }[];
  /** CSS easing string or named preset applied between all keyframes */
  easing?: string;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export interface Scene {
  /** Unique scene identifier within the video */
  id: string;
  /** Human-readable name shown in the timeline UI */
  name: string;
  /** Scene duration in seconds */
  duration: number;
  /** Ordered list of elements (painter's order — first = bottom) */
  elements: SceneElement[];
  /**
   * Background shorthand. Either:
   *  - A CSS color string "#rrggbb" or "rgba(...)"
   *  - A gradient descriptor (same shape as SceneElement.gradient)
   */
  background?:
    | string
    | {
        type: "linear" | "radial";
        stops: { offset: number; color: string }[];
        angle?: number;
      };
  /** Transition applied at the OUT edge of this scene */
  transition?: {
    type: string;
    duration: number; // ms
  };
}

// ─── Aspect ratio ─────────────────────────────────────────────────────────────

export type AspectRatio = "16:9" | "9:16" | "1:1";

export interface CanvasDimensions {
  width: number;
  height: number;
}

const CANVAS_DIMS: Record<AspectRatio, CanvasDimensions> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
};

export function getCanvasDimensions(ratio: AspectRatio): CanvasDimensions {
  return CANVAS_DIMS[ratio];
}

// ─── Template metadata ────────────────────────────────────────────────────────

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: "launch" | "feature" | "social" | "hero" | "changelog" | "app-store" | "enhance";
  defaultDuration: number; // seconds
  durationRange: [number, number]; // [min, max] seconds
  supportedAspectRatios: AspectRatio[];
  thumbnailGradient: string[]; // 2–4 hex colors for the registry thumbnail
}
