/**
 * Animation Design Tokens
 *
 * Timing, easing, and transition presets that give Spotlight its cinematic
 * rhythm. Values are tuned for 60fps video output on a 1920×1080 canvas.
 */

// ─── Easing presets ───────────────────────────────────────────────────────────

/**
 * CSS cubic-bezier strings — also accepted by the canvas renderer's
 * keyframe interpolator.
 */
export const easings = {
  /** Default smooth ease-in-out — works for 90% of transitions */
  smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
  /** Fast-out/slow-in — snappy response for UI interactions */
  snappy: "cubic-bezier(0.4, 0, 1, 1)",
  /** Overshoots slightly then settles — playful, spring-like */
  bouncy: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  /** Very slow ease — calm, cinematic camera-like moves */
  gentle: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  /** Custom spring approximation — fast start, elastic settle */
  spring: "cubic-bezier(0.5, 1.8, 0.4, 0.8)",
  /** Linear — useful for continuous loops */
  linear: "linear",
  /** Ease-out only — elements arriving on screen */
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
  /** Ease-in only — elements leaving screen */
  easeIn: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

export type Easing = keyof typeof easings;

// ─── Duration presets (ms) ────────────────────────────────────────────────────

export const durations = {
  /** Near-imperceptible flash — micro-interactions */
  instant: 100,
  /** Crisp UI response — hover states, badge pops */
  fast: 200,
  /** Standard element transition */
  normal: 400,
  /** Considered, deliberate transitions */
  slow: 600,
  /** Scene-level, cinematic movements */
  dramatic: 1000,
} as const;

export type Duration = keyof typeof durations;

// ─── Stagger presets (ms between siblings) ───────────────────────────────────

export const staggers = {
  /** Very tight — feels like a single unit */
  tight: 40,
  /** Standard list stagger — readable sequencing */
  normal: 80,
  /** Relaxed — gives each item room to breathe */
  relaxed: 120,
  /** Dramatic — each item is its own moment */
  dramatic: 200,
} as const;

export type Stagger = keyof typeof staggers;

// ─── Element transition presets ───────────────────────────────────────────────

/**
 * Each preset describes the keyframe delta applied to a SceneElement.
 * `from` is the state at time 0; `to` is the fully-revealed state.
 * The renderer lerps between them over `duration` ms using `easing`.
 */
export interface TransitionPreset {
  from: Record<string, number>;
  to: Record<string, number>;
  duration: number; // ms
  easing: string;
}

export const transitions: Record<string, TransitionPreset> = {
  fadeIn: {
    from: { opacity: 0 },
    to: { opacity: 1 },
    duration: durations.normal,
    easing: easings.smooth,
  },
  fadeOut: {
    from: { opacity: 1 },
    to: { opacity: 0 },
    duration: durations.normal,
    easing: easings.smooth,
  },
  slideUp: {
    from: { opacity: 0, translateY: 40 },
    to: { opacity: 1, translateY: 0 },
    duration: durations.normal,
    easing: easings.smooth,
  },
  slideDown: {
    from: { opacity: 0, translateY: -40 },
    to: { opacity: 1, translateY: 0 },
    duration: durations.normal,
    easing: easings.smooth,
  },
  slideLeft: {
    from: { opacity: 0, translateX: 60 },
    to: { opacity: 1, translateX: 0 },
    duration: durations.normal,
    easing: easings.smooth,
  },
  slideRight: {
    from: { opacity: 0, translateX: -60 },
    to: { opacity: 1, translateX: 0 },
    duration: durations.normal,
    easing: easings.smooth,
  },
  scaleIn: {
    from: { opacity: 0, scale: 0.85 },
    to: { opacity: 1, scale: 1 },
    duration: durations.normal,
    easing: easings.bouncy,
  },
  scaleOut: {
    from: { opacity: 1, scale: 1 },
    to: { opacity: 0, scale: 1.1 },
    duration: durations.fast,
    easing: easings.easeIn,
  },
  /**
   * Text line sweeps up from below a clipping boundary — classic editorial
   * reveal used by Apple and Linear.
   */
  revealUp: {
    from: { opacity: 0, translateY: 100, scale: 0.96 },
    to: { opacity: 1, translateY: 0, scale: 1 },
    duration: durations.slow,
    easing: easings.smooth,
  },
  blur: {
    from: { opacity: 0, scale: 1.05 },
    to: { opacity: 1, scale: 1 },
    duration: durations.slow,
    easing: easings.gentle,
  },
};

// ─── Scene transition presets ─────────────────────────────────────────────────

export interface SceneTransitionPreset {
  type: string;
  duration: number; // ms — overlap between adjacent scenes
}

export const sceneTransitions: Record<string, SceneTransitionPreset> = {
  crossfade: { type: "crossfade", duration: 500 },
  wipeLeft: { type: "wipeLeft", duration: 600 },
  wipeRight: { type: "wipeRight", duration: 600 },
  zoomIn: { type: "zoomIn", duration: 700 },
  dissolve: { type: "dissolve", duration: 800 },
};

// ─── Helper: build a staggered start-time array ──────────────────────────────

/**
 * Generate an array of start times for N sibling elements.
 *
 * @param count       - number of elements
 * @param baseTime    - time at which the first element starts (seconds)
 * @param staggerMs   - gap between consecutive elements (ms)
 */
export function staggeredTimes(
  count: number,
  baseTime: number,
  staggerMs: number
): number[] {
  return Array.from({ length: count }, (_, i) => baseTime + (i * staggerMs) / 1000);
}

/**
 * Build a standard two-keyframe animation block.
 * Time values are in seconds (matching Scene/SceneElement conventions).
 */
export function buildKeyframes(
  startTime: number,
  preset: TransitionPreset
): { time: number; props: Record<string, number> }[] {
  const endTime = startTime + preset.duration / 1000;
  return [
    { time: startTime, props: preset.from },
    { time: endTime, props: preset.to },
  ];
}
