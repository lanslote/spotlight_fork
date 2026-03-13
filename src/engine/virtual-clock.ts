/**
 * VirtualClock — deterministic time source for Spotlight's rendering engine.
 *
 * Two operating modes:
 *  - "realtime"  : wraps requestAnimationFrame; currentTime tracks wall-clock
 *                  elapsed since start (minus any paused intervals).
 *  - "stepped"   : time is advanced manually one frame at a time via advance().
 *                  No RAF is used, making it safe for headless / export paths.
 *
 * In both modes every consumer reads time through getCurrentTime() so the rest
 * of the engine is mode-agnostic.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClockMode = "realtime" | "stepped";

export interface ClockState {
  mode: ClockMode;
  fps: number;
  frameDurationMs: number;
  currentFrame: number;
  totalFrames: number;
  currentTimeMs: number;
  isRunning: boolean;
}

export type TickCallback = (state: ClockState) => void;

// ─── VirtualClock ─────────────────────────────────────────────────────────────

export class VirtualClock {
  // Configuration
  private _mode: ClockMode;
  private _fps: number;
  private _frameDurationMs: number;

  // Playback state
  private _currentFrame: number = 0;
  private _totalFrames: number = 0;
  private _currentTimeMs: number = 0;
  private _isRunning: boolean = false;

  // Realtime-mode internals
  private _rafHandle: number | null = null;
  private _wallStartMs: number = 0;       // performance.now() when last started
  private _accumulatedMs: number = 0;     // ms accumulated across pause/resume cycles
  private _lastRafTimestamp: number = 0;  // last RAF timestamp for delta clamping

  // Callbacks
  private _tickCallbacks: TickCallback[] = [];
  private _onComplete: (() => void) | null = null;

  // ── Construction ────────────────────────────────────────────────────────────

  constructor(fps: number = 60, mode: ClockMode = "realtime") {
    if (fps <= 0 || fps > 240) {
      throw new RangeError(`fps must be in (0, 240], got ${fps}`);
    }
    this._fps = fps;
    this._frameDurationMs = 1000 / fps;
    this._mode = mode;
  }

  // ── Public Configuration API ─────────────────────────────────────────────────

  get fps(): number { return this._fps; }
  get frameDurationMs(): number { return this._frameDurationMs; }
  get mode(): ClockMode { return this._mode; }
  get currentFrame(): number { return this._currentFrame; }
  get currentTimeMs(): number { return this._currentTimeMs; }
  get currentTimeSec(): number { return this._currentTimeMs / 1000; }
  get totalFrames(): number { return this._totalFrames; }
  get isRunning(): boolean { return this._isRunning; }

  /**
   * Sets the total number of frames the clock should play before firing
   * onComplete.  0 means loop indefinitely.
   */
  setDuration(totalFrames: number): this {
    this._totalFrames = Math.max(0, totalFrames);
    return this;
  }

  /** Convenience: set duration in seconds. */
  setDurationSeconds(seconds: number): this {
    return this.setDuration(Math.ceil(seconds * this._fps));
  }

  // ── Callback Registration ────────────────────────────────────────────────────

  /** Register a callback that fires every rendered frame. */
  onTick(cb: TickCallback): () => void {
    this._tickCallbacks.push(cb);
    return () => {
      const idx = this._tickCallbacks.indexOf(cb);
      if (idx !== -1) this._tickCallbacks.splice(idx, 1);
    };
  }

  /** Called once when the clock reaches totalFrames (realtime mode only). */
  onComplete(cb: () => void): this {
    this._onComplete = cb;
    return this;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  /** Start or resume the clock. */
  start(): this {
    if (this._isRunning) return this;
    this._isRunning = true;

    if (this._mode === "realtime") {
      this._wallStartMs = performance.now();
      this._lastRafTimestamp = this._wallStartMs;
      this._scheduleRaf();
    }

    return this;
  }

  /** Pause the clock (realtime only — no-op in stepped mode). */
  pause(): this {
    if (!this._isRunning || this._mode !== "realtime") return this;
    this._isRunning = false;

    // Bank the elapsed time so resume picks up where we left off.
    this._accumulatedMs += performance.now() - this._wallStartMs;

    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }

    return this;
  }

  /** Toggle between play and pause (realtime only). */
  toggle(): this {
    return this._isRunning ? this.pause() : this.start();
  }

  /**
   * Hard-reset to frame 0.  Cancels any in-flight RAF loop.
   */
  reset(): this {
    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
    this._isRunning = false;
    this._currentFrame = 0;
    this._currentTimeMs = 0;
    this._accumulatedMs = 0;
    this._wallStartMs = 0;
    this._lastRafTimestamp = 0;
    return this;
  }

  // ── Stepped-mode API ─────────────────────────────────────────────────────────

  /**
   * Advance exactly one frame in stepped mode.
   * Throws if called in realtime mode.
   * Returns false when the sequence is complete (totalFrames reached).
   */
  advance(): boolean {
    if (this._mode !== "stepped") {
      throw new Error("advance() is only valid in stepped mode");
    }

    this._isRunning = true;
    this._currentFrame++;
    this._currentTimeMs = this._currentFrame * this._frameDurationMs;

    this._emitTick();

    const done = this._totalFrames > 0 && this._currentFrame >= this._totalFrames;
    if (done) {
      this._isRunning = false;
      this._onComplete?.();
    }
    return !done;
  }

  /**
   * Seek to an arbitrary time in milliseconds (both modes).
   * Useful for scrubbing / preview without re-rendering every frame.
   */
  seekToMs(ms: number): this {
    this._currentTimeMs = Math.max(0, ms);
    this._currentFrame = Math.round(this._currentTimeMs / this._frameDurationMs);

    // In realtime mode, re-anchor the wall-clock accumulator so playback
    // continues from the new position without a jump.
    if (this._mode === "realtime") {
      this._accumulatedMs = this._currentTimeMs;
      this._wallStartMs = performance.now();
    }

    this._emitTick();
    return this;
  }

  seekToFrame(frame: number): this {
    return this.seekToMs(frame * this._frameDurationMs);
  }

  seekToSeconds(seconds: number): this {
    return this.seekToMs(seconds * 1000);
  }

  // ── State Snapshot ───────────────────────────────────────────────────────────

  getState(): ClockState {
    return {
      mode: this._mode,
      fps: this._fps,
      frameDurationMs: this._frameDurationMs,
      currentFrame: this._currentFrame,
      totalFrames: this._totalFrames,
      currentTimeMs: this._currentTimeMs,
      isRunning: this._isRunning,
    };
  }

  /** Direct read of current time in milliseconds — zero-allocation hot path. */
  getCurrentTime(): number {
    return this._currentTimeMs;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _scheduleRaf(): void {
    this._rafHandle = requestAnimationFrame((timestamp) => {
      if (!this._isRunning) return;

      // Clamp delta to avoid huge jumps after tab visibility changes.
      const rawDeltaMs = timestamp - this._lastRafTimestamp;
      const deltaMs = Math.min(rawDeltaMs, this._frameDurationMs * 4);
      this._lastRafTimestamp = timestamp;

      // Total virtual time = previously accumulated + time since last start.
      this._currentTimeMs =
        this._accumulatedMs + (timestamp - this._wallStartMs);

      // Which frame does that correspond to?
      const newFrame = Math.floor(this._currentTimeMs / this._frameDurationMs);
      if (newFrame !== this._currentFrame) {
        this._currentFrame = newFrame;
        this._emitTick();
      }

      // Completion check.
      if (this._totalFrames > 0 && this._currentFrame >= this._totalFrames) {
        this._isRunning = false;
        this._rafHandle = null;
        this._onComplete?.();
        return;
      }

      void deltaMs; // suppress unused-var lint
      this._scheduleRaf();
    });
  }

  private _emitTick(): void {
    const state = this.getState();
    // Snapshot the array in case a callback removes itself mid-iteration.
    const cbs = this._tickCallbacks.slice();
    for (let i = 0; i < cbs.length; i++) {
      cbs[i](state);
    }
  }
}

// ─── Factory helpers ──────────────────────────────────────────────────────────

/** Create a clock pre-configured for real-time preview at a given fps. */
export function createPreviewClock(fps: number = 60): VirtualClock {
  return new VirtualClock(fps, "realtime");
}

/** Create a clock pre-configured for frame-accurate export. */
export function createExportClock(fps: number = 60, durationSec: number = 0): VirtualClock {
  const clock = new VirtualClock(fps, "stepped");
  if (durationSec > 0) clock.setDurationSeconds(durationSec);
  return clock;
}
