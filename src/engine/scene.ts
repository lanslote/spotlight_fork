/**
 * Scene system — the data model for Spotlight's rendering pipeline.
 *
 * Hierarchy:
 *   SceneSequence
 *     └─ Scene[]          (each covers a contiguous time window)
 *          └─ SceneElement[]   (text, shape, image, gradient, device-mockup, …)
 *               └─ AnimationConfig   (keyframe timeline per property)
 *
 * Scenes are pure data; the Timeline class is responsible for interpolation
 * and the CanvasRenderer for drawing.  Keeping them separate makes every layer
 * independently testable.
 */

// ─── Primitive value types ────────────────────────────────────────────────────

export interface Vec2 { x: number; y: number; }
export interface Size { width: number; height: number; }
export interface Rect extends Vec2, Size {}
export interface Color {
  r: number;   // 0-255
  g: number;   // 0-255
  b: number;   // 0-255
  a: number;   // 0-1
}

// ─── Easing identifiers ───────────────────────────────────────────────────────

export type EasingName =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "easeInQuad"
  | "easeOutQuad"
  | "easeInOutQuad"
  | "easeInCubic"
  | "easeOutCubic"
  | "easeInOutCubic"
  | "easeInQuart"
  | "easeOutQuart"
  | "easeInOutQuart"
  | "easeInExpo"
  | "easeOutExpo"
  | "easeInOutExpo"
  | "easeInBack"
  | "easeOutBack"
  | "easeInOutBack"
  | "spring"
  | "bouncy"
  | "step";

// ─── Keyframes & Animation ────────────────────────────────────────────────────

/**
 * A single keyframe for one numeric property.
 * `time` is a normalised 0→1 position within the element's own animation window.
 */
export interface Keyframe {
  time: number;        // 0–1 (fraction of animationDuration)
  value: number;
  easing?: EasingName; // easing applied from THIS keyframe to the NEXT one
}

/** Animation config for a single numeric property on an element. */
export interface PropertyAnimation {
  keyframes: Keyframe[];
  /** How long (seconds) the animation runs, starting at animationDelay. */
  duration: number;
  /** Delay (seconds) from the scene's start before this property animates. */
  delay?: number;
  /** "none" | "loop" | "pingpong" */
  repeat?: "none" | "loop" | "pingpong";
}

/**
 * Full animation config for an element.
 * Each key maps to one animatable property.
 */
export interface AnimationConfig {
  x?: PropertyAnimation;
  y?: PropertyAnimation;
  width?: PropertyAnimation;
  height?: PropertyAnimation;
  opacity?: PropertyAnimation;
  scaleX?: PropertyAnimation;
  scaleY?: PropertyAnimation;
  rotation?: PropertyAnimation;    // degrees
  /** Blur radius in px (for entrance / exit effects). */
  blur?: PropertyAnimation;
  /** Custom per-type properties (e.g. fontSize, letterSpacing). */
  [key: string]: PropertyAnimation | undefined;
}

// ─── Gradient definitions ─────────────────────────────────────────────────────

export interface GradientStop {
  offset: number;  // 0–1
  color: Color;
}

export interface LinearGradient {
  type: "linear";
  angle: number;   // degrees (0 = top-to-bottom, 90 = left-to-right)
  stops: GradientStop[];
}

export interface RadialGradient {
  type: "radial";
  centerX: number; // 0–1 relative to element bounds
  centerY: number;
  radius: number;  // 0–1 relative to element's shorter dimension
  stops: GradientStop[];
}

export interface AngularGradient {
  type: "angular";
  centerX: number;
  centerY: number;
  startAngle: number; // degrees
  stops: GradientStop[];
}

export type GradientDef = LinearGradient | RadialGradient | AngularGradient;

// ─── Element types ────────────────────────────────────────────────────────────

export type ElementType =
  | "text"
  | "rect"
  | "circle"
  | "rounded-rect"
  | "image"
  | "gradient-bg"
  | "device-iphone"
  | "device-macbook"
  | "device-ipad"
  | "group"
  | "video-playback"
  | "custom-cursor"
  | "ripple-effect"
  | "blur-region";

// ── Text ──────────────────────────────────────────────────────────────────────

export interface TextStyle {
  fontFamily: string;
  fontSize: number;        // px (logical, before DPR scaling)
  fontWeight: number | "normal" | "bold" | "lighter";
  fontStyle?: "normal" | "italic" | "oblique";
  color: Color;
  textAlign?: CanvasTextAlign;
  letterSpacing?: number;  // px
  lineHeight?: number;     // multiplier (default 1.2)
  textShadow?: {
    offsetX: number;
    offsetY: number;
    blur: number;
    color: Color;
  };
}

export interface TextElement {
  type: "text";
  content: string;
  style: TextStyle;
  /**
   * Word-wrap width (px, logical).  0 = no wrap.
   * Animated via AnimationConfig.width if needed.
   */
  wrapWidth?: number;
}

// ── Shapes ────────────────────────────────────────────────────────────────────

export interface ShapeStyle {
  fill?: Color | GradientDef;
  stroke?: Color;
  strokeWidth?: number;
  /** Corner radius for rounded-rect. */
  borderRadius?: number;
  shadow?: {
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
    color: Color;
  };
}

export interface RectElement   { type: "rect";         style: ShapeStyle; }
export interface CircleElement { type: "circle";       style: ShapeStyle; }
export interface RoundedRectElement { type: "rounded-rect"; style: ShapeStyle; }

// ── Gradient background ───────────────────────────────────────────────────────

export interface GradientBgElement {
  type: "gradient-bg";
  gradient: GradientDef;
  /** If true, the element fills the entire canvas regardless of size/position. */
  fullCanvas?: boolean;
}

// ── Image ─────────────────────────────────────────────────────────────────────

export interface ImageElement {
  type: "image";
  /** URL, data-URI, or a pre-loaded HTMLImageElement. */
  src: string | HTMLImageElement;
  objectFit?: "fill" | "contain" | "cover";
  borderRadius?: number;
  /**
   * Tint colour applied via globalCompositeOperation "multiply".
   * Ignored when undefined.
   */
  tint?: Color;
}

// ── Device mockups ────────────────────────────────────────────────────────────

export interface DeviceMockupElement {
  type: "device-iphone" | "device-macbook" | "device-ipad";
  /**
   * URL or element describing the screen content to composite inside.
   * Can be null for just the frame.
   */
  screenContent?: string | HTMLCanvasElement | null;
  /** Device frame colour scheme. */
  colorScheme?: "silver" | "space-gray" | "gold" | "midnight" | "starlight";
  /** Show device shadow. */
  showShadow?: boolean;
  /** Rotation to suggest 3-quarter perspective (degrees). 0 = front-on. */
  perspective?: number;
}

// ── Group ─────────────────────────────────────────────────────────────────────

export interface GroupElement {
  type: "group";
  children: SceneElement[];
  /** Clip children to group's bounds. */
  clipToBounds?: boolean;
}

// ── Video playback ──────────────────────────────────────────────────────────

export interface VideoPlaybackElement {
  type: "video-playback";
  /** Video source - URL, data-URI, or HTMLVideoElement reference */
  src: string | HTMLVideoElement;
  /** Current playback time in seconds */
  currentTime?: number;
  /** Playback rate (1.0 = normal) */
  playbackRate?: number;
  /** Object fit mode */
  objectFit?: "fill" | "contain" | "cover";
  /** Border radius for rounded corners */
  borderRadius?: number;
}

// ── Custom cursor ───────────────────────────────────────────────────────────

export interface CursorStyle {
  type: "default" | "pointer" | "dot" | "ring" | "crosshair";
  size: number;
  color: Color;
  /** Secondary color for ring/crosshair styles */
  secondaryColor?: Color;
  /** Whether to show a trailing tail */
  showTrail?: boolean;
  trailLength?: number;
  trailColor?: Color;
}

export interface CustomCursorElement {
  type: "custom-cursor";
  /** Cursor position (animated via x, y) */
  cursorStyle: CursorStyle;
  /** Whether cursor is currently clicking */
  isClicking?: boolean;
  /** Click animation progress 0-1 */
  clickProgress?: number;
}

// ── Ripple effect ───────────────────────────────────────────────────────────

export interface RippleEffectElement {
  type: "ripple-effect";
  /** Ripple center (uses element x, y) */
  rippleRadius: number;
  /** Max radius the ripple expands to */
  maxRadius: number;
  /** Ripple color */
  rippleColor: Color;
  /** Ripple progress 0-1 (0 = start, 1 = fully expanded and faded) */
  progress: number;
  /** Number of concentric rings */
  rings?: number;
  /** Ring stroke width */
  strokeWidth?: number;
}

// ── Blur region ─────────────────────────────────────────────────────────────

export interface BlurRegionElement {
  type: "blur-region";
  /** Blur amount in pixels */
  blurAmount: number;
  /** Shape of the blur region */
  shape: "rect" | "circle" | "rounded-rect";
  /** Border radius for rounded-rect shape */
  borderRadius?: number;
  /** Whether this is an INVERTED blur (blur everything EXCEPT this region) */
  invert?: boolean;
  /** Optional tint/overlay color on the blurred region */
  tintColor?: Color;
}

// ─── SceneElement (union) ─────────────────────────────────────────────────────

/** Common fields shared by every element. */
export interface SceneElementBase {
  /** Stable unique identifier (nanoid / uuid). */
  id: string;
  /** Human-readable label for the timeline UI. */
  name?: string;

  // ── Spatial defaults (animated or static) ──────────────────────────────────
  /** X position in logical px, relative to canvas origin (top-left). */
  x: number;
  /** Y position in logical px. */
  y: number;
  /** Logical width in px. */
  width: number;
  /** Logical height in px. */
  height: number;

  // ── Transform origin (0-1, relative to element bounds) ─────────────────────
  originX?: number;  // default 0.5
  originY?: number;  // default 0.5

  // ── Static transform ────────────────────────────────────────────────────────
  opacity?: number;    // 0–1, default 1
  scaleX?: number;     // default 1
  scaleY?: number;     // default 1
  rotation?: number;   // degrees, default 0

  // ── Visibility window (seconds, relative to scene start) ───────────────────
  /** Time within the scene when this element becomes visible. Default 0. */
  startTime?: number;
  /** Time within the scene when this element becomes invisible.  Default = scene.duration. */
  endTime?: number;

  // ── Animation ───────────────────────────────────────────────────────────────
  animation?: AnimationConfig;

  // ── Stagger (set by timeline for groups of related elements) ───────────────
  /** Extra delay (seconds) added by a stagger group before animating. */
  staggerDelay?: number;

  // ── Blend mode ──────────────────────────────────────────────────────────────
  blendMode?: GlobalCompositeOperation;

  // ── Filter ──────────────────────────────────────────────────────────────────
  /** CSS-style filter string e.g. "blur(4px) brightness(1.2)". */
  filter?: string;

  // ── z-ordering ──────────────────────────────────────────────────────────────
  zIndex?: number;  // higher = on top; default 0
}

export type SceneElement = SceneElementBase & (
  | TextElement
  | RectElement
  | CircleElement
  | RoundedRectElement
  | GradientBgElement
  | ImageElement
  | DeviceMockupElement
  | GroupElement
  | VideoPlaybackElement
  | CustomCursorElement
  | RippleEffectElement
  | BlurRegionElement
);

// ─── Transitions ─────────────────────────────────────────────────────────────

export type TransitionType =
  | "cut"
  | "fade"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "slide-down"
  | "zoom-in"
  | "zoom-out"
  | "dissolve";

export interface SceneTransition {
  type: TransitionType;
  /** Duration in seconds. */
  duration: number;
  easing?: EasingName;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export interface Scene {
  id: string;
  name: string;
  /** Duration in seconds. */
  duration: number;
  /** Canvas dimensions this scene was designed for (logical px). */
  canvasWidth?: number;
  canvasHeight?: number;
  /** Background colour applied before any elements. */
  backgroundColor?: Color;
  elements: SceneElement[];
  /**
   * Optional override render function.  When provided, the CanvasRenderer
   * calls this instead of its built-in element pipeline.  Useful for
   * one-off procedural scenes.
   */
  render?: (ctx: CanvasRenderingContext2D, currentTime: number) => void;
}

// ─── SceneSequence ────────────────────────────────────────────────────────────

export interface SceneSequence {
  id: string;
  name: string;
  /** Target output resolution (logical px). */
  width: number;
  height: number;
  fps: number;
  scenes: Scene[];
  /**
   * Transition to apply between scenes[i] and scenes[i+1].
   * Length must be scenes.length - 1; use undefined entries for cuts.
   */
  transitions?: (SceneTransition | undefined)[];
  /** Global background applied behind every scene (usually overridden per-scene). */
  backgroundColor?: Color;
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

let _idCounter = 0;
/** Lightweight sequential ID generator (no dependency on nanoid). */
export function makeId(prefix = "el"): string {
  return `${prefix}_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`;
}

export function makeColor(r: number, g: number, b: number, a = 1): Color {
  return { r, g, b, a };
}

export const Colors = {
  white:       makeColor(255, 255, 255),
  black:       makeColor(0, 0, 0),
  transparent: makeColor(0, 0, 0, 0),
} as const;

/** Convert a Color to a CSS rgba() string. */
export function colorToCSS(c: Color): string {
  return `rgba(${c.r},${c.g},${c.b},${c.a})`;
}

/** Convert a hex string like "#FF0088" or "#f08" to Color. */
export function hexToColor(hex: string, alpha = 1): Color {
  const h = hex.replace(/^#/, "");
  if (h.length === 3) {
    return makeColor(
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
      alpha
    );
  }
  return makeColor(
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    alpha
  );
}

/** Build a simple linear gradient stop array from an array of [offset, color] pairs. */
export function buildLinearGradient(
  angle: number,
  ...stops: [number, Color][]
): LinearGradient {
  return {
    type: "linear",
    angle,
    stops: stops.map(([offset, color]) => ({ offset, color })),
  };
}

/** Create a minimal SceneElement skeleton (caller fills in type-specific fields). */
export function makeElement(
  partial: Partial<SceneElementBase> & Pick<SceneElementBase, "id"> & Pick<SceneElement, "type">
): SceneElement {
  const defaults: Omit<SceneElementBase, "id"> = {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    opacity: 1,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    originX: 0.5,
    originY: 0.5,
    zIndex: 0,
  };
  return { ...defaults, ...partial } as SceneElement;
}

/** Compute the total duration (seconds) of a SceneSequence including transitions. */
export function sequenceDuration(seq: SceneSequence): number {
  let total = 0;
  for (let i = 0; i < seq.scenes.length; i++) {
    total += seq.scenes[i].duration;
    const tx = seq.transitions?.[i];
    if (tx) {
      // Transitions overlap the adjacent scenes, so subtract half the
      // transition duration from each neighbour (net effect: subtract once).
      total -= tx.duration;
    }
  }
  return Math.max(0, total);
}
