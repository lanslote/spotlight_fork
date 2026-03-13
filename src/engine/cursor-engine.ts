/**
 * CursorEngine — cursor smoothing and rendering for Spotlight's screen-recording
 * enhancement pipeline.
 *
 * Pipeline:
 *   raw CursorPath (from VideoAnalyzer)
 *     → smoothPath() via Catmull-Rom → cubic Bézier re-sampling
 *       → CursorEngine.renderAll() draws replacement cursor + trail + ripples
 *
 * All rendering is pure Canvas 2D — no external dependencies.
 */

import type { Color } from "./scene";
import { colorToCSS } from "./scene";
import type { CursorPath, DetectedClick, Vec2 } from "./video-analyzer";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CursorConfig {
  /** Cursor style preset */
  style: "default" | "pointer" | "dot" | "ring" | "crosshair";
  /** Cursor size in pixels */
  size: number;
  /** Primary cursor color */
  color: Color;
  /** Secondary color (for ring, crosshair) */
  secondaryColor?: Color;
  /** Show trailing path */
  showTrail?: boolean;
  /** Trail length — number of past SmoothedPoints to draw */
  trailLength?: number;
  /** Trail color (defaults to cursor color with lower opacity) */
  trailColor?: Color;
  /** Whether to replace the original cursor in the video feed */
  replaceOriginal?: boolean;
  /**
   * Smoothing factor applied after Catmull-Rom re-sampling.
   * 0 = raw positions, 1 = maximum exponential smoothing.
   * Default 0.7.
   */
  smoothing?: number;
}

export interface RippleConfig {
  /** Ripple color */
  color: Color;
  /** Maximum ripple radius in pixels */
  maxRadius: number;
  /** Number of concentric rings per click */
  rings: number;
  /** Full ripple duration in seconds */
  duration: number;
  /** Ring stroke width at start of animation */
  strokeWidth: number;
}

/** A single time-stamped point on the smoothed cursor path. */
export interface SmoothedPoint {
  time: number;
  x: number;
  y: number;
  /** Original detection confidence from the VideoAnalyzer */
  confidence: number;
}

// ─── Catmull-Rom → Cubic Bézier path smoothing ───────────────────────────────

/**
 * Convert a raw cursor path (sparse, noisy, analysis-FPS resolution) into a
 * uniformly-spaced sequence of SmoothedPoints at `outputFPS` resolution.
 *
 * Algorithm:
 *  1. Thin the raw points to every 3rd sample as Catmull-Rom control points.
 *  2. For each consecutive pair of control points, derive the two cubic Bézier
 *     handles:  CP1 = P1 + (P2-P0)/6,  CP2 = P2 - (P3-P1)/6
 *  3. Subdivide each cubic segment at outputFPS resolution by evaluating B(t).
 *  4. Optionally run an exponential smoothing pass over x/y.
 *
 * @param rawPoints   Ordered cursor positions as returned by VideoAnalyzer.
 * @param outputFPS   Frame rate of the output video / canvas render loop.
 * @param smoothing   0–1 smoothing weight (default 0.7).
 */
export function smoothPath(
  rawPoints: Array<{ time: number; position: Vec2; confidence: number }>,
  outputFPS: number,
  smoothing = 0.7
): SmoothedPoint[] {
  if (rawPoints.length === 0) return [];
  if (rawPoints.length === 1) {
    return [
      {
        time: rawPoints[0].time,
        x: rawPoints[0].position.x,
        y: rawPoints[0].position.y,
        confidence: rawPoints[0].confidence,
      },
    ];
  }

  // ── Step 1: Thin to every 3rd point as control vertices ──────────────────
  const ctrl: Array<{ time: number; x: number; y: number; confidence: number }> = [];
  for (let i = 0; i < rawPoints.length; i += 3) {
    const p = rawPoints[i];
    ctrl.push({ time: p.time, x: p.position.x, y: p.position.y, confidence: p.confidence });
  }
  // Always include the very last raw point so the path reaches the end.
  const last = rawPoints[rawPoints.length - 1];
  if (ctrl[ctrl.length - 1].time < last.time) {
    ctrl.push({ time: last.time, x: last.position.x, y: last.position.y, confidence: last.confidence });
  }

  if (ctrl.length < 2) {
    return ctrl.map((c) => ({ time: c.time, x: c.x, y: c.y, confidence: c.confidence }));
  }

  // ── Step 2 & 3: Evaluate cubic segments at outputFPS resolution ───────────
  const frameInterval = 1 / outputFPS;
  const result: SmoothedPoint[] = [];

  const totalDuration = ctrl[ctrl.length - 1].time - ctrl[0].time;
  if (totalDuration <= 0) {
    return ctrl.map((c) => ({ time: c.time, x: c.x, y: c.y, confidence: c.confidence }));
  }

  const totalOutputFrames = Math.max(1, Math.round(totalDuration * outputFPS));

  for (let fi = 0; fi <= totalOutputFrames; fi++) {
    const t = ctrl[0].time + (fi / totalOutputFrames) * totalDuration;

    // Find the segment that contains time t
    let segIdx = 0;
    for (let s = 0; s < ctrl.length - 2; s++) {
      if (ctrl[s + 1].time >= t) {
        segIdx = s;
        break;
      }
      segIdx = s;
    }
    // Clamp
    segIdx = Math.min(segIdx, ctrl.length - 2);

    // Four Catmull-Rom control points (with clamped boundary access)
    const i0 = Math.max(0, segIdx - 1);
    const i1 = segIdx;
    const i2 = segIdx + 1;
    const i3 = Math.min(ctrl.length - 1, segIdx + 2);

    const P0 = ctrl[i0];
    const P1 = ctrl[i1];
    const P2 = ctrl[i2];
    const P3 = ctrl[i3];

    // Normalised t within this segment [0, 1]
    const segDuration = P2.time - P1.time;
    const localT = segDuration > 0 ? Math.max(0, Math.min(1, (t - P1.time) / segDuration)) : 0;

    // Cubic Bézier handles derived from Catmull-Rom tangents:
    //   CP1 = P1 + (P2 - P0) / 6
    //   CP2 = P2 - (P3 - P1) / 6
    const bx1 = P1.x + (P2.x - P0.x) / 6;
    const by1 = P1.y + (P2.y - P0.y) / 6;
    const bx2 = P2.x - (P3.x - P1.x) / 6;
    const by2 = P2.y - (P3.y - P1.y) / 6;

    // Evaluate cubic Bézier B(localT)
    const mt = 1 - localT;
    const x =
      mt * mt * mt * P1.x +
      3 * mt * mt * localT * bx1 +
      3 * mt * localT * localT * bx2 +
      localT * localT * localT * P2.x;
    const y =
      mt * mt * mt * P1.y +
      3 * mt * mt * localT * by1 +
      3 * mt * localT * localT * by2 +
      localT * localT * localT * P2.y;

    // Interpolate confidence
    const confidence = P1.confidence + (P2.confidence - P1.confidence) * localT;

    result.push({ time: t, x, y, confidence });
  }

  // ── Step 4: Optional exponential smoothing pass ───────────────────────────
  const alpha = Math.max(0, Math.min(1, smoothing));
  if (alpha > 0 && result.length > 1) {
    // Forward pass
    for (let i = 1; i < result.length; i++) {
      result[i].x = result[i - 1].x + (1 - alpha) * (result[i].x - result[i - 1].x);
      result[i].y = result[i - 1].y + (1 - alpha) * (result[i].y - result[i - 1].y);
    }
    // Backward pass (zero-phase filtering)
    for (let i = result.length - 2; i >= 0; i--) {
      result[i].x = result[i + 1].x + (1 - alpha) * (result[i].x - result[i + 1].x);
      result[i].y = result[i + 1].y + (1 - alpha) * (result[i].y - result[i + 1].y);
    }
  }

  return result;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Return a Color with a different alpha value, leaving r/g/b intact. */
function withAlpha(c: Color, a: number): Color {
  return { r: c.r, g: c.g, b: c.b, a };
}

/**
 * Compute the sine-eased click-pulse scale factor for cursor size.
 * Returns a value in [0.85, 1.0] — smallest at the midpoint of the animation.
 *
 * @param progress  0 → 1 progress through the pulse animation.
 */
function clickPulseScale(progress: number): number {
  // sin(π·t) gives a smooth arch; map [0,1] → [1, 0.85, 1]
  return 1 - 0.15 * Math.sin(Math.PI * progress);
}

// ─── CursorEngine ─────────────────────────────────────────────────────────────

/**
 * CursorEngine manages a smoothed cursor path and renders replacement cursors,
 * trails, and click-ripple effects onto a Canvas 2D context.
 *
 * Typical usage:
 * ```ts
 * const engine = new CursorEngine(CURSOR_PRESETS.modern, RIPPLE_PRESETS.subtle);
 * engine.setPath(analysisResult.cursorPath, 60);
 * engine.setClicks(analysisResult.clicks);
 *
 * // inside render loop:
 * engine.renderAll(ctx, currentTime, devicePixelRatio);
 * ```
 */
export class CursorEngine {
  private readonly _config: CursorConfig;
  private readonly _rippleConfig: RippleConfig;

  /** Smoothed cursor positions at outputFPS resolution. */
  private _smoothed: SmoothedPoint[] = [];

  /** Detected click events. */
  private _clicks: DetectedClick[] = [];

  /** Duration of the click pulse animation in seconds. */
  private static readonly CLICK_PULSE_DURATION = 0.25;

  constructor(config: CursorConfig, rippleConfig?: RippleConfig) {
    this._config = config;
    this._rippleConfig = rippleConfig ?? {
      color: { r: 255, g: 255, b: 255, a: 0.6 },
      maxRadius: 30,
      rings: 2,
      duration: 0.6,
      strokeWidth: 2,
    };
  }

  // ── Path & click setup ──────────────────────────────────────────────────────

  /**
   * Smooth the raw CursorPath from the VideoAnalyzer and store it internally.
   *
   * @param cursorPath  Raw path as returned by `VideoAnalyzer.analyze()`.
   * @param outputFPS   Frames per second of the output timeline.
   */
  setPath(cursorPath: CursorPath, outputFPS: number): void {
    this._smoothed = smoothPath(
      cursorPath.points,
      outputFPS,
      this._config.smoothing ?? 0.7
    );
  }

  /**
   * Store detected click events.  These drive both the cursor size-pulse and
   * the ripple animations.
   */
  setClicks(clicks: DetectedClick[]): void {
    // Keep a sorted copy so binary search is valid.
    this._clicks = [...clicks].sort((a, b) => a.time - b.time);
  }

  // ── Query helpers ───────────────────────────────────────────────────────────

  /**
   * Get the smoothed cursor position at a given video time (in seconds).
   * Returns `null` if no path has been set or the time is out of range.
   */
  getPositionAtTime(time: number): { x: number; y: number } | null {
    const pt = this._interpolateAt(time);
    if (!pt) return null;
    return { x: pt.x, y: pt.y };
  }

  /**
   * Get the last N smoothed positions preceding `time` for trail rendering.
   * N is controlled by `CursorConfig.trailLength` (default 8).
   */
  getTrailAtTime(time: number): SmoothedPoint[] {
    if (this._smoothed.length === 0) return [];

    const trailLength = this._config.trailLength ?? 8;
    const idx = this._indexBefore(time);
    if (idx < 0) return [];

    const start = Math.max(0, idx - trailLength + 1);
    return this._smoothed.slice(start, idx + 1);
  }

  /**
   * Get all currently active ripple animations at `time`.
   *
   * Each entry carries:
   * - `x`, `y` — canvas position of the click (in normalised 0-1 coords from
   *   the original video — callers must scale to canvas size).
   * - `progress` — 0 (just started) → 1 (fully expanded and faded).
   */
  getActiveRipples(
    time: number
  ): Array<{ x: number; y: number; progress: number }> {
    const duration = this._rippleConfig.duration;
    const active: Array<{ x: number; y: number; progress: number }> = [];

    for (const click of this._clicks) {
      const elapsed = time - click.time;
      if (elapsed < 0 || elapsed > duration) continue;
      active.push({
        x: click.position.x,
        y: click.position.y,
        progress: elapsed / duration,
      });
    }

    return active;
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  /**
   * Render the replacement cursor at the position corresponding to `time`.
   * Does nothing if the cursor position is unknown at that time.
   *
   * @param ctx    Canvas 2D rendering context.
   * @param time   Current playback time in seconds.
   * @param scale  Device pixel ratio or canvas scale factor (default 1).
   */
  renderCursor(
    ctx: CanvasRenderingContext2D,
    time: number,
    scale = 1
  ): void {
    const pt = this._interpolateAt(time);
    if (!pt) return;

    // Convert normalised 0-1 coords to canvas pixels
    const cx = pt.x * ctx.canvas.width;
    const cy = pt.y * ctx.canvas.height;

    // Determine click-pulse scale
    const pulseScale = this._getClickPulseScale(time);
    const size = this._config.size * scale * pulseScale;

    ctx.save();
    ctx.translate(cx, cy);

    switch (this._config.style) {
      case "default":
        this._drawArrowCursor(ctx, size);
        break;
      case "pointer":
        this._drawPointerCursor(ctx, size);
        break;
      case "dot":
        this._drawDotCursor(ctx, size);
        break;
      case "ring":
        this._drawRingCursor(ctx, size);
        break;
      case "crosshair":
        this._drawCrosshairCursor(ctx, size);
        break;
    }

    ctx.restore();
  }

  /**
   * Render a fading trail of past cursor positions behind the current position.
   * Only renders when `CursorConfig.showTrail` is true.
   *
   * Uses quadratic Bézier curves between consecutive trail points for a smooth,
   * continuous ribbon effect.
   */
  renderTrail(
    ctx: CanvasRenderingContext2D,
    time: number,
    scale = 1
  ): void {
    if (!this._config.showTrail) return;

    const trail = this.getTrailAtTime(time);
    if (trail.length < 2) return;

    const baseColor = this._config.trailColor ?? withAlpha(this._config.color, 0.4);
    const strokeWidth = Math.max(1, (this._config.size * scale) / 6);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Draw segments from oldest to newest, fading opacity as we approach current position
    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1];
      const p1 = trail[i];

      // Progress through the trail: 0 = oldest, 1 = most recent
      const trailProgress = i / (trail.length - 1);
      const opacity = trailProgress * trailProgress * baseColor.a; // quadratic fade

      const x0 = p0.x * ctx.canvas.width;
      const y0 = p0.y * ctx.canvas.height;
      const x1 = p1.x * ctx.canvas.width;
      const y1 = p1.y * ctx.canvas.height;

      if (i === 1 || trail.length === 2) {
        // Simple line for the first segment
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      } else {
        // Quadratic Bézier through midpoints for smooth ribbon
        const xMid = (x0 + x1) / 2;
        const yMid = (y0 + y1) / 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x0, y0, xMid, yMid);
      }

      ctx.strokeStyle = colorToCSS(withAlpha(baseColor, opacity));
      ctx.lineWidth = strokeWidth * trailProgress;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Render expanding concentric ripple rings at each active click position.
   *
   * Each ring expands from radius 0 to `RippleConfig.maxRadius` over
   * `RippleConfig.duration` seconds, with opacity fading from 1 → 0 and
   * stroke width tapering as the ring expands.
   */
  renderRipples(
    ctx: CanvasRenderingContext2D,
    time: number,
    scale = 1
  ): void {
    const ripples = this.getActiveRipples(time);
    if (ripples.length === 0) return;

    const { color, maxRadius, rings, strokeWidth } = this._rippleConfig;

    ctx.save();
    ctx.lineCap = "round";

    for (const ripple of ripples) {
      const cx = ripple.x * ctx.canvas.width;
      const cy = ripple.y * ctx.canvas.height;

      for (let ring = 0; ring < rings; ring++) {
        // Stagger rings so they expand at slightly different phases
        const ringPhase = ring / rings;
        const ringProgress = Math.max(0, Math.min(1, ripple.progress - ringPhase * 0.2));

        if (ringProgress <= 0) continue;

        const radius = ringProgress * maxRadius * scale;
        const opacity = (1 - ringProgress) * color.a;
        const ringStrokeWidth = strokeWidth * scale * (1 - ringProgress * 0.6);

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = colorToCSS(withAlpha(color, opacity));
        ctx.lineWidth = Math.max(0.5, ringStrokeWidth);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Convenience method: renders trail → cursor → ripples in the correct
   * painter's-order (trail behind, ripples in front).
   */
  renderAll(
    ctx: CanvasRenderingContext2D,
    time: number,
    scale = 1
  ): void {
    this.renderTrail(ctx, time, scale);
    this.renderCursor(ctx, time, scale);
    this.renderRipples(ctx, time, scale);
  }

  // ── Private cursor-shape drawing ────────────────────────────────────────────

  /**
   * macOS-style arrow cursor.
   * The hotspot is the top-left tip of the arrow, so the path is drawn with
   * the origin at (0,0) and the body extending down-right.
   */
  private _drawArrowCursor(ctx: CanvasRenderingContext2D, size: number): void {
    const s = size;
    const primary = colorToCSS(this._config.color);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, s * 0.85);
    ctx.lineTo(s * 0.25, s * 0.6);
    ctx.lineTo(s * 0.45, s);
    ctx.lineTo(s * 0.55, s * 0.96);
    ctx.lineTo(s * 0.35, s * 0.56);
    ctx.lineTo(s * 0.6, s * 0.56);
    ctx.closePath();

    // White border for visibility against any background
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = size * 0.07;
    ctx.lineJoin = "round";
    ctx.stroke();

    ctx.fillStyle = primary;
    ctx.fill();
  }

  /**
   * Hand/pointer cursor (index finger extended).
   * Origin is at the fingertip hotspot.
   */
  private _drawPointerCursor(ctx: CanvasRenderingContext2D, size: number): void {
    const s = size;
    const primary = colorToCSS(this._config.color);

    // Simplified hand shape: a rounded rectangle palm + finger
    const palmW = s * 0.55;
    const palmH = s * 0.5;
    const fingerW = s * 0.2;
    const fingerH = s * 0.55;
    const palmX = -palmW / 2;
    const palmY = s * 0.35;

    ctx.beginPath();
    // Finger
    ctx.roundRect(-fingerW / 2, 0, fingerW, fingerH, fingerW / 2);
    ctx.fillStyle = primary;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = size * 0.06;
    ctx.stroke();
    ctx.fill();

    // Palm
    ctx.beginPath();
    ctx.roundRect(palmX, palmY, palmW, palmH, s * 0.1);
    ctx.stroke();
    ctx.fill();
  }

  /**
   * Filled circle with a subtle radial glow.
   * Origin is at the center of the dot.
   */
  private _drawDotCursor(ctx: CanvasRenderingContext2D, size: number): void {
    const radius = size / 2;
    const primary = this._config.color;

    // Outer glow
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.8);
    glow.addColorStop(0, colorToCSS(withAlpha(primary, primary.a * 0.4)));
    glow.addColorStop(1, colorToCSS(withAlpha(primary, 0)));
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Solid dot
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = colorToCSS(primary);
    ctx.fill();
  }

  /**
   * Circle outline with a small center dot.
   * Uses `secondaryColor` for the center dot (falls back to cursor color).
   * Origin is at the center.
   */
  private _drawRingCursor(ctx: CanvasRenderingContext2D, size: number): void {
    const radius = size / 2;
    const secondary = this._config.secondaryColor ?? this._config.color;

    // Ring
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = colorToCSS(this._config.color);
    ctx.lineWidth = Math.max(1.5, size * 0.07);
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(2, size * 0.1), 0, Math.PI * 2);
    ctx.fillStyle = colorToCSS(secondary);
    ctx.fill();
  }

  /**
   * Plus-sign crosshair.
   * Uses `secondaryColor` for the inner gap highlight.
   * Origin is at the center intersection.
   */
  private _drawCrosshairCursor(ctx: CanvasRenderingContext2D, size: number): void {
    const half = size / 2;
    const gap = size * 0.15; // gap around center
    const lineWidth = Math.max(1.5, size * 0.07);

    ctx.strokeStyle = colorToCSS(this._config.color);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";

    // Horizontal bar (left segment + right segment, with center gap)
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(-gap, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(gap, 0);
    ctx.lineTo(half, 0);
    ctx.stroke();

    // Vertical bar
    ctx.beginPath();
    ctx.moveTo(0, -half);
    ctx.lineTo(0, -gap);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, gap);
    ctx.lineTo(0, half);
    ctx.stroke();

    // Center dot accent
    const accentColor = this._config.secondaryColor ?? this._config.color;
    ctx.beginPath();
    ctx.arc(0, 0, gap * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = colorToCSS(accentColor);
    ctx.fill();
  }

  // ── Private utility methods ─────────────────────────────────────────────────

  /**
   * Binary-search for the last SmoothedPoint whose `time` is ≤ `t`.
   * Returns -1 if the array is empty or all points are after `t`.
   */
  private _indexBefore(t: number): number {
    const pts = this._smoothed;
    if (pts.length === 0) return -1;
    if (t < pts[0].time) return -1;
    if (t >= pts[pts.length - 1].time) return pts.length - 1;

    let lo = 0;
    let hi = pts.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].time <= t) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  /**
   * Return a linearly-interpolated SmoothedPoint at the exact time `t`.
   * Returns `null` if the path is empty or `t` is out of range.
   */
  private _interpolateAt(t: number): SmoothedPoint | null {
    const pts = this._smoothed;
    if (pts.length === 0) return null;

    const idx = this._indexBefore(t);
    if (idx < 0) return null;
    if (idx === pts.length - 1) return pts[idx];

    const p0 = pts[idx];
    const p1 = pts[idx + 1];
    const span = p1.time - p0.time;
    const alpha = span > 0 ? (t - p0.time) / span : 0;

    return {
      time: t,
      x: p0.x + (p1.x - p0.x) * alpha,
      y: p0.y + (p1.y - p0.y) * alpha,
      confidence: p0.confidence + (p1.confidence - p0.confidence) * alpha,
    };
  }

  /**
   * Determine whether a click is currently active at `time` and return the
   * normalised progress [0, 1] through the pulse animation.
   * Returns 0 (= no pulse) when no click is active.
   */
  private _getClickProgress(time: number): number {
    const pulseDuration = CursorEngine.CLICK_PULSE_DURATION;

    for (const click of this._clicks) {
      const elapsed = time - click.time;
      if (elapsed >= 0 && elapsed < pulseDuration) {
        return elapsed / pulseDuration;
      }
    }
    return 0;
  }

  /**
   * Return the cursor size scale factor [0.85, 1.0] for the current time.
   * 1.0 = normal size, smaller during click animation.
   */
  private _getClickPulseScale(time: number): number {
    const progress = this._getClickProgress(time);
    return progress > 0 ? clickPulseScale(progress) : 1.0;
  }
}

// ─── Preset color constants ───────────────────────────────────────────────────

const white: Color = { r: 255, g: 255, b: 255, a: 1 };
const black: Color = { r: 0, g: 0, b: 0, a: 1 };
const violet: Color = { r: 99, g: 102, b: 241, a: 1 };
const yellow: Color = { r: 250, g: 204, b: 21, a: 1 };

/** White at 60% opacity — used for subtle ripples over light and dark content. */
const whiteAlpha: Color = { r: 255, g: 255, b: 255, a: 0.6 };

/** Violet at 50% opacity — used for branded ripples. */
const violetAlpha: Color = { r: 99, g: 102, b: 241, a: 0.5 };

// ─── Cursor presets ───────────────────────────────────────────────────────────

/**
 * Ready-made CursorConfig presets.
 *
 * ```ts
 * const engine = new CursorEngine(CURSOR_PRESETS.modern, RIPPLE_PRESETS.subtle);
 * ```
 */
export const CURSOR_PRESETS: Record<string, CursorConfig> = {
  /**
   * Glowing white dot with short trail — great for dark backgrounds and SaaS
   * product demos where you want the cursor to pop.
   */
  modern: {
    style: "dot",
    size: 20,
    color: white,
    showTrail: true,
    trailLength: 8,
  },

  /**
   * Classic macOS arrow in black — appropriate for tutorials and screencasts
   * where users should focus on the content, not the cursor.
   */
  professional: {
    style: "default",
    size: 24,
    color: black,
    showTrail: false,
  },

  /**
   * Violet ring cursor — minimal footprint, on-brand for the Spotlight accent
   * color, works well over both light and dark UI.
   */
  minimal: {
    style: "ring",
    size: 28,
    color: violet,
    showTrail: false,
  },

  /**
   * Large yellow dot with long trail — maximises cursor visibility for
   * highlight-style demo videos.
   */
  highlight: {
    style: "dot",
    size: 32,
    color: yellow,
    showTrail: true,
    trailLength: 12,
  },
} as const;

// ─── Ripple presets ───────────────────────────────────────────────────────────

/**
 * Ready-made RippleConfig presets.
 */
export const RIPPLE_PRESETS: Record<string, RippleConfig> = {
  /**
   * Soft, small two-ring ripple — barely noticeable on first viewing but
   * reassures viewers that a click happened.
   */
  subtle: {
    color: whiteAlpha,
    maxRadius: 30,
    rings: 2,
    duration: 0.6,
    strokeWidth: 2,
  },

  /**
   * Large three-ring branded ripple in violet — draws clear attention to
   * every click; ideal for click-by-click tutorials.
   */
  bold: {
    color: violetAlpha,
    maxRadius: 50,
    rings: 3,
    duration: 0.8,
    strokeWidth: 3,
  },

  /**
   * Single ultra-fast ring — the smallest possible ripple feedback; keeps the
   * viewer's focus firmly on the UI being demonstrated.
   */
  minimal: {
    color: whiteAlpha,
    maxRadius: 20,
    rings: 1,
    duration: 0.4,
    strokeWidth: 1,
  },
} as const;
