/**
 * Timeline — animation orchestrator for Spotlight.
 *
 * Responsibilities:
 *  1. Map a global playback time → which scene is active + per-scene local time.
 *  2. Evaluate keyframe animations for every visible element at that time.
 *  3. Apply stagger delays to groups of related elements.
 *  4. Return a complete, flat render-ready state (ResolvedScene) to the renderer.
 *
 * Design goals:
 *  - Zero-allocation hot path: reuse result objects where possible.
 *  - Pure functions where feasible — easy to unit-test.
 *  - Easing library is self-contained (no external dependency).
 */

import type {
  SceneSequence,
  Scene,
  SceneElement,
  SceneElementBase,
  AnimationConfig,
  PropertyAnimation,
  Keyframe,
  EasingName,
  Color,
  GradientDef,
  SceneTransition,
} from "./scene";
import { colorToCSS, sequenceDuration } from "./scene";

// ─── Easing functions ─────────────────────────────────────────────────────────
// All functions accept t ∈ [0, 1] and return a value (usually ∈ [0, 1]).

const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;
const c4 = (2 * Math.PI) / 3;
const c5 = (2 * Math.PI) / 4.5;

function bounceOut(t: number): number {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1)      return n1 * t * t;
  if (t < 2 / d1)      return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1)    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

/** Spring-like easing modelled on an under-damped oscillator. */
function springEase(t: number): number {
  if (t === 0) return 0;
  if (t === 1) return 1;
  // Overdamped spring: slightly overshoots once.
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export const Easings: Record<EasingName, (t: number) => number> = {
  linear:           (t) => t,

  easeIn:           (t) => t * t * t,
  easeOut:          (t) => 1 - Math.pow(1 - t, 3),
  easeInOut:        (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

  easeInQuad:       (t) => t * t,
  easeOutQuad:      (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad:    (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,

  easeInCubic:      (t) => t * t * t,
  easeOutCubic:     (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic:   (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

  easeInQuart:      (t) => t * t * t * t,
  easeOutQuart:     (t) => 1 - Math.pow(1 - t, 4),
  easeInOutQuart:   (t) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,

  easeInExpo:       (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  easeOutExpo:      (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo:    (t) =>
    t === 0 ? 0 : t === 1 ? 1 :
    t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,

  easeInBack:       (t) => c3 * t * t * t - c1 * t * t,
  easeOutBack:      (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  easeInOutBack:    (t) =>
    t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2,

  spring:           springEase,
  bouncy:           (t) => t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2,

  step:             (t) => t < 1 ? 0 : 1,
};

/** Evaluate a single easing function by name; falls back to linear. */
export function applyEasing(name: EasingName | undefined, t: number): number {
  if (!name) return t;
  return (Easings[name] ?? Easings.linear)(t);
}

// ─── Keyframe interpolation ───────────────────────────────────────────────────

/**
 * Evaluate a PropertyAnimation at a local element time (seconds).
 * Returns the interpolated numeric value.
 */
export function evaluatePropertyAnimation(
  anim: PropertyAnimation,
  localTimeSec: number,
  staticDefault: number
): number {
  const { keyframes, duration, delay = 0, repeat = "none" } = anim;
  if (!keyframes || keyframes.length === 0) return staticDefault;

  // Adjust for delay.
  let t = localTimeSec - delay;
  if (t < 0) return keyframes[0]?.value ?? staticDefault;

  // Handle repeat modes.
  if (duration > 0) {
    if (t > duration) {
      if (repeat === "loop") {
        t = t % duration;
      } else if (repeat === "pingpong") {
        const cycle = Math.floor(t / duration);
        t = t % duration;
        if (cycle % 2 === 1) t = duration - t;
      } else {
        // "none" — clamp to end.
        t = duration;
      }
    }
    t = t / duration; // normalise to 0-1
  } else {
    t = 1;
  }

  // Clamp.
  t = Math.max(0, Math.min(1, t));

  // Sort keyframes by time (defensive — callers should pre-sort).
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  // Past the last keyframe.
  if (t >= sorted[sorted.length - 1].time) {
    return sorted[sorted.length - 1].value;
  }
  // Before the first keyframe.
  if (t <= sorted[0].time) {
    return sorted[0].value;
  }

  // Find surrounding pair.
  let lo: Keyframe = sorted[0];
  let hi: Keyframe = sorted[sorted.length - 1];

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].time <= t && sorted[i + 1].time >= t) {
      lo = sorted[i];
      hi = sorted[i + 1];
      break;
    }
  }

  const segSpan = hi.time - lo.time;
  const localT = segSpan === 0 ? 1 : (t - lo.time) / segSpan;
  const easedT = applyEasing(lo.easing, localT);

  return lo.value + (hi.value - lo.value) * easedT;
}

// ─── Resolved element types ───────────────────────────────────────────────────

/**
 * A fully-resolved element at a specific point in time.
 * All animated properties are replaced with their interpolated scalar values.
 * The renderer consumes this directly — no further interpolation needed.
 */
export type ResolvedElementBase = {
  id: string;
  name?: string;
  type: SceneElement["type"];
  x: number;
  y: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
  opacity: number;
  scaleX: number;
  scaleY: number;
  rotation: number;   // degrees
  blur: number;       // px
  zIndex: number;
  blendMode: GlobalCompositeOperation;
  filter: string;
  // Carry over the type-specific data verbatim — renderer handles it.
  raw: SceneElement;
};

export interface ResolvedScene {
  scene: Scene;
  /** Local time within the scene, in seconds. */
  localTime: number;
  /** Elements sorted ascending by zIndex, filtered to those currently visible. */
  elements: ResolvedElementBase[];
  /** 0–1 opacity for incoming transition (1 = fully visible). */
  transitionAlpha: number;
  /** Whether a transition is currently in progress. */
  inTransition: boolean;
}

// ─── Stagger helpers ──────────────────────────────────────────────────────────

export interface StaggerGroup {
  /** IDs of elements that belong to this stagger group. */
  elementIds: string[];
  /** Delay (seconds) added to each successive element. */
  stagger: number;
  /** Total extra offset before the group starts. */
  groupDelay?: number;
}

// ─── Timeline class ───────────────────────────────────────────────────────────

export class Timeline {
  private readonly _seq: SceneSequence;
  /** Cached cumulative start times for each scene in global time. */
  private readonly _sceneOffsets: number[];
  /** Pre-computed total duration. */
  private readonly _totalDuration: number;
  /** Stagger groups registered externally for specific scenes. */
  private readonly _staggerGroups: Map<string, StaggerGroup[]> = new Map();

  constructor(sequence: SceneSequence) {
    this._seq = sequence;
    this._sceneOffsets = this._computeOffsets();
    this._totalDuration = sequenceDuration(sequence);
  }

  get totalDuration(): number { return this._totalDuration; }
  get sequence(): SceneSequence { return this._seq; }

  // ── Stagger API ─────────────────────────────────────────────────────────────

  /** Register a stagger group for a scene.  Groups are applied during getStateAtTime. */
  registerStagger(sceneId: string, group: StaggerGroup): this {
    const list = this._staggerGroups.get(sceneId) ?? [];
    list.push(group);
    this._staggerGroups.set(sceneId, list);
    return this;
  }

  // ── Time → Scene mapping ─────────────────────────────────────────────────────

  /**
   * Given a global time (seconds), return the active scene index and the local
   * time within that scene.  Handles transition overlap (two scenes active).
   */
  findActiveScene(globalTime: number): {
    index: number;
    localTime: number;
    scene: Scene;
  } | null {
    const { scenes } = this._seq;
    if (scenes.length === 0) return null;

    // Clamp to valid range.
    const t = Math.max(0, Math.min(globalTime, this._totalDuration));

    for (let i = 0; i < scenes.length; i++) {
      const start = this._sceneOffsets[i];
      const end   = start + scenes[i].duration;
      if (t >= start && t <= end) {
        return { index: i, localTime: t - start, scene: scenes[i] };
      }
    }

    // Shouldn't happen after clamping, but fall back to last scene.
    const last = scenes.length - 1;
    return {
      index: last,
      localTime: scenes[last].duration,
      scene: scenes[last],
    };
  }

  /**
   * Main API: given a global time, return a fully-resolved render state.
   * If a transition is active, returns the INCOMING scene with transitionAlpha
   * <1 so the renderer can composite both scenes.
   */
  getStateAtTime(globalTimeSec: number): ResolvedScene | null {
    const active = this.findActiveScene(globalTimeSec);
    if (!active) return null;

    const { index, scene, localTime } = active;
    const transitions = this._seq.transitions ?? [];
    const transition  = index > 0 ? transitions[index - 1] : undefined;

    // Determine if we are inside an incoming transition.
    let transitionAlpha = 1;
    let inTransition    = false;

    if (transition && transition.type !== "cut") {
      const sceneStart = this._sceneOffsets[index];
      const elapsed    = globalTimeSec - sceneStart;
      if (elapsed < transition.duration) {
        const rawT        = elapsed / transition.duration;
        transitionAlpha   = applyEasing(transition.easing, rawT);
        inTransition      = true;
      }
    }

    const elements = this._resolveElements(scene, localTime);

    return { scene, localTime, elements, transitionAlpha, inTransition };
  }

  /**
   * Returns the resolved state for BOTH the outgoing and incoming scene during
   * a transition — needed to composite a cross-fade properly.
   */
  getTransitionPair(globalTimeSec: number): {
    outgoing: ResolvedScene;
    incoming: ResolvedScene;
    transition: SceneTransition;
    progress: number;  // 0→1
  } | null {
    const active = this.findActiveScene(globalTimeSec);
    if (!active || active.index === 0) return null;

    const { index, localTime, scene } = active;
    const transitions = this._seq.transitions ?? [];
    const transition  = transitions[index - 1];
    if (!transition || transition.type === "cut") return null;

    const sceneStart = this._sceneOffsets[index];
    const elapsed    = globalTimeSec - sceneStart;
    if (elapsed >= transition.duration) return null;

    const progress  = elapsed / transition.duration;
    const prevScene = this._seq.scenes[index - 1];
    const prevLocalTime = prevScene.duration - (transition.duration - elapsed);

    const outgoing: ResolvedScene = {
      scene: prevScene,
      localTime: prevLocalTime,
      elements: this._resolveElements(prevScene, prevLocalTime),
      transitionAlpha: 1 - applyEasing(transition.easing, progress),
      inTransition: true,
    };
    const incoming: ResolvedScene = {
      scene,
      localTime,
      elements: this._resolveElements(scene, localTime),
      transitionAlpha: applyEasing(transition.easing, progress),
      inTransition: true,
    };

    return { outgoing, incoming, transition, progress };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private _computeOffsets(): number[] {
    const { scenes, transitions } = this._seq;
    const offsets: number[] = [];
    let cursor = 0;
    for (let i = 0; i < scenes.length; i++) {
      offsets.push(cursor);
      cursor += scenes[i].duration;
      const tx = transitions?.[i];
      if (tx) cursor -= tx.duration; // overlap
    }
    return offsets;
  }

  private _resolveElements(scene: Scene, localTimeSec: number): ResolvedElementBase[] {
    const groups = this._staggerGroups.get(scene.id) ?? [];

    // Build stagger-delay lookup.
    const staggerMap = new Map<string, number>();
    for (const group of groups) {
      const baseDelay = group.groupDelay ?? 0;
      group.elementIds.forEach((id, i) => {
        staggerMap.set(id, baseDelay + i * group.stagger);
      });
    }

    const resolved: ResolvedElementBase[] = [];

    for (const el of scene.elements) {
      const startTime = el.startTime ?? 0;
      const endTime   = el.endTime   ?? scene.duration;

      if (localTimeSec < startTime || localTimeSec > endTime) continue;

      const staggerDelay = staggerMap.get(el.id) ?? (el.staggerDelay ?? 0);
      // Local time relative to the element's own animation start.
      const elLocalTime  = localTimeSec - startTime - staggerDelay;

      const r = this._resolveElement(el, elLocalTime, staggerDelay);
      resolved.push(r);
    }

    // Sort by zIndex ascending (painter's algorithm).
    resolved.sort((a, b) => a.zIndex - b.zIndex);
    return resolved;
  }

  private _resolveElement(
    el: SceneElement,
    elLocalTime: number,
    _staggerDelay: number
  ): ResolvedElementBase {
    const anim = el.animation ?? {};

    const resolve = (
      key: keyof AnimationConfig,
      staticVal: number | undefined,
      fallback: number
    ): number => {
      const propAnim = anim[key];
      if (propAnim) {
        return evaluatePropertyAnimation(propAnim, elLocalTime, staticVal ?? fallback);
      }
      return staticVal ?? fallback;
    };

    return {
      id:        el.id,
      name:      el.name,
      type:      el.type,
      x:         resolve("x",        el.x,        0),
      y:         resolve("y",        el.y,        0),
      width:     resolve("width",    el.width,    100),
      height:    resolve("height",   el.height,   100),
      originX:   el.originX ?? 0.5,
      originY:   el.originY ?? 0.5,
      opacity:   resolve("opacity",  el.opacity,  1),
      scaleX:    resolve("scaleX",   el.scaleX,   1),
      scaleY:    resolve("scaleY",   el.scaleY,   1),
      rotation:  resolve("rotation", el.rotation, 0),
      blur:      resolve("blur",     undefined,   0),
      zIndex:    el.zIndex ?? 0,
      blendMode: el.blendMode ?? "source-over",
      filter:    el.filter   ?? "",
      raw:       el,
    };
  }
}

// ─── Stagger builder helpers ──────────────────────────────────────────────────

/**
 * Convenience: create a stagger group from a list of element IDs.
 *
 * @param elementIds  IDs in reveal order.
 * @param stagger     Per-element delay in seconds (e.g. 0.08).
 * @param groupDelay  Extra delay before the first element (e.g. 0.2).
 */
export function createStaggerGroup(
  elementIds: string[],
  stagger: number,
  groupDelay = 0
): StaggerGroup {
  return { elementIds, stagger, groupDelay };
}

// ─── Utility: compute css filter string from blur value ───────────────────────

export function blurFilter(px: number): string {
  return px > 0 ? `blur(${px}px)` : "";
}

// ─── Re-export easing for external use ───────────────────────────────────────

export type { EasingName };
export { colorToCSS };
