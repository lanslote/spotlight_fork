/**
 * DemoEngine — core playback state machine for Spotlight interactive demos.
 *
 * This module is "use client"-compatible: pure TypeScript with no React
 * dependencies. It can be imported by both browser and SSR-safe client
 * components; the only browser APIs touched are `setTimeout`/`clearTimeout`
 * (playback timers) and `HTMLVideoElement`/`HTMLCanvasElement` (exclusively
 * inside the static `DemoEngine.fromAnalysis` factory, which is always
 * called on the client).
 *
 * Architecture overview:
 *
 *   Demo (data)
 *     └─ DemoStep[]          one slide / screenshot + annotations
 *          ├─ Hotspot[]       interactive regions with optional branch targets
 *          ├─ Callout[]       text overlays with {{variable}} interpolation
 *          └─ BlurRegion[]    privacy / focus redaction
 *
 *   DemoEngine (state machine)
 *     ├─ PlaybackState        idle | playing | paused | waiting-for-click | …
 *     ├─ History stack        enables back-navigation without loops
 *     ├─ Variable map         {{token}} substitution for personalisation
 *     └─ Event bus            typed listeners decoupled from the UI layer
 */

// ─── External dependencies ───────────────────────────────────────────────────

import type { AnalysisResult, SceneSegment, DetectedClick } from "./video-analyzer";
import { extractFrame } from "./video-analyzer";

// ─── Primitive geometry ───────────────────────────────────────────────────────

/**
 * Axis-aligned rectangle used for click targets, hotspot bounds, and
 * blur regions. Coordinates are in the demo's logical pixel space.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Two-dimensional point / vector. */
export interface Vec2 {
  x: number;
  y: number;
}

// ─── Annotation types ─────────────────────────────────────────────────────────

/**
 * An interactive region overlaid on a demo step.
 * Supports click, hover, and scroll triggers with optional branching.
 */
export interface Hotspot {
  id: string;
  /** Interaction type that activates this hotspot. */
  type: "click" | "hover" | "scroll";
  /** Bounding rectangle in the demo's logical pixel space. */
  bounds: Rect;
  /** Tooltip text shown on hover. Supports {{variable}} tokens. */
  tooltip?: string;
  /** Visual treatment applied to the hotspot overlay in the player. */
  style: "pulse" | "highlight" | "outline" | "arrow";
  /** If set, activating this hotspot navigates to the specified step ID. */
  branchTo?: string;
}

/** A text annotation displayed over a step at a fixed position. */
export interface Callout {
  id: string;
  /** Main callout copy. Supports {{variable}} interpolation. */
  text: string;
  /** Anchor point in the demo's logical pixel space. */
  position: Vec2;
  /** Which side of `position` the callout bubble expands toward. */
  anchor: "top" | "bottom" | "left" | "right";
  /** Visual treatment for the callout bubble. */
  style: "tooltip" | "badge" | "numbered" | "arrow";
  /** Step number badge value, used when `style` is `'numbered'`. */
  number?: number;
}

/** A rectangular region of the screenshot that is blurred, masked, or pixelated. */
export interface BlurRegion {
  id: string;
  /** Region to obscure in the demo's logical pixel space. */
  bounds: Rect;
  /** Obscuration algorithm to apply when rendering. */
  mode: "blur" | "mask" | "pixelate";
  /** Obscuration intensity in the range 0 (none) → 1 (maximum). */
  intensity: number;
}

// ─── Transition type ──────────────────────────────────────────────────────────

/**
 * Named transition animation played when the player advances to the next step.
 * `'none'` skips the animation entirely for an instant cut.
 */
export type TransitionType =
  | "fade"
  | "slide-left"
  | "slide-right"
  | "zoom"
  | "morph"
  | "none";

// ─── Demo step ────────────────────────────────────────────────────────────────

/**
 * A single "slide" in a demo — one captured screenshot plus all its
 * annotations, interaction rules, and per-step playback settings.
 */
export interface DemoStep {
  id: string;
  /** The captured frame, encoded as a data URL (image/png or image/jpeg). */
  screenshotDataUrl: string;
  /**
   * Primary click region that advances to the next step when clicked.
   * When absent the entire step surface acts as the click target
   * (if the demo's `allowKeyboardNav` / click-anywhere setting is on).
   */
  clickTarget?: Rect;
  /** Interactive hotspot overlays. */
  hotspots: Hotspot[];
  /** Text / badge callout overlays. */
  callouts: Callout[];
  /** Privacy-redaction regions. */
  blurRegions: BlurRegion[];
  /**
   * Auto-advance delay in seconds.
   * A value of `0` means the engine will wait for an explicit user interaction
   * before moving to the next step.
   */
  duration: number;
  /** Transition animation played when entering this step. */
  transition: TransitionType;
  /**
   * Secondary branch map: hotspot ID → target step ID.
   * Entries here take precedence over the hotspot's own `branchTo` field.
   */
  branchTargets?: Record<string, string>;
  /** Script text used for voiceover narration / accessibility. */
  voiceoverText?: string;
  /** ID of the chapter this step belongs to (denormalised for fast lookup). */
  chapter?: string;
  /** Short display title shown in chapter nav and progress tooltips. */
  title?: string;
}

// ─── Chapter ──────────────────────────────────────────────────────────────────

/**
 * A named grouping of steps.
 * Chapters are displayed in the chapter navigation sidebar and are used to
 * segment the progress bar into labelled sections.
 */
export interface Chapter {
  id: string;
  title: string;
  /** Ordered step IDs that belong to this chapter. */
  stepIds: string[];
  /** Optional introductory text shown at the start of the chapter. */
  introText?: string;
}

// ─── Variables ────────────────────────────────────────────────────────────────

/**
 * A runtime variable that can be injected into callout text and tooltips
 * via `{{name}}` tokens. Variables may be seeded from URL query parameters,
 * embedded forms, or manual override at runtime.
 */
export interface DemoVariable {
  name: string;
  defaultValue: string;
  source: "url-param" | "form-input" | "manual";
  /** Human-readable label shown in the variable configuration UI. */
  label?: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

/** Global playback and presentation settings for a demo. */
export interface DemoSettings {
  /** Start playing automatically when the demo loads. */
  autoplay: boolean;
  /** Seconds between auto-advances when `autoplay` is `true`. */
  autoplayDelay: number;
  /** Render the horizontal progress bar at the bottom of the player. */
  showProgressBar: boolean;
  /** Render the chapter navigation sidebar / tabs. */
  showChapterNav: boolean;
  /** Allow left / right arrow key navigation. */
  allowKeyboardNav: boolean;
  /** Colour scheme for the player chrome UI. */
  theme: "light" | "dark" | "auto";
  /** Accent / brand colour as a CSS hex string, e.g. `'#3B82F6'`. */
  brandColor: string;
  /** URL of the brand logo displayed in the player header. */
  logoUrl?: string;
  /** Logical width of the demo canvas in pixels. */
  width: number;
  /** Logical height of the demo canvas in pixels. */
  height: number;
}

// ─── Demo root ────────────────────────────────────────────────────────────────

/** The top-level demo document — everything needed to play back an interactive demo. */
export interface Demo {
  id: string;
  title: string;
  description?: string;
  steps: DemoStep[];
  chapters: Chapter[];
  variables: DemoVariable[];
  settings: DemoSettings;
  /** Unix timestamp (ms) when the demo was first created. */
  createdAt: number;
  /** Unix timestamp (ms) when the demo was last modified. */
  updatedAt: number;
}

// ─── Playback state machine ───────────────────────────────────────────────────

/**
 * Discrete states of the DemoEngine playback state machine.
 *
 * ```
 *   idle ──play()──► playing ──pause()──► paused ──resume()──► playing
 *     ▲                 │                                          │
 *     │           (step.duration=0)                         (step.duration=0)
 *     │                 ▼                                          ▼
 *     │          waiting-for-click ◄────────────────────────────────
 *     │
 *     └──────── completed (emitted when last step is passed)
 * ```
 */
export type PlaybackState =
  | "idle"
  | "playing"
  | "paused"
  | "waiting-for-click"
  | "transitioning"
  | "completed";

/** All event types the engine can emit on its event bus. */
export type DemoEventType =
  | "step-change"
  | "state-change"
  | "hotspot-click"
  | "branch"
  | "chapter-change"
  | "completed"
  | "variable-change";

/** Event payload emitted by the DemoEngine event bus. */
export interface DemoEvent {
  type: DemoEventType;
  /** Step ID relevant to this event (current step after a change). */
  stepId?: string;
  /** Hotspot ID that triggered a hotspot-click or branch event. */
  hotspotId?: string;
  /** Chapter ID relevant to a chapter-change event. */
  chapterId?: string;
  /** The step ID that was current before this navigation began. */
  previousStepId?: string;
  /** High-resolution wall-clock timestamp (ms since epoch). */
  timestamp: number;
}

/** Callback signature for DemoEngine event listeners. */
export type DemoEventListener = (event: DemoEvent) => void;

// ─── Progress snapshot ────────────────────────────────────────────────────────

/** Playback progress snapshot returned by `DemoEngine.getProgress()`. */
export interface PlaybackProgress {
  /** Zero-based index of the current step in `demo.steps`. */
  currentStepIndex: number;
  /** Total number of steps in the demo. */
  totalSteps: number;
  /** Completion percentage in the range 0–100. */
  percentage: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Duration in milliseconds of a named step transition animation. */
const TRANSITION_DURATION_MS = 350;

/** Interval in milliseconds between transition-progress ticks. */
const TRANSITION_TICK_MS = 16; // ~60 fps

/** Number of steps grouped into each auto-generated chapter. */
const STEPS_PER_AUTO_CHAPTER = 5;

// ─── DemoEngine ───────────────────────────────────────────────────────────────

/**
 * Core playback state machine for an interactive demo.
 *
 * The engine is fully headless — it manages all state transitions and
 * emits typed events, but never touches the DOM directly. A React player
 * component (or any other rendering layer) subscribes to events and reads
 * state snapshots to drive its own rendering.
 *
 * @example
 * ```ts
 * const engine = new DemoEngine(myDemo);
 * engine.on('step-change', () => renderStep(engine.getCurrentStep()!));
 * engine.on('state-change', () => updateControls(engine.getState()));
 * engine.play();
 *
 * // Clean up when the player unmounts:
 * engine.destroy();
 * ```
 */
export class DemoEngine {
  // ── Internal state ──────────────────────────────────────────────────────

  /** Index into `_demo.steps` for the currently displayed step. */
  private _currentStepIndex: number = 0;

  /** Current playback state. */
  private _state: PlaybackState = "idle";

  /**
   * Navigation history: stack of step IDs visited before the current step.
   * `previousStep()` pops entries from this stack, enabling back-navigation.
   */
  private _history: string[] = [];

  /** Handle from `setTimeout` for the auto-advance timer, or `null`. */
  private _autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Handle from `setInterval` that drives transition-progress ticks,
   * or `null` when no transition is in progress.
   */
  private _transitionTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Current normalised transition progress (0 → 1).
   * `null` when no transition is active — mirrors `getTransitionProgress()`.
   */
  private _transitionProgress: number | null = null;

  /** Wall-clock time (ms) when the current transition started. */
  private _transitionStartTime: number = 0;

  /** Runtime variable overrides, seeded from `demo.variables` defaults. */
  private _variables: Map<string, string> = new Map();

  /** Registered event listeners, keyed by event type. */
  private _listeners: Map<DemoEventType, Set<DemoEventListener>> = new Map();

  /** Immutable reference to the demo being played. */
  private readonly _demo: Demo;

  // ── Constructor ──────────────────────────────────────────────────────────

  /**
   * Create a new DemoEngine for the given demo.
   *
   * The engine starts in the `idle` state. Call `play()` to begin playback.
   *
   * @param demo - The demo data to play back.
   */
  constructor(demo: Demo) {
    this._demo = demo;

    // Seed the variable map with each variable's declared default value.
    for (const variable of demo.variables) {
      this._variables.set(variable.name, variable.defaultValue);
    }
  }

  // ── Playback controls ────────────────────────────────────────────────────

  /**
   * Start (or restart) playback.
   *
   * - If `stepId` is provided, seeks to that step first.
   * - If the engine is `idle`, playback starts from step 0 (or `stepId`).
   * - If already `paused`, resumes from the current step (equivalent to `resume()`).
   *
   * @param stepId - Optional step ID to seek to before playing.
   */
  play(stepId?: string): void {
    if (stepId !== undefined) {
      const idx = this._indexOfStep(stepId);
      if (idx === -1) return;
      this._currentStepIndex = idx;
    }

    this._cancelTimers();
    this._setState("playing");
    this._scheduleAutoAdvance();
  }

  /**
   * Pause the auto-advance timer.
   * Has no effect when the engine is not in the `playing` state.
   */
  pause(): void {
    if (this._state !== "playing") return;
    this._cancelAutoAdvance();
    this._setState("paused");
  }

  /**
   * Resume auto-advance from the current step.
   * Has no effect unless the engine is currently `paused`.
   */
  resume(): void {
    if (this._state !== "paused") return;
    this._setState("playing");
    this._scheduleAutoAdvance();
  }

  /**
   * Navigate to a specific step, pushing the current step onto the history
   * stack and playing the target step's configured transition.
   *
   * @param stepId - ID of the step to navigate to.
   */
  goToStep(stepId: string): void {
    const idx = this._indexOfStep(stepId);
    if (idx === -1) return;

    const previousId = this._currentStep()?.id;
    if (previousId) {
      this._history.push(previousId);
    }

    this._cancelTimers();
    this._beginTransition(idx, previousId);
  }

  /**
   * Navigate to the first step of the specified chapter.
   * Emits a `chapter-change` event in addition to `step-change`.
   *
   * @param chapterId - ID of the chapter to jump to.
   */
  goToChapter(chapterId: string): void {
    const chapter = this._demo.chapters.find((c) => c.id === chapterId);
    if (!chapter || chapter.stepIds.length === 0) return;

    const firstStepId = chapter.stepIds[0];
    this.goToStep(firstStepId);

    // Emit chapter-change immediately (before the transition completes) so that
    // the chapter nav UI can update its selection without waiting.
    this._emit({
      type: "chapter-change",
      chapterId,
      stepId: firstStepId,
      timestamp: Date.now(),
    });
  }

  /**
   * Advance to the next step in linear sequence.
   * When the current step is the last step, transitions to the `completed`
   * state and emits a `completed` event.
   */
  nextStep(): void {
    const nextIdx = this._currentStepIndex + 1;

    if (nextIdx >= this._demo.steps.length) {
      this._cancelTimers();
      this._setState("completed");
      this._emit({ type: "completed", timestamp: Date.now() });
      return;
    }

    const previousId = this._currentStep()?.id;
    if (previousId) {
      this._history.push(previousId);
    }

    this._cancelTimers();
    this._beginTransition(nextIdx, previousId);
  }

  /**
   * Navigate back to the previously visited step by popping the history stack.
   * Does nothing when there is no navigation history.
   */
  previousStep(): void {
    if (this._history.length === 0) return;

    const previousId = this._history.pop()!;
    const idx = this._indexOfStep(previousId);
    if (idx === -1) return;

    // Do not push to history when navigating backwards to avoid creating loops.
    this._cancelTimers();
    const fromId = this._currentStep()?.id;
    this._beginTransition(idx, fromId, /* addToHistory */ false);
  }

  // ── Interaction handling ─────────────────────────────────────────────────

  /**
   * Process a pointer click at the given demo-space coordinates.
   *
   * Hit-testing is applied in the following priority order:
   *  1. Hotspot with a branch target → navigate to branch step
   *  2. Step-level `clickTarget` rect → advance to next step
   *  3. Engine is in `waiting-for-click` state → advance (click-anywhere)
   *
   * @param x - X coordinate in the demo's logical pixel space.
   * @param y - Y coordinate in the demo's logical pixel space.
   * @returns The hotspot that was hit, or `null` if no hotspot was under the pointer.
   */
  handleClick(x: number, y: number): Hotspot | null {
    const step = this._currentStep();
    if (!step) return null;

    // 1. Hit-test hotspots in declaration order (first match wins).
    const hotspot = hitTestHotspot(step.hotspots, x, y);

    if (hotspot) {
      this._emit({
        type: "hotspot-click",
        hotspotId: hotspot.id,
        stepId: step.id,
        timestamp: Date.now(),
      });

      // Resolve branch target: step-level map overrides hotspot.branchTo.
      const branchTarget =
        step.branchTargets?.[hotspot.id] ?? hotspot.branchTo;

      if (branchTarget) {
        this._emit({
          type: "branch",
          hotspotId: hotspot.id,
          stepId: branchTarget,
          previousStepId: step.id,
          timestamp: Date.now(),
        });
        this.goToStep(branchTarget);
        return hotspot;
      }
    }

    // 2. Primary click target for the step.
    if (step.clickTarget && rectContains(step.clickTarget, x, y)) {
      this.nextStep();
      return hotspot ?? null;
    }

    // 3. Click-anywhere-to-advance when the step is blocked waiting for input.
    if (this._state === "waiting-for-click") {
      this.nextStep();
    }

    return hotspot ?? null;
  }

  /**
   * Process a pointer hover at the given demo-space coordinates.
   *
   * This method is purely read-only and side-effect-free — it is safe to call
   * on every `mousemove` event without additional throttling.
   *
   * @param x - X coordinate in the demo's logical pixel space.
   * @param y - Y coordinate in the demo's logical pixel space.
   * @returns The topmost hotspot under the pointer, or `null`.
   */
  handleHover(x: number, y: number): Hotspot | null {
    const step = this._currentStep();
    if (!step) return null;
    return hitTestHotspot(step.hotspots, x, y);
  }

  // ── State accessors ──────────────────────────────────────────────────────

  /**
   * Returns the currently displayed `DemoStep`, or `undefined` when the demo
   * has no steps.
   */
  getCurrentStep(): DemoStep | undefined {
    return this._currentStep();
  }

  /**
   * Returns the `Chapter` that owns the current step, or `null` when the step
   * is not assigned to any chapter.
   */
  getCurrentChapter(): Chapter | null {
    const step = this._currentStep();
    if (!step?.chapter) return null;
    return this._demo.chapters.find((c) => c.id === step.chapter) ?? null;
  }

  /** Returns the current `PlaybackState`. */
  getState(): PlaybackState {
    return this._state;
  }

  /**
   * Returns a playback progress snapshot.
   * `percentage` is always in the range 0–100 and is NaN-safe for empty demos.
   */
  getProgress(): PlaybackProgress {
    const total = this._demo.steps.length;
    const idx = this._currentStepIndex;
    return {
      currentStepIndex: idx,
      totalSteps: total,
      percentage: total > 0 ? (idx / Math.max(total - 1, 1)) * 100 : 0,
    };
  }

  /**
   * Returns the normalised transition progress (0 → 1) while a transition
   * animation is active, or `null` at all other times.
   */
  getTransitionProgress(): number | null {
    return this._transitionProgress;
  }

  // ── Variable management ──────────────────────────────────────────────────

  /**
   * Set a runtime variable value and emit a `variable-change` event so that
   * the UI layer can re-render any interpolated text.
   *
   * @param name  - Variable name, without `{{` / `}}` delimiters.
   * @param value - New string value.
   */
  setVariable(name: string, value: string): void {
    this._variables.set(name, value);
    this._emit({ type: "variable-change", timestamp: Date.now() });
  }

  /**
   * Get the current value of a variable.
   *
   * Resolution order:
   *  1. Runtime override set via `setVariable()`
   *  2. Default value declared in `demo.variables`
   *  3. Empty string (unknown variable)
   *
   * @param name - Variable name, without `{{` / `}}` delimiters.
   */
  getVariable(name: string): string {
    if (this._variables.has(name)) {
      return this._variables.get(name)!;
    }
    const decl = this._demo.variables.find((v) => v.name === name);
    return decl?.defaultValue ?? "";
  }

  /**
   * Replace all `{{varName}}` tokens in `text` with their current runtime
   * values. Unknown tokens are left unchanged.
   *
   * @param text - Source string potentially containing `{{…}}` tokens.
   * @returns The interpolated string.
   */
  interpolateVariables(text: string): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
      const value = this.getVariable(name);
      return value !== "" ? value : _match;
    });
  }

  // ── Event bus ────────────────────────────────────────────────────────────

  /**
   * Subscribe to a demo engine event.
   *
   * Multiple listeners may be registered for the same event type.
   *
   * @param event    - The event type to subscribe to.
   * @param listener - Callback invoked each time the event fires.
   */
  on(event: DemoEventType, listener: DemoEventListener): void {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(listener);
  }

  /**
   * Remove a previously registered event listener.
   * Safe to call even if the listener was never registered.
   *
   * @param event    - The event type the listener was registered for.
   * @param listener - The exact same function reference passed to `on()`.
   */
  off(event: DemoEventType, listener: DemoEventListener): void {
    this._listeners.get(event)?.delete(listener);
  }

  /**
   * Tear down the engine: cancel all pending timers and remove all listeners.
   *
   * Always call `destroy()` when the player component unmounts to prevent
   * timer and memory leaks.
   */
  destroy(): void {
    this._cancelTimers();
    this._listeners.clear();
    this._history.length = 0;
  }

  // ── Static factory ───────────────────────────────────────────────────────

  /**
   * Build a `Demo` from a `VideoAnalyzer` analysis result.
   *
   * For each detected scene segment a screenshot is captured from the video
   * at the segment's midpoint, and a `DemoStep` is created with any clicks
   * that fell within the segment mapped to `Hotspot` overlays.
   *
   * Chapters are auto-generated by grouping every
   * {@link STEPS_PER_AUTO_CHAPTER} sequential steps.
   *
   * @param analysis     - Output of `VideoAnalyzer.analyze()`.
   * @param videoElement - The `<video>` element that was analysed (must still
   *                       have its `src` loaded).
   * @returns A fully-populated `Demo` ready for use with `DemoEngine`.
   */
  static async fromAnalysis(
    analysis: AnalysisResult,
    videoElement: HTMLVideoElement
  ): Promise<Demo> {
    const { source, segments, clicks } = analysis;
    const steps: DemoStep[] = [];

    // ── Build one DemoStep per scene segment ─────────────────────────────
    for (const segment of segments) {
      // Capture a representative frame at the midpoint of the segment.
      const captureTime = (segment.startTime + segment.endTime) / 2;
      const frameCanvas = await extractFrame(
        videoElement,
        captureTime,
        source.width,
        source.height
      );
      const screenshotDataUrl = frameCanvas.toDataURL("image/jpeg", 0.92);

      // Map any clicks within this segment to pulse hotspots.
      const segmentClicks = clicks.filter(
        (c: DetectedClick) =>
          c.time >= segment.startTime && c.time <= segment.endTime
      );

      const hotspots: Hotspot[] = segmentClicks.map((click: DetectedClick) => {
        // Convert normalised coordinates to logical demo-space pixels.
        const cx = click.position.x * source.width;
        const cy = click.position.y * source.height;
        // Size the hotspot as ~4% of the canvas width, clamped to 40–80px.
        const size = Math.max(40, Math.min(80, source.width * 0.04));
        return {
          id: makeId("hs"),
          type: "click" as const,
          bounds: {
            x: cx - size / 2,
            y: cy - size / 2,
            width: size,
            height: size,
          },
          style: "pulse" as const,
        };
      });

      // Choose a sensible default transition per segment type.
      const transition: TransitionType =
        segment.type === "scroll"
          ? "slide-left"
          : segment.type === "idle"
          ? "none"
          : "fade";

      // Idle segments auto-advance quickly; all others wait for a click.
      const duration = segment.type === "idle" ? 1.5 : 0;

      steps.push({
        id: makeId("step"),
        screenshotDataUrl,
        hotspots,
        callouts: [],
        blurRegions: [],
        duration,
        transition,
        title: `Step ${steps.length + 1}`,
        chapter: "", // back-filled after chapter generation below
      });
    }

    // Ensure at least one step exists even if the analysis yielded no segments.
    if (steps.length === 0) {
      steps.push(createDefaultStep());
    }

    // ── Auto-generate chapters (one per STEPS_PER_AUTO_CHAPTER steps) ────
    const chapters: Chapter[] = [];

    for (let i = 0; i < steps.length; i += STEPS_PER_AUTO_CHAPTER) {
      const chapterSteps = steps.slice(i, i + STEPS_PER_AUTO_CHAPTER);
      const chapterId = makeId("ch");
      chapters.push({
        id: chapterId,
        title: `Chapter ${chapters.length + 1}`,
        stepIds: chapterSteps.map((s) => s.id),
      });
      // Back-fill the chapter reference on each step.
      for (const step of chapterSteps) {
        step.chapter = chapterId;
      }
    }

    // ── Assemble the root Demo ────────────────────────────────────────────
    const now = Date.now();
    return {
      id: makeId("demo"),
      title: "Untitled Demo",
      steps,
      chapters,
      variables: [],
      settings: createDefaultSettings(source.width, source.height),
      createdAt: now,
      updatedAt: now,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /** Returns the step at the current index, or `undefined`. */
  private _currentStep(): DemoStep | undefined {
    return this._demo.steps[this._currentStepIndex];
  }

  /** Returns the index of the step with the given ID, or -1. */
  private _indexOfStep(stepId: string): number {
    return this._demo.steps.findIndex((s) => s.id === stepId);
  }

  /**
   * Update `_state` and emit a `state-change` event.
   * Centralised to ensure every state mutation fires exactly one event.
   */
  private _setState(state: PlaybackState): void {
    this._state = state;
    this._emit({
      type: "state-change",
      stepId: this._currentStep()?.id,
      timestamp: Date.now(),
    });
  }

  /**
   * Begin a step transition animation to `targetIndex`.
   *
   * For the `'none'` transition type the step is committed immediately.
   * For all other types a `setInterval` loop ticks `_transitionProgress`
   * from 0 → 1 over `TRANSITION_DURATION_MS` milliseconds, then commits.
   *
   * @param targetIndex  - Index in `_demo.steps` to navigate to.
   * @param previousId   - ID of the step before navigation (for events).
   * @param addToHistory - Whether the current step was already pushed to history.
   *                       Pass `false` when navigating backwards.
   */
  private _beginTransition(
    targetIndex: number,
    previousId: string | undefined,
    _addToHistory = true // reserved for future use; history is managed by callers
  ): void {
    const targetStep = this._demo.steps[targetIndex];
    if (!targetStep) return;

    // Fast path: skip animation for 'none' transitions.
    if (targetStep.transition === "none") {
      this._commitStep(targetIndex, previousId);
      return;
    }

    this._transitionProgress = 0;
    this._transitionStartTime = Date.now();
    this._setState("transitioning");

    this._transitionTimer = setInterval(() => {
      const elapsed = Date.now() - this._transitionStartTime;
      const progress = Math.min(elapsed / TRANSITION_DURATION_MS, 1);
      this._transitionProgress = progress;

      if (progress >= 1) {
        clearInterval(this._transitionTimer!);
        this._transitionTimer = null;
        this._transitionProgress = null;
        this._commitStep(targetIndex, previousId);
      }
    }, TRANSITION_TICK_MS);
  }

  /**
   * Commit a step navigation: update `_currentStepIndex`, emit `step-change`
   * (and `chapter-change` if the chapter boundary is crossed), then resolve
   * the next playback state.
   */
  private _commitStep(
    targetIndex: number,
    previousId: string | undefined
  ): void {
    const previousChapterId = this._currentStep()?.chapter;
    this._currentStepIndex = targetIndex;
    const newStep = this._currentStep()!;

    this._emit({
      type: "step-change",
      stepId: newStep.id,
      previousStepId: previousId,
      timestamp: Date.now(),
    });

    // Emit chapter-change only when we actually cross a chapter boundary.
    if (newStep.chapter && newStep.chapter !== previousChapterId) {
      this._emit({
        type: "chapter-change",
        chapterId: newStep.chapter,
        stepId: newStep.id,
        timestamp: Date.now(),
      });
    }

    // Determine next state based on whether this step auto-advances.
    if (newStep.duration > 0) {
      this._setState("playing");
      this._scheduleAutoAdvance();
    } else {
      this._setState("waiting-for-click");
    }
  }

  /**
   * Schedule the auto-advance timer for the current step.
   * If `step.duration` is 0, switches immediately to `waiting-for-click`.
   *
   * The effective delay is:
   *   `max(step.duration, settings.autoplayDelay)` when autoplay is enabled,
   *   or simply `step.duration` otherwise.
   */
  private _scheduleAutoAdvance(): void {
    const step = this._currentStep();
    if (!step || step.duration <= 0) {
      this._setState("waiting-for-click");
      return;
    }

    const { autoplay, autoplayDelay } = this._demo.settings;
    const delayMs =
      autoplay && autoplayDelay > 0
        ? Math.max(step.duration, autoplayDelay) * 1000
        : step.duration * 1000;

    this._autoAdvanceTimer = setTimeout(() => {
      this._autoAdvanceTimer = null;
      this.nextStep();
    }, delayMs);
  }

  /** Cancel the auto-advance timer without changing the playback state. */
  private _cancelAutoAdvance(): void {
    if (this._autoAdvanceTimer !== null) {
      clearTimeout(this._autoAdvanceTimer);
      this._autoAdvanceTimer = null;
    }
  }

  /** Cancel both the auto-advance timer and any active transition timer. */
  private _cancelTimers(): void {
    this._cancelAutoAdvance();
    if (this._transitionTimer !== null) {
      clearInterval(this._transitionTimer);
      this._transitionTimer = null;
    }
    this._transitionProgress = null;
  }

  /**
   * Emit an event to all registered listeners for its type.
   *
   * Iterates over a snapshot of the listener set so that listeners may safely
   * call `off()` from within their own callback.
   * Listener errors are swallowed to prevent one bad listener from breaking
   * the entire event chain.
   */
  private _emit(event: DemoEvent): void {
    const listeners = this._listeners.get(event.type);
    if (!listeners || listeners.size === 0) return;
    for (const listener of Array.from(listeners)) {
      try {
        listener(event);
      } catch {
        // Intentionally swallow — the engine must remain stable.
      }
    }
  }
}

// ─── Helper utilities ─────────────────────────────────────────────────────────

/**
 * Generate a unique, human-readable ID with an optional prefix.
 *
 * IDs are composed of:
 *  - an optional prefix string
 *  - the current millisecond timestamp encoded in base-36
 *  - a 4-character random alphanumeric suffix
 *
 * They are not cryptographically secure but are collision-resistant for
 * typical demo sizes (thousands of IDs per session).
 *
 * @param prefix - Optional string prepended to the ID, e.g. `'step'` or `'hs'`.
 * @returns A unique string such as `'step_lkj4af_x3m2'`.
 *
 * @example
 * ```ts
 * makeId()        // => 'lkj4af_x3m2'
 * makeId('step')  // => 'step_lkj4af_x3m2'
 * ```
 */
export function makeId(prefix?: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return prefix ? `${prefix}_${ts}_${rand}` : `${ts}_${rand}`;
}

/**
 * Test whether a point lies inside a rectangle (edges are inclusive).
 *
 * @param rect - The bounding rectangle.
 * @param x    - X coordinate to test.
 * @param y    - Y coordinate to test.
 */
export function rectContains(rect: Rect, x: number, y: number): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

/**
 * Find the first hotspot in `hotspots` whose bounds contain the point `(x, y)`.
 * Returns `null` when no hotspot is hit.
 *
 * Hotspots are tested in array order — earlier entries take precedence over
 * later ones when they overlap.
 *
 * @param hotspots - The hotspot list to test (typically from a `DemoStep`).
 * @param x        - X coordinate in the demo's logical pixel space.
 * @param y        - Y coordinate in the demo's logical pixel space.
 */
export function hitTestHotspot(
  hotspots: Hotspot[],
  x: number,
  y: number
): Hotspot | null {
  for (const hotspot of hotspots) {
    if (rectContains(hotspot.bounds, x, y)) {
      return hotspot;
    }
  }
  return null;
}

/**
 * Look up a step by ID within a demo.
 *
 * @param demo   - The demo to search.
 * @param stepId - The step ID to find.
 * @returns The matching `DemoStep`, or `undefined` if not found.
 */
export function getStepById(
  demo: Demo,
  stepId: string
): DemoStep | undefined {
  return demo.steps.find((s) => s.id === stepId);
}

/**
 * Move the step at `fromIndex` to `toIndex` within `demo.steps` (in place).
 *
 * All chapter `stepIds` arrays are updated to reflect the new order.
 * `demo.updatedAt` is set to the current time.
 *
 * Both indices must be valid; the function is a no-op if they are out of
 * range or equal.
 *
 * @param demo      - The demo to modify (mutated in place).
 * @param fromIndex - Current zero-based index of the step to move.
 * @param toIndex   - Destination zero-based index.
 */
export function reorderSteps(
  demo: Demo,
  fromIndex: number,
  toIndex: number
): void {
  const { steps } = demo;
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= steps.length ||
    toIndex >= steps.length
  ) {
    return;
  }

  const [moved] = steps.splice(fromIndex, 1);
  steps.splice(toIndex, 0, moved);

  _syncChapterStepIds(demo);
  demo.updatedAt = Date.now();
}

/**
 * Insert a new step into a demo.
 *
 * If `afterIndex` is omitted or `-1`, the step is appended at the end.
 * Otherwise it is inserted immediately after the step at `afterIndex`.
 *
 * When the new step has no `chapter` assigned, it inherits the chapter of
 * its immediate predecessor (if any) and is inserted at the correct position
 * in that chapter's `stepIds` array.
 *
 * @param demo       - The demo to modify (mutated in place).
 * @param step       - The step to insert. Must already have a unique `id`.
 * @param afterIndex - Index after which to insert, or omit / `-1` to append.
 */
export function addStep(
  demo: Demo,
  step: DemoStep,
  afterIndex?: number
): void {
  const insertAt =
    afterIndex === undefined || afterIndex < 0
      ? demo.steps.length
      : Math.min(afterIndex + 1, demo.steps.length);

  demo.steps.splice(insertAt, 0, step);

  // Inherit the chapter of the preceding step when the new step is unassigned.
  if (insertAt > 0 && !step.chapter) {
    const predecessor = demo.steps[insertAt - 1];
    if (predecessor.chapter) {
      step.chapter = predecessor.chapter;
      const chapter = demo.chapters.find((c) => c.id === step.chapter);
      if (chapter) {
        const predPos = chapter.stepIds.indexOf(predecessor.id);
        chapter.stepIds.splice(predPos + 1, 0, step.id);
      }
    }
  }

  demo.updatedAt = Date.now();
}

/**
 * Remove a step from a demo by ID.
 *
 * Side effects:
 *  - The step is removed from `demo.steps`.
 *  - The step ID is removed from all chapter `stepIds` arrays; chapters that
 *    become empty as a result are deleted from `demo.chapters`.
 *  - Any `hotspot.branchTo` values and `step.branchTargets` entries pointing
 *    at the removed step are cleared throughout the remaining steps.
 *  - `demo.updatedAt` is set to the current time.
 *
 * @param demo   - The demo to modify (mutated in place).
 * @param stepId - ID of the step to remove.
 */
export function removeStep(demo: Demo, stepId: string): void {
  const idx = demo.steps.findIndex((s) => s.id === stepId);
  if (idx === -1) return;

  demo.steps.splice(idx, 1);

  // Remove the step ID from chapters and prune any that become empty.
  for (let i = demo.chapters.length - 1; i >= 0; i--) {
    const chapter = demo.chapters[i];
    const pos = chapter.stepIds.indexOf(stepId);
    if (pos !== -1) {
      chapter.stepIds.splice(pos, 1);
    }
    if (chapter.stepIds.length === 0) {
      demo.chapters.splice(i, 1);
    }
  }

  // Clear all dangling branch references across remaining steps.
  for (const step of demo.steps) {
    for (const hotspot of step.hotspots) {
      if (hotspot.branchTo === stepId) {
        hotspot.branchTo = undefined;
      }
    }
    if (step.branchTargets) {
      for (const [key, target] of Object.entries(step.branchTargets)) {
        if (target === stepId) {
          delete step.branchTargets[key];
        }
      }
    }
  }

  demo.updatedAt = Date.now();
}

/**
 * Create a blank `DemoStep` with sensible default values.
 *
 * The `screenshotDataUrl` is an empty string — the caller is responsible for
 * populating it (e.g. from a captured frame) before the step is rendered.
 */
export function createDefaultStep(): DemoStep {
  return {
    id: makeId("step"),
    screenshotDataUrl: "",
    hotspots: [],
    callouts: [],
    blurRegions: [],
    duration: 0,
    transition: "fade",
    title: "New Step",
  };
}

/**
 * Create a `DemoSettings` object with production-ready defaults.
 *
 * @param width  - Logical canvas width in pixels. Defaults to `1280`.
 * @param height - Logical canvas height in pixels. Defaults to `800`.
 */
export function createDefaultSettings(
  width = 1280,
  height = 800
): DemoSettings {
  return {
    autoplay: false,
    autoplayDelay: 3,
    showProgressBar: true,
    showChapterNav: true,
    allowKeyboardNav: true,
    theme: "auto",
    brandColor: "#3B82F6",
    width,
    height,
  };
}

/**
 * Create an empty `Demo` containing one blank step and a matching chapter.
 *
 * This is the initial state used by the demo editor when creating a new demo
 * from scratch (as opposed to importing from a video analysis).
 */
export function createDefaultDemo(): Demo {
  const now = Date.now();
  const firstStep = createDefaultStep();
  const firstChapter: Chapter = {
    id: makeId("ch"),
    title: "Chapter 1",
    stepIds: [firstStep.id],
  };
  firstStep.chapter = firstChapter.id;

  return {
    id: makeId("demo"),
    title: "Untitled Demo",
    steps: [firstStep],
    chapters: [firstChapter],
    variables: [],
    settings: createDefaultSettings(),
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Backward-compatibility aliases & helpers ─────────────────────────────────
//
// The consumer components (step-editor, hotspot-overlay, callout-overlay, demo-player)
// were authored against the initial data model which used flat x/y/width/height fields
// and slightly different type names. These exports bridge the gap so those components
// continue to compile without modification.

/** @deprecated Use `Hotspot['style']` directly. */
export type HotspotStyle = Hotspot["style"];

/** @deprecated Use `Hotspot['type']` directly. */
export type HotspotType = Hotspot["type"];

/** @deprecated Use `Callout['anchor']` directly. */
export type CalloutAnchor = Callout["anchor"];

/** @deprecated Use `BlurRegion['mode']` directly. */
export type BlurMode = BlurRegion["mode"];

/**
 * Create a default hotspot.
 * @deprecated Use `createDefaultStep` and add to `hotspots` array directly.
 */
export function createDefaultHotspot(overrides: Partial<Hotspot> = {}): Hotspot {
  return {
    id: makeId("hs"),
    type: "click",
    bounds: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 },
    tooltip: "",
    style: "pulse",
    ...overrides,
  };
}

/**
 * Create a default callout.
 * @deprecated Use `createDefaultStep` and add to `callouts` array directly.
 */
export function createDefaultCallout(overrides: Partial<Callout> = {}): Callout {
  return {
    id: makeId("co"),
    text: "Add your annotation here",
    position: { x: 0.3, y: 0.3 },
    anchor: "bottom",
    style: "tooltip",
    ...overrides,
  };
}

/**
 * Create a default blur region.
 * @deprecated Use `createDefaultStep` and add to `blurRegions` array directly.
 */
export function createDefaultBlurRegion(
  overrides: Partial<BlurRegion> = {}
): BlurRegion {
  return {
    id: makeId("bl"),
    bounds: { x: 0.2, y: 0.2, width: 0.2, height: 0.1 },
    mode: "blur",
    intensity: 0.6,
    ...overrides,
  };
}

// ─── Module-private helpers ───────────────────────────────────────────────────

/**
 * Rebuild every chapter's `stepIds` array so that it reflects the current
 * ordering of `demo.steps`. Called after any reorder operation.
 *
 * This treats `demo.steps` as the canonical source of truth and derives the
 * chapter membership lists from the `chapter` field on each step.
 */
function _syncChapterStepIds(demo: Demo): void {
  // Reset all chapter lists.
  for (const chapter of demo.chapters) {
    chapter.stepIds = [];
  }
  // Re-populate in steps order.
  for (const step of demo.steps) {
    if (!step.chapter) continue;
    const chapter = demo.chapters.find((c) => c.id === step.chapter);
    if (chapter) {
      chapter.stepIds.push(step.id);
    }
  }
}
