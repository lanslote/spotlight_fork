/**
 * camera-system.ts
 *
 * Virtual camera system for Spotlight's screen recording enhancement.
 *
 * Provides:
 *  - Auto-zoom on detected clicks
 *  - Auto-pan when the cursor crosses screen-third boundaries
 *  - Ken Burns ambient zoom during idle segments
 *  - Focus blur (depth-of-field) around the camera target
 *  - Canvas 2D transform application with clamped viewport
 *
 * All positions use normalised coordinates (0-1) relative to the source frame.
 * Time values are in seconds.
 */

import {
  SpringSimulator,
  Spring2D,
  CAMERA_SPRING,
  GENTLE_SPRING,
} from "./spring-physics";

import type {
  DetectedClick,
  CursorPath,
  SceneSegment,
} from "./video-analyzer";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Camera center position and transform parameters. */
export interface CameraState {
  /** Camera center X in normalised coordinates (0-1, left→right). */
  x: number;
  /** Camera center Y in normalised coordinates (0-1, top→bottom). */
  y: number;
  /** Zoom level. 1.0 = no zoom, 2.5 = zoomed in 2.5×. */
  zoom: number;
  /** Rotation in degrees. Used for subtle Ken Burns drift. */
  rotation: number;
}

/** A time-stamped camera pose, optionally with a hold duration and easing hint. */
export interface CameraKeyframe {
  /** Time in seconds at which this state is reached. */
  time: number;
  /** The target camera state at this keyframe. */
  state: CameraState;
  /**
   * How long (seconds) to hold this state before the next transition begins.
   * Defaults to 0 (transition starts immediately after this keyframe).
   */
  holdDuration?: number;
  /**
   * Easing style for the transition arriving at this keyframe.
   * - "spring"   – physics-based spring (default, most natural)
   * - "ease-out" – cubic ease-out for quick snaps
   * - "linear"   – constant velocity, useful for Ken Burns
   */
  easing?: "spring" | "linear" | "ease-out";
}

/** Configuration for the CameraSystem. */
export interface CameraConfig {
  /** Width of the source video/canvas in pixels. */
  sourceWidth: number;
  /** Height of the source video/canvas in pixels. */
  sourceHeight: number;
  /** Maximum allowed zoom level. Defaults to 2.5. */
  maxZoom?: number;
  /** Minimum allowed zoom level. Defaults to 1.0. */
  minZoom?: number;
  /** Zoom level applied when a click is detected. Defaults to 2.0. */
  clickZoom?: number;
  /** Seconds to hold click-zoom before returning to normal. Defaults to 1.5. */
  clickHoldDuration?: number;
  /** Ken Burns zoom factor during idle segments. Defaults to 1.05. */
  kenBurnsZoom?: number;
  /** Duration of one Ken Burns pass (seconds). Defaults to 3.0. */
  kenBurnsDuration?: number;
  /**
   * Whether to generate auto-pan keyframes when the cursor crosses
   * screen-third boundaries. Defaults to true.
   */
  autoPan?: boolean;
  /** Override the spring config used for camera movements. */
  springConfig?: { stiffness: number; damping: number; mass: number };
}

/** Options for the focus-blur (depth-of-field) effect. */
export interface FocusBlurConfig {
  /** Blur radius in CSS pixels applied to the defocused region. Defaults to 3. */
  blurRadius?: number;
  /**
   * Diameter of the sharp focus region as a fraction of the shortest viewport
   * dimension. Defaults to 0.3 (30 %).
   */
  focusSize?: number;
  /** Whether the focus-blur effect is active. Defaults to true. */
  enabled?: boolean;
}

// ─── Utility types ───────────────────────────────────────────────────────────

/** Column or row index within the 3×3 screen-thirds grid. */
export type ThirdIndex = 0 | 1 | 2;

/** Screen third result from {@link getScreenThird}. */
export interface ScreenThird {
  col: ThirdIndex;
  row: ThirdIndex;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Camera state representing the default unzoomed, centred view. */
const DEFAULT_CAMERA_STATE: Readonly<CameraState> = {
  x: 0.5,
  y: 0.5,
  zoom: 1.0,
  rotation: 0,
};

/** Fraction of the frame that each screen third occupies (1/3). */
const THIRD = 1 / 3;

/**
 * Minimum gap (seconds) between auto-pan keyframes to avoid thrashing when
 * the cursor lingers near a third boundary.
 */
const PAN_DEBOUNCE_SECONDS = 0.5;

/**
 * Simulation time step used when pre-baking spring positions for interpolation.
 * Smaller values are more accurate but produce more keyframes.
 */
const SPRING_BAKE_DT = 1 / 60;

// ─── Standalone helpers ───────────────────────────────────────────────────────

/**
 * Given a normalised position (0-1), returns which column and row of the
 * 3×3 screen-thirds grid it falls in.
 *
 * @param position - Normalised screen coordinate.
 * @returns Column and row indices, each in {0, 1, 2}.
 *
 * @example
 * ```ts
 * getScreenThird({ x: 0.1, y: 0.8 }); // { col: 0, row: 2 }
 * getScreenThird({ x: 0.5, y: 0.5 }); // { col: 1, row: 1 }
 * ```
 */
export function getScreenThird(position: { x: number; y: number }): ScreenThird {
  const col = Math.min(2, Math.floor(position.x / THIRD)) as ThirdIndex;
  const row = Math.min(2, Math.floor(position.y / THIRD)) as ThirdIndex;
  return { col, row };
}

/**
 * Returns the normalised center coordinates for a screen-third cell.
 * Used when generating auto-pan targets.
 *
 * @param col - Column index (0-2).
 * @param row - Row index (0-2).
 * @returns Normalised center {x, y}.
 */
function thirdCenter(col: ThirdIndex, row: ThirdIndex): { x: number; y: number } {
  return {
    x: (col + 0.5) * THIRD,
    y: (row + 0.5) * THIRD,
  };
}

/**
 * Clamps the camera position so that the zoomed viewport remains fully within
 * the source frame boundaries. Preserves the zoom and rotation unchanged.
 *
 * When the zoom level is 1.0 the camera must sit at (0.5, 0.5). As zoom
 * increases the camera center gains room to move — up to a maximum offset of
 * `(1 - 1/zoom) / 2` from the center in each axis.
 *
 * @param state        - Proposed camera state.
 * @param sourceWidth  - Source frame width in pixels (used for aspect-correct clamping).
 * @param sourceHeight - Source frame height in pixels.
 * @returns A new CameraState with x/y clamped so the viewport stays in-bounds.
 */
export function clampCameraPosition(
  state: CameraState,
  sourceWidth: number,
  sourceHeight: number
): CameraState {
  const { zoom, rotation } = state;

  // Half the fraction of the source that is *not* visible at this zoom level.
  // E.g. zoom=2 → half-margin = (1 - 0.5) / 2 = 0.25 in normalised coords.
  const halfMarginX = (1 - 1 / zoom) / 2;
  const halfMarginY = (1 - 1 / zoom) / 2;

  // Clamp camera center so the viewport never exceeds source bounds.
  const minX = 0.5 - halfMarginX;
  const maxX = 0.5 + halfMarginX;
  const minY = 0.5 - halfMarginY;
  const maxY = 0.5 + halfMarginY;

  // Suppress unused-variable lint for sourceWidth/Height — kept for future
  // aspect-ratio-correct clamping (currently symmetric).
  void sourceWidth;
  void sourceHeight;

  return {
    x: Math.max(minX, Math.min(maxX, state.x)),
    y: Math.max(minY, Math.min(maxY, state.y)),
    zoom,
    rotation,
  };
}

/**
 * Apply a cubic ease-out function to a linear `t` value (0-1).
 *
 * @param t - Linear progress in [0, 1].
 * @returns Eased value in [0, 1].
 */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Linearly interpolate between two numbers.
 *
 * @param a  - Start value.
 * @param b  - End value.
 * @param t  - Blend factor in [0, 1].
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Applies a spring transition from `from` to `to`, baking it into a series
 * of evenly-spaced time+value samples. Useful for pre-computing camera paths
 * that need spring character without maintaining live simulator state.
 *
 * @param from     - Start value.
 * @param to       - Target value.
 * @param config   - Spring configuration.
 * @param maxTime  - Maximum seconds to simulate before giving up.
 * @returns Array of {t, value} samples.
 */
function bakeSpringCurve(
  from: number,
  to: number,
  config: { stiffness: number; damping: number; mass: number },
  maxTime = 3
): Array<{ t: number; value: number }> {
  const sim = new SpringSimulator(config);
  sim.setValue(from);
  sim.setTarget(to);

  const samples: Array<{ t: number; value: number }> = [{ t: 0, value: from }];
  let elapsed = 0;

  while (elapsed < maxTime) {
    elapsed += SPRING_BAKE_DT;
    const value = sim.update(SPRING_BAKE_DT);
    samples.push({ t: elapsed, value });
    if (sim.isSettled()) break;
  }

  return samples;
}

/**
 * Sample a baked spring curve at an arbitrary time `t` using linear
 * interpolation between adjacent samples.
 *
 * @param samples - Output of {@link bakeSpringCurve}.
 * @param t       - Time in seconds to sample.
 * @returns Interpolated value.
 */
function sampleBakedCurve(
  samples: Array<{ t: number; value: number }>,
  t: number
): number {
  if (samples.length === 0) return 0;
  if (t <= samples[0].t) return samples[0].value;
  if (t >= samples[samples.length - 1].t) return samples[samples.length - 1].value;

  // Binary search for the surrounding pair.
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= t) lo = mid;
    else hi = mid;
  }

  const span = samples[hi].t - samples[lo].t;
  if (span === 0) return samples[lo].value;
  const alpha = (t - samples[lo].t) / span;
  return lerp(samples[lo].value, samples[hi].value, alpha);
}

/**
 * Draw the focus-blur depth-of-field effect onto a canvas context.
 *
 * Technique:
 * 1. Draw the full source frame with a blur filter applied.
 * 2. Clip an elliptical (circular) focus region around `focusCenter`.
 * 3. Re-draw the source frame at full sharpness inside the clip.
 *
 * @param ctx          - Destination rendering context.
 * @param sourceCanvas - The unmodified source frame canvas.
 * @param focusCenter  - Focus point in normalised coordinates (0-1).
 * @param config       - Focus-blur configuration.
 */
export function applyFocusBlur(
  ctx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  focusCenter: { x: number; y: number },
  config: FocusBlurConfig
): void {
  const {
    blurRadius = 3,
    focusSize = 0.3,
    enabled = true,
  } = config;

  if (!enabled) {
    ctx.drawImage(sourceCanvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }

  const { width, height } = ctx.canvas;

  // ── Step 1: draw blurred background ──────────────────────────────────────
  ctx.save();
  ctx.filter = `blur(${blurRadius}px)`;
  ctx.drawImage(sourceCanvas, 0, 0, width, height);
  ctx.filter = "none";
  ctx.restore();

  // ── Step 2: draw sharp focus region ──────────────────────────────────────
  // The focus radius is relative to the shorter canvas dimension.
  const focusRadiusPx = (Math.min(width, height) * focusSize) / 2;
  const focusCenterPx = {
    x: focusCenter.x * width,
    y: focusCenter.y * height,
  };

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    focusCenterPx.x,
    focusCenterPx.y,
    focusRadiusPx,
    focusRadiusPx,
    0,
    0,
    Math.PI * 2
  );
  ctx.clip();

  // Draw the source at full quality inside the clipping region.
  ctx.drawImage(sourceCanvas, 0, 0, width, height);
  ctx.restore();
}

// ─── CameraSystem class ───────────────────────────────────────────────────────

/**
 * Manages the virtual camera for screen recording post-processing.
 *
 * Typical usage:
 * ```ts
 * const camera = new CameraSystem({ sourceWidth: 1920, sourceHeight: 1080 });
 * camera.generateKeyframes(analysis.clicks, analysis.cursorPath, analysis.segments);
 *
 * // In render loop:
 * const state = camera.getStateAtTime(currentTime);
 * camera.applyToContext(ctx, state);
 * ```
 */
export class CameraSystem {
  private readonly _cfg: Required<CameraConfig>;
  private _keyframes: CameraKeyframe[] = [];

  // Live spring simulators — used by getStateAtTime for frame-by-frame updates.
  private readonly _panSpring: Spring2D;
  private readonly _zoomSpring: SpringSimulator;

  // Cached spring config (merged with any override from config).
  private readonly _springConfig: { stiffness: number; damping: number; mass: number };

  constructor(config: CameraConfig) {
    this._cfg = {
      sourceWidth: config.sourceWidth,
      sourceHeight: config.sourceHeight,
      maxZoom: config.maxZoom ?? 2.5,
      minZoom: config.minZoom ?? 1.0,
      clickZoom: config.clickZoom ?? 2.0,
      clickHoldDuration: config.clickHoldDuration ?? 1.5,
      kenBurnsZoom: config.kenBurnsZoom ?? 1.05,
      kenBurnsDuration: config.kenBurnsDuration ?? 3.0,
      autoPan: config.autoPan ?? true,
      springConfig: config.springConfig ?? CAMERA_SPRING,
    };

    this._springConfig = this._cfg.springConfig;

    this._panSpring = new Spring2D(this._springConfig);
    this._panSpring.reset(DEFAULT_CAMERA_STATE.x, DEFAULT_CAMERA_STATE.y);

    this._zoomSpring = new SpringSimulator(this._springConfig);
    this._zoomSpring.reset(DEFAULT_CAMERA_STATE.zoom);
  }

  // ── Public API: keyframe management ─────────────────────────────────────

  /**
   * Replace all keyframes with a new set, sorted by time.
   *
   * @param keyframes - Full replacement keyframe list.
   */
  setKeyframes(keyframes: CameraKeyframe[]): void {
    this._keyframes = [...keyframes].sort((a, b) => a.time - b.time);
  }

  /**
   * Insert a single keyframe into the sorted keyframe list.
   * If a keyframe at the same time already exists it is replaced.
   *
   * @param keyframe - Keyframe to add.
   */
  addKeyframe(keyframe: CameraKeyframe): void {
    // Remove any existing keyframe at the exact same time.
    this._keyframes = this._keyframes.filter((k) => k.time !== keyframe.time);
    this._keyframes.push(keyframe);
    this._keyframes.sort((a, b) => a.time - b.time);
  }

  /**
   * Remove the keyframe whose `time` exactly matches the given value.
   * No-op if no such keyframe exists.
   *
   * @param time - Time in seconds of the keyframe to remove.
   */
  removeKeyframe(time: number): void {
    this._keyframes = this._keyframes.filter((k) => k.time !== time);
  }

  /**
   * Return a copy of all current keyframes, sorted by time.
   */
  getKeyframes(): ReadonlyArray<CameraKeyframe> {
    return this._keyframes;
  }

  // ── Keyframe generation ──────────────────────────────────────────────────

  /**
   * Auto-generate camera keyframes from video analysis data.
   *
   * Generation rules (applied in order, de-duplicated afterwards):
   *
   * 1. **Scroll segments** – camera returns to center at zoom 1.0.
   * 2. **Click events** – zoom in to `clickZoom` at click position, hold
   *    `clickHoldDuration` seconds, then zoom back out.
   * 3. **Auto-pan** – when the cursor crosses a screen-third boundary, add a
   *    pan keyframe toward the new third's center.
   * 4. **Idle / Ken Burns** – during idle segments, slowly zoom from 1.0 to
   *    `kenBurnsZoom` with a slight rotation for ambient motion.
   *
   * @param clicks      - Detected click events from the video analyzer.
   * @param cursorPath  - Detected cursor path.
   * @param segments    - Detected scene segments.
   * @returns Sorted, de-duplicated array of camera keyframes.
   */
  generateKeyframes(
    clicks: DetectedClick[],
    cursorPath: CursorPath,
    segments: SceneSegment[]
  ): CameraKeyframe[] {
    const kfs: CameraKeyframe[] = [];

    // Always start at the default state.
    kfs.push({
      time: 0,
      state: { ...DEFAULT_CAMERA_STATE },
      easing: "spring",
    });

    // ── 1. Scroll segments → reset to center ────────────────────────────
    for (const seg of segments) {
      if (seg.type !== "scroll") continue;

      kfs.push({
        time: seg.startTime,
        state: { ...DEFAULT_CAMERA_STATE },
        easing: "spring",
      });
    }

    // ── 2. Click events → zoom in, hold, zoom out ────────────────────────
    const { clickZoom, clickHoldDuration, maxZoom, minZoom } = this._cfg;
    const clampedClickZoom = Math.min(maxZoom, Math.max(minZoom, clickZoom));

    for (const click of clicks) {
      // Zoom-in keyframe at the click position.
      const clickState: CameraState = clampCameraPosition(
        {
          x: click.position.x,
          y: click.position.y,
          zoom: clampedClickZoom,
          rotation: 0,
        },
        this._cfg.sourceWidth,
        this._cfg.sourceHeight
      );

      kfs.push({
        time: click.time,
        state: clickState,
        holdDuration: clickHoldDuration,
        easing: "spring",
      });

      // Zoom-out keyframe after hold duration.
      const releaseTime = click.time + clickHoldDuration;
      kfs.push({
        time: releaseTime,
        state: { ...DEFAULT_CAMERA_STATE },
        easing: "spring",
      });
    }

    // ── 3. Auto-pan on cursor third transitions ──────────────────────────
    if (this._cfg.autoPan && cursorPath.points.length > 1) {
      let lastThird = getScreenThird(cursorPath.points[0].position);
      let lastPanTime = -PAN_DEBOUNCE_SECONDS;

      for (const point of cursorPath.points) {
        const third = getScreenThird(point.position);
        const isNewThird = third.col !== lastThird.col || third.row !== lastThird.row;

        if (isNewThird && point.time - lastPanTime >= PAN_DEBOUNCE_SECONDS) {
          const center = thirdCenter(third.col, third.row);

          // Only pan if no click keyframe is very close in time (click wins).
          const nearClick = clicks.some(
            (c) => Math.abs(c.time - point.time) < 0.25
          );

          if (!nearClick) {
            kfs.push({
              time: point.time,
              state: clampCameraPosition(
                {
                  x: center.x,
                  y: center.y,
                  zoom: 1.0,
                  rotation: 0,
                },
                this._cfg.sourceWidth,
                this._cfg.sourceHeight
              ),
              easing: "spring",
            });
          }

          lastThird = third;
          lastPanTime = point.time;
        }
      }
    }

    // ── 4. Ken Burns during idle segments ────────────────────────────────
    const { kenBurnsZoom, kenBurnsDuration } = this._cfg;
    let kbRotationSign = 1; // Alternate rotation direction each idle segment.

    for (const seg of segments) {
      if (seg.type !== "idle") continue;

      const maxRotation = 0.4; // degrees — subtle drift
      const rotation = maxRotation * kbRotationSign;
      kbRotationSign *= -1;

      // Start of idle: zoom at 1.0.
      kfs.push({
        time: seg.startTime,
        state: clampCameraPosition(
          {
            x: DEFAULT_CAMERA_STATE.x,
            y: DEFAULT_CAMERA_STATE.y,
            zoom: 1.0,
            rotation: 0,
          },
          this._cfg.sourceWidth,
          this._cfg.sourceHeight
        ),
        easing: "linear",
      });

      // Peak of Ken Burns: gently zoomed + slight rotation.
      // The peak is either at kenBurnsDuration after the segment start or
      // at the midpoint of the segment, whichever is earlier.
      const peakTime = Math.min(
        seg.startTime + kenBurnsDuration,
        (seg.startTime + seg.endTime) / 2
      );

      kfs.push({
        time: peakTime,
        state: clampCameraPosition(
          {
            x: DEFAULT_CAMERA_STATE.x,
            y: DEFAULT_CAMERA_STATE.y,
            zoom: kenBurnsZoom,
            rotation,
          },
          this._cfg.sourceWidth,
          this._cfg.sourceHeight
        ),
        easing: "linear",
      });

      // End of idle: return to 1.0.
      kfs.push({
        time: seg.endTime,
        state: clampCameraPosition(
          {
            x: DEFAULT_CAMERA_STATE.x,
            y: DEFAULT_CAMERA_STATE.y,
            zoom: 1.0,
            rotation: 0,
          },
          this._cfg.sourceWidth,
          this._cfg.sourceHeight
        ),
        easing: "linear",
      });
    }

    // ── Finalise: sort + de-duplicate ────────────────────────────────────
    kfs.sort((a, b) => a.time - b.time);

    const deduplicated = this._deduplicateKeyframes(kfs);
    this._keyframes = deduplicated;
    return deduplicated;
  }

  // ── State interpolation ─────────────────────────────────────────────────

  /**
   * Compute the interpolated camera state at an arbitrary time.
   *
   * Interpolation strategy:
   * - **zoom**: spring-based (pre-baked spring curve between adjacent keyframe values).
   * - **pan (x, y)**: spring-based via a 2-D spring between adjacent keyframe values.
   * - **rotation**: linear interpolation.
   *
   * The easing hint on the *arriving* keyframe controls the curve shape:
   * - `"spring"` – uses spring physics for natural overshoot.
   * - `"ease-out"` – cubic ease-out, snappier without overshoot.
   * - `"linear"` – constant velocity, good for Ken Burns.
   *
   * @param time - Playback time in seconds.
   * @returns Interpolated, clamped camera state.
   */
  getStateAtTime(time: number): CameraState {
    const kfs = this._keyframes;

    // No keyframes: return default.
    if (kfs.length === 0) return { ...DEFAULT_CAMERA_STATE };

    // Before the first keyframe.
    if (time <= kfs[0].time) return { ...kfs[0].state };

    // After the last keyframe.
    if (time >= kfs[kfs.length - 1].time) {
      return { ...kfs[kfs.length - 1].state };
    }

    // Find surrounding keyframes.
    let prevIdx = 0;
    for (let i = 1; i < kfs.length; i++) {
      if (kfs[i].time > time) break;
      prevIdx = i;
    }

    const prev = kfs[prevIdx];
    const next = kfs[prevIdx + 1];

    // Account for hold duration: while inside the hold window, stay at prev.
    const holdEnd = prev.time + (prev.holdDuration ?? 0);
    if (time <= holdEnd) {
      return { ...prev.state };
    }

    // Transition window: from holdEnd → next.time.
    const transitionDuration = next.time - holdEnd;
    if (transitionDuration <= 0) {
      return { ...next.state };
    }

    const rawT = Math.max(0, Math.min(1, (time - holdEnd) / transitionDuration));
    const easing = next.easing ?? "spring";

    const state = this._interpolateStates(
      prev.state,
      next.state,
      rawT,
      transitionDuration,
      easing
    );

    return clampCameraPosition(state, this._cfg.sourceWidth, this._cfg.sourceHeight);
  }

  // ── Canvas transform application ─────────────────────────────────────────

  /**
   * Apply the camera transform to a Canvas 2D context.
   *
   * Transform order:
   * 1. `translate(viewportCenterX, viewportCenterY)` – pivot around the canvas center.
   * 2. `scale(zoom, zoom)` – apply zoom.
   * 3. `rotate(rotationRadians)` – apply Ken Burns rotation.
   * 4. `translate(-camCenterX, -camCenterY)` – shift so the camera position
   *    maps to the canvas center.
   *
   * The caller is responsible for wrapping this in `ctx.save()` / `ctx.restore()`
   * if they need to reset the transform afterward.
   *
   * @param ctx   - Canvas 2D rendering context to transform.
   * @param state - Camera state to apply.
   */
  applyToContext(ctx: CanvasRenderingContext2D, state: CameraState): void {
    const clamped = clampCameraPosition(state, this._cfg.sourceWidth, this._cfg.sourceHeight);

    const { width, height } = ctx.canvas;
    const { sourceWidth, sourceHeight } = this._cfg;

    // Camera center in source-pixel coordinates.
    const camPixelX = clamped.x * sourceWidth;
    const camPixelY = clamped.y * sourceHeight;

    // Viewport center in canvas pixel coordinates.
    const vpCenterX = width / 2;
    const vpCenterY = height / 2;

    const rotRad = (clamped.rotation * Math.PI) / 180;

    // Apply transform chain.
    ctx.translate(vpCenterX, vpCenterY);
    ctx.scale(clamped.zoom, clamped.zoom);
    ctx.rotate(rotRad);
    ctx.translate(-camPixelX, -camPixelY);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Interpolate between two camera states using the given easing style and
   * linear blend factor `t` (0-1 within the transition window).
   *
   * For "spring" easing the transition duration is used to pre-bake a spring
   * curve and sample it at the correct elapsed time.
   */
  private _interpolateStates(
    from: CameraState,
    to: CameraState,
    t: number,
    transitionDuration: number,
    easing: "spring" | "linear" | "ease-out"
  ): CameraState {
    if (easing === "spring") {
      // Pre-bake spring curves for zoom and each pan axis, sampled at t * duration.
      const elapsed = t * transitionDuration;

      const zoomSamples = bakeSpringCurve(from.zoom, to.zoom, this._springConfig);
      const xSamples = bakeSpringCurve(from.x, to.x, this._springConfig);
      const ySamples = bakeSpringCurve(from.y, to.y, this._springConfig);

      return {
        zoom: sampleBakedCurve(zoomSamples, elapsed),
        x: sampleBakedCurve(xSamples, elapsed),
        y: sampleBakedCurve(ySamples, elapsed),
        // Rotation always linear — spring rotation feels wrong for subtle Ken Burns.
        rotation: lerp(from.rotation, to.rotation, t),
      };
    }

    const easedT = easing === "ease-out" ? easeOut(t) : t;

    return {
      x: lerp(from.x, to.x, easedT),
      y: lerp(from.y, to.y, easedT),
      zoom: lerp(from.zoom, to.zoom, easedT),
      rotation: lerp(from.rotation, to.rotation, easedT),
    };
  }

  /**
   * Merge keyframes that have the same timestamp, keeping the last one
   * (later generation passes take priority), then remove any duplicate
   * consecutive keyframes with identical states.
   */
  private _deduplicateKeyframes(sorted: CameraKeyframe[]): CameraKeyframe[] {
    if (sorted.length === 0) return [];

    // Merge same-time keyframes: last writer wins (generation priority order).
    const byTime = new Map<number, CameraKeyframe>();
    for (const kf of sorted) {
      byTime.set(kf.time, kf);
    }

    const merged = Array.from(byTime.values()).sort((a, b) => a.time - b.time);

    // Remove consecutive keyframes with identical states (no-op transitions).
    const result: CameraKeyframe[] = [merged[0]];
    for (let i = 1; i < merged.length; i++) {
      const prev = result[result.length - 1];
      const curr = merged[i];
      if (!_statesEqual(prev.state, curr.state) || (prev.holdDuration ?? 0) > 0) {
        result.push(curr);
      }
    }

    return result;
  }
}

// ─── Private module helpers ───────────────────────────────────────────────────

/**
 * Returns true when two camera states are equal within floating-point epsilon.
 * Used during keyframe de-duplication.
 */
function _statesEqual(a: CameraState, b: CameraState): boolean {
  const eps = 1e-6;
  return (
    Math.abs(a.x - b.x) < eps &&
    Math.abs(a.y - b.y) < eps &&
    Math.abs(a.zoom - b.zoom) < eps &&
    Math.abs(a.rotation - b.rotation) < eps
  );
}
