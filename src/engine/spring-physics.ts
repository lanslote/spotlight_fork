/**
 * spring-physics.ts
 *
 * Mass-spring-damper simulation utility for camera movements and cursor
 * smoothing in the video engine.
 *
 * Physics model: F = -stiffness * displacement - damping * velocity
 * Integration: semi-implicit (symplectic) Euler
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Configuration parameters for a mass-spring-damper system. */
export interface SpringConfig {
  /** Spring stiffness constant (N/m). Higher values produce snappier motion. */
  stiffness: number;
  /** Damping coefficient (N·s/m). Higher values reduce oscillation. */
  damping: number;
  /** Simulated mass (kg). Higher values produce slower, heavier motion. */
  mass: number;
  /**
   * Convergence threshold for both velocity and displacement.
   * The spring is considered settled when both fall below this value.
   * Defaults to 0.001.
   */
  precision?: number;
}

// ---------------------------------------------------------------------------
// Preset configs
// ---------------------------------------------------------------------------

/** Responsive spring suitable for camera pan and zoom transitions. */
export const CAMERA_SPRING: SpringConfig = {
  stiffness: 120,
  damping: 15,
  mass: 1,
} as const;

/** Tight, high-frequency spring for cursor and pointer tracking. */
export const CURSOR_SPRING: SpringConfig = {
  stiffness: 180,
  damping: 20,
  mass: 0.8,
} as const;

/** Slow, heavily damped spring for subtle ambient animations. */
export const GENTLE_SPRING: SpringConfig = {
  stiffness: 60,
  damping: 12,
  mass: 1,
} as const;

// ---------------------------------------------------------------------------
// SpringSimulator
// ---------------------------------------------------------------------------

/**
 * Simulates a 1-D mass-spring-damper system.
 *
 * @example
 * ```ts
 * const sim = new SpringSimulator(CAMERA_SPRING);
 * sim.setTarget(100);
 * // In your render loop:
 * const x = sim.update(deltaTime);
 * ```
 */
export class SpringSimulator {
  private _value: number = 0;
  private _velocity: number = 0;
  private _target: number = 0;
  private readonly _stiffness: number;
  private readonly _damping: number;
  private readonly _mass: number;
  private readonly _precision: number;

  constructor(config: SpringConfig) {
    this._stiffness = config.stiffness;
    this._damping = config.damping;
    this._mass = config.mass;
    this._precision = config.precision ?? 0.001;
  }

  // -- Getters ---------------------------------------------------------------

  /** Current simulated value. */
  get value(): number {
    return this._value;
  }

  /** Current velocity (units per second). */
  get velocity(): number {
    return this._velocity;
  }

  /** The target value the spring is moving toward. */
  get target(): number {
    return this._target;
  }

  // -- Control ---------------------------------------------------------------

  /**
   * Set the target the spring should move toward.
   * Does not alter the current value or velocity.
   */
  setTarget(target: number): void {
    this._target = target;
  }

  /**
   * Instantly set the current value without changing velocity or target.
   * Useful for teleporting without a transition.
   */
  setValue(value: number): void {
    this._value = value;
  }

  /**
   * Reset the simulator to an optional value with zero velocity.
   * Also resets the target to the same value so the spring starts at rest.
   *
   * @param value - Starting value; defaults to 0.
   */
  reset(value: number = 0): void {
    this._value = value;
    this._velocity = 0;
    this._target = value;
  }

  // -- Simulation ------------------------------------------------------------

  /**
   * Advance the simulation by `dt` seconds using semi-implicit Euler
   * integration and return the updated value.
   *
   * F = -stiffness * displacement - damping * velocity
   * acceleration = F / mass
   * velocity += acceleration * dt   (semi-implicit: velocity updated first)
   * position += velocity * dt
   *
   * @param dt - Time step in seconds. Typical values: 1/60, 1/120.
   */
  update(dt: number): number {
    const displacement = this._value - this._target;
    const force = -this._stiffness * displacement - this._damping * this._velocity;
    const acceleration = force / this._mass;

    // Semi-implicit Euler: update velocity before position
    this._velocity += acceleration * dt;
    this._value += this._velocity * dt;

    return this._value;
  }

  /**
   * Returns `true` when the spring has effectively come to rest — both the
   * distance to the target and the current velocity are below `precision`.
   */
  isSettled(): boolean {
    return (
      Math.abs(this._value - this._target) < this._precision &&
      Math.abs(this._velocity) < this._precision
    );
  }
}

// ---------------------------------------------------------------------------
// Spring2D
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper around two {@link SpringSimulator} instances for
 * simulating 2-D motion (e.g. cursor position, camera offset).
 */
export class Spring2D {
  private readonly _x: SpringSimulator;
  private readonly _y: SpringSimulator;

  constructor(config: SpringConfig) {
    this._x = new SpringSimulator(config);
    this._y = new SpringSimulator(config);
  }

  // -- Getters ---------------------------------------------------------------

  /** Current x value. */
  get x(): number {
    return this._x.value;
  }

  /** Current y value. */
  get y(): number {
    return this._y.value;
  }

  // -- Control ---------------------------------------------------------------

  /** Set the 2-D target position. */
  setTarget(x: number, y: number): void {
    this._x.setTarget(x);
    this._y.setTarget(y);
  }

  /** Instantly move to a position without transitioning. */
  setValue(x: number, y: number): void {
    this._x.setValue(x);
    this._y.setValue(y);
  }

  /**
   * Reset both axes to optional starting coordinates with zero velocity.
   *
   * @param x - Starting x; defaults to 0.
   * @param y - Starting y; defaults to 0.
   */
  reset(x: number = 0, y: number = 0): void {
    this._x.reset(x);
    this._y.reset(y);
  }

  // -- Simulation ------------------------------------------------------------

  /**
   * Advance both axes by `dt` seconds and return the updated position.
   *
   * @param dt - Time step in seconds.
   */
  update(dt: number): { x: number; y: number } {
    return {
      x: this._x.update(dt),
      y: this._y.update(dt),
    };
  }

  /**
   * Returns `true` when both the x and y simulators have settled.
   */
  isSettled(): boolean {
    return this._x.isSettled() && this._y.isSettled();
  }
}

// ---------------------------------------------------------------------------
// springLerp
// ---------------------------------------------------------------------------

/**
 * Performs a single-step spring interpolation from `from` toward `to`.
 *
 * Creates a temporary {@link SpringSimulator}, positions it at `from` with
 * the given config, sets the target to `to`, advances by `t` seconds, and
 * returns the resulting value. Useful for one-shot easing without maintaining
 * simulator state.
 *
 * @param from   - Starting value.
 * @param to     - Target value.
 * @param t      - Time step in seconds.
 * @param config - Spring configuration.
 * @returns The interpolated value after one physics step.
 *
 * @example
 * ```ts
 * // Ease a camera zoom value toward 2× over one frame at 60 fps
 * const zoom = springLerp(currentZoom, 2.0, 1 / 60, CAMERA_SPRING);
 * ```
 */
export function springLerp(
  from: number,
  to: number,
  t: number,
  config: SpringConfig,
): number {
  const sim = new SpringSimulator(config);
  sim.setValue(from);
  sim.setTarget(to);
  return sim.update(t);
}
