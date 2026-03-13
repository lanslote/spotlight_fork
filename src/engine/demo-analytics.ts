/**
 * DemoAnalytics — client-side analytics tracking for interactive demos.
 *
 * All data is stored in localStorage — no server required.
 *
 * Pipeline:
 *   user interactions (step views, hotspot clicks, branch navigations, …)
 *     → AnalyticsEvent[] stored per demo in localStorage
 *       → computeMetrics() → DemoMetrics (views, funnels, drop-off rankings)
 *         → exportAsCSV() / exportAsJSON() for offline analysis
 *
 * Storage layout:
 *   spotlight_analytics_${demoId}         → JSON array of AnalyticsEvent
 *   spotlight_analytics_${demoId}_metrics → JSON DemoMetrics (computed cache)
 *
 * Limits:
 *  - Maximum 10 000 events per demo (FIFO eviction when exceeded).
 *  - Sessions auto-end after 30 minutes of inactivity.
 *
 * SSR safety: every localStorage access is guarded with
 * `typeof window !== 'undefined'` checks so this module can be imported in
 * Next.js server components without error.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalyticsEvent {
  type: "step-view" | "hotspot-click" | "completion" | "drop-off" | "branch-taken" | "chapter-enter";
  demoId: string;
  stepId?: string;
  hotspotId?: string;
  chapterId?: string;
  /** Source step for branch-taken events. */
  fromStepId?: string;
  /** Target step for branch-taken events. */
  toStepId?: string;
  timestamp: number;
  /** Time spent on the current step before this event (seconds). */
  timeOnStep?: number;
  /** Session ID for grouping events. */
  sessionId: string;
}

export interface StepMetrics {
  stepId: string;
  views: number;
  avgTimeSpent: number;  // seconds
  dropOffCount: number;  // viewers who stopped at this step
  hotspotClicks: Record<string, number>; // hotspotId → click count
  completionRate: number; // fraction who proceeded past this step
}

export interface DemoMetrics {
  demoId: string;
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  avgDuration: number; // seconds
  stepMetrics: StepMetrics[];
  branchPaths: Array<{ from: string; to: string; count: number }>;
  /** Step IDs ordered by drop-off rate (highest first). */
  dropOffRanking: string[];
  lastUpdated: number;
}

export interface FunnelData {
  steps: Array<{
    stepId: string;
    title: string;
    viewCount: number;
    percentage: number; // relative to first step views
  }>;
}

export interface AnalyticsExport {
  demoId: string;
  events: AnalyticsEvent[];
  metrics: DemoMetrics;
  exportedAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum events stored per demo (FIFO eviction). */
const MAX_EVENTS = 10_000;

/** Session inactivity timeout in milliseconds (30 minutes). */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// ─── DemoAnalytics ────────────────────────────────────────────────────────────

/**
 * Client-side analytics tracker for a single interactive demo.
 *
 * ```ts
 * const analytics = new DemoAnalytics("demo_abc123");
 * analytics.startSession();
 *
 * analytics.trackStepView("step-1");
 * analytics.trackHotspotClick("step-1", "hotspot-cta");
 * analytics.trackBranch("step-2", "step-4");
 *
 * analytics.endSession();
 *
 * const metrics = analytics.computeMetrics();
 * const csv     = analytics.exportAsCSV();
 * ```
 */
export class DemoAnalytics {
  private readonly _demoId: string;

  /** Active session ID, or null between sessions. */
  private _sessionId: string | null = null;

  /** Timestamp (ms) when the current step view began. */
  private _stepStartTime: number | null = null;

  /** Currently viewed step ID. */
  private _currentStepId: string | null = null;

  /** Inactivity timer handle. */
  private _inactivityTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(demoId: string) {
    this._demoId = demoId;
  }

  // ── Session lifecycle ────────────────────────────────────────────────────

  /**
   * Begin tracking a new viewing session.
   * Generates a fresh session ID and resets inactivity tracking.
   */
  startSession(): void {
    this._sessionId   = _generateSessionId();
    this._stepStartTime = Date.now();
    this._currentStepId = null;
    this._resetInactivityTimer();
  }

  /**
   * Mark the current session as ended.
   * Emits a "completion" or "drop-off" event depending on whether the last
   * tracked step was the final step in the observed sequence.
   *
   * If no session is active this is a no-op.
   */
  endSession(): void {
    if (!this._sessionId) return;

    // Record drop-off on the last known step if the session wasn't explicitly
    // completed by a "completion" event already recorded by the caller.
    const events = this._loadEvents();
    const hasCompletion = events.some(
      (e) => e.sessionId === this._sessionId && e.type === "completion",
    );

    if (!hasCompletion && this._currentStepId) {
      this._record({
        type:       "drop-off",
        stepId:     this._currentStepId,
        timeOnStep: this._elapsedOnStep(),
      });
    }

    this._clearInactivityTimer();
    this._sessionId     = null;
    this._currentStepId = null;
    this._stepStartTime = null;
  }

  // ── Tracking methods ─────────────────────────────────────────────────────

  /**
   * Record that a demo step was viewed.
   *
   * @param stepId - ID of the step now being shown.
   */
  trackStepView(stepId: string): void {
    // Flush time-on-step for the previous step before switching.
    if (this._currentStepId && this._currentStepId !== stepId) {
      this.trackTimeOnStep(this._currentStepId, this._elapsedOnStep());
    }

    this._currentStepId = stepId;
    this._stepStartTime = Date.now();
    this._resetInactivityTimer();

    this._record({ type: "step-view", stepId });
  }

  /**
   * Record a hotspot click on a specific step.
   *
   * @param stepId    - Step the hotspot belongs to.
   * @param hotspotId - ID of the clicked hotspot element.
   */
  trackHotspotClick(stepId: string, hotspotId: string): void {
    this._resetInactivityTimer();
    this._record({
      type:       "hotspot-click",
      stepId,
      hotspotId,
      timeOnStep: this._elapsedOnStep(),
    });
  }

  /**
   * Record a branch navigation between two steps.
   *
   * @param fromStepId - The step being navigated away from.
   * @param toStepId   - The step being navigated to.
   */
  trackBranch(fromStepId: string, toStepId: string): void {
    this._resetInactivityTimer();
    this._record({
      type:       "branch-taken",
      fromStepId,
      toStepId,
      timeOnStep: this._elapsedOnStep(),
    });
  }

  /**
   * Record entry into a named chapter.
   *
   * @param chapterId - ID of the chapter now active.
   */
  trackChapterEnter(chapterId: string): void {
    this._resetInactivityTimer();
    this._record({ type: "chapter-enter", chapterId });
  }

  /**
   * Explicitly record time spent on a step (seconds).
   * Called automatically by trackStepView when switching steps.
   *
   * @param stepId   - The step time was spent on.
   * @param duration - Duration in seconds.
   */
  trackTimeOnStep(stepId: string, duration: number): void {
    if (duration <= 0) return;
    this._record({ type: "step-view", stepId, timeOnStep: duration });
  }

  // ── Metric computation ───────────────────────────────────────────────────

  /**
   * Aggregate all stored events for this demo into a {@link DemoMetrics} object.
   *
   * Computed values:
   *  - totalSessions, completedSessions, completionRate
   *  - avgDuration (seconds between first and last event per session)
   *  - Per-step metrics: views, avgTimeSpent, dropOffCount, hotspotClicks, completionRate
   *  - branchPaths and dropOffRanking
   *
   * @returns Computed metrics. Also persists the result to localStorage.
   */
  computeMetrics(): DemoMetrics {
    const events = this._loadEvents();

    // ── Sessions ────────────────────────────────────────────────────────────
    const sessionIds = new Set(events.map((e) => e.sessionId));
    const totalSessions = sessionIds.size;

    const completedSessionIds = new Set(
      events.filter((e) => e.type === "completion").map((e) => e.sessionId),
    );
    const completedSessions = completedSessionIds.size;

    const completionRate = totalSessions > 0
      ? completedSessions / totalSessions
      : 0;

    // ── Average session duration ────────────────────────────────────────────
    let totalDurationMs = 0;
    let sessionDurationCount = 0;

    for (const sid of Array.from(sessionIds)) {
      const sessionEvents = events.filter((e) => e.sessionId === sid);
      if (sessionEvents.length < 2) continue;

      const timestamps = sessionEvents.map((e) => e.timestamp).sort((a, b) => a - b);
      totalDurationMs += timestamps[timestamps.length - 1] - timestamps[0];
      sessionDurationCount++;
    }

    const avgDuration =
      sessionDurationCount > 0
        ? totalDurationMs / sessionDurationCount / 1000
        : 0;

    // ── Per-step metrics ────────────────────────────────────────────────────
    const viewEvents    = events.filter((e) => e.type === "step-view" && e.stepId);
    const dropOffEvents = events.filter((e) => e.type === "drop-off" && e.stepId);

    const allStepIds = new Set([
      ...viewEvents.map((e) => e.stepId!),
      ...dropOffEvents.map((e) => e.stepId!),
    ]);

    const stepMetrics: StepMetrics[] = [];

    for (const stepId of Array.from(allStepIds)) {
      const stepViews = viewEvents.filter((e) => e.stepId === stepId);

      // Sessions that viewed this step.
      const viewingSessions = new Set(stepViews.map((e) => e.sessionId));

      // Sessions that dropped off on this step.
      const dropSessions = new Set(
        dropOffEvents
          .filter((e) => e.stepId === stepId)
          .map((e) => e.sessionId),
      );

      // Average time on step from events that carry timeOnStep.
      const timeSamples = stepViews
        .map((e) => e.timeOnStep)
        .filter((t): t is number => typeof t === "number" && t > 0);

      const avgTimeSpent =
        timeSamples.length > 0
          ? timeSamples.reduce((a, b) => a + b, 0) / timeSamples.length
          : 0;

      // Hotspot click counts.
      const hotspotClicks: Record<string, number> = {};
      for (const e of events) {
        if (e.type === "hotspot-click" && e.stepId === stepId && e.hotspotId) {
          hotspotClicks[e.hotspotId] = (hotspotClicks[e.hotspotId] ?? 0) + 1;
        }
      }

      // Completion rate: fraction of viewing sessions that did NOT drop off here.
      const stepCompletionRate =
        viewingSessions.size > 0
          ? 1 - dropSessions.size / viewingSessions.size
          : 1;

      stepMetrics.push({
        stepId,
        views:          viewingSessions.size,
        avgTimeSpent,
        dropOffCount:   dropSessions.size,
        hotspotClicks,
        completionRate: stepCompletionRate,
      });
    }

    // ── Branch paths ────────────────────────────────────────────────────────
    const branchPaths = this.getBranchPaths();

    // ── Drop-off ranking (highest drop-off rate first) ──────────────────────
    const dropOffRanking = [...stepMetrics]
      .filter((s) => s.dropOffCount > 0)
      .sort((a, b) => {
        const rateA = a.views > 0 ? a.dropOffCount / a.views : 0;
        const rateB = b.views > 0 ? b.dropOffCount / b.views : 0;
        return rateB - rateA;
      })
      .map((s) => s.stepId);

    const metrics: DemoMetrics = {
      demoId: this._demoId,
      totalSessions,
      completedSessions,
      completionRate,
      avgDuration,
      stepMetrics,
      branchPaths,
      dropOffRanking,
      lastUpdated: Date.now(),
    };

    // Persist computed metrics.
    _setLocalStorage(`${_storageKey(this._demoId)}_metrics`, JSON.stringify(metrics));

    return metrics;
  }

  /**
   * Compute a step-by-step funnel for the provided ordered step IDs.
   *
   * @param stepIds - Ordered step IDs defining the funnel.
   * @returns FunnelData with view counts and percentages relative to step 0.
   */
  getFunnel(stepIds: string[]): FunnelData {
    const events   = this._loadEvents();
    const viewMap  = new Map<string, Set<string>>(); // stepId → set of sessionIds

    for (const e of events) {
      if (e.type === "step-view" && e.stepId) {
        if (!viewMap.has(e.stepId)) viewMap.set(e.stepId, new Set());
        viewMap.get(e.stepId)!.add(e.sessionId);
      }
    }

    const firstCount = stepIds.length > 0
      ? (viewMap.get(stepIds[0])?.size ?? 0)
      : 0;

    return {
      steps: stepIds.map((stepId) => {
        const viewCount = viewMap.get(stepId)?.size ?? 0;
        return {
          stepId,
          title:      stepId, // callers can enrich with display titles
          viewCount,
          percentage: firstCount > 0 ? viewCount / firstCount : 0,
        };
      }),
    };
  }

  /**
   * Return metrics for a single step.
   * Calls {@link computeMetrics} internally so results are always fresh.
   *
   * @param stepId - The step to retrieve metrics for.
   * @returns StepMetrics or a zero-value object if the step has no data.
   */
  getStepMetrics(stepId: string): StepMetrics {
    const { stepMetrics } = this.computeMetrics();
    return (
      stepMetrics.find((s) => s.stepId === stepId) ?? {
        stepId,
        views:          0,
        avgTimeSpent:   0,
        dropOffCount:   0,
        hotspotClicks:  {},
        completionRate: 1,
      }
    );
  }

  /**
   * Aggregate all branch-taken events into a de-duplicated list of paths with
   * traversal counts.
   *
   * @returns Array of { from, to, count } objects.
   */
  getBranchPaths(): Array<{ from: string; to: string; count: number }> {
    const events = this._loadEvents();
    const counts = new Map<string, number>();

    for (const e of events) {
      if (e.type === "branch-taken" && e.fromStepId && e.toStepId) {
        const key = `${e.fromStepId}→${e.toStepId}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries()).map(([key, count]) => {
      const [from, to] = key.split("→");
      return { from, to, count };
    });
  }

  // ── Export ───────────────────────────────────────────────────────────────

  /**
   * Export all stored events as a CSV string.
   *
   * Columns: type, demoId, stepId, hotspotId, chapterId, fromStepId, toStepId,
   *          timestamp, timeOnStep, sessionId
   *
   * @returns CSV string including header row.
   */
  exportAsCSV(): string {
    const events = this._loadEvents();

    const header = [
      "type",
      "demoId",
      "stepId",
      "hotspotId",
      "chapterId",
      "fromStepId",
      "toStepId",
      "timestamp",
      "timeOnStep",
      "sessionId",
    ].join(",");

    const rows = events.map((e) =>
      [
        _csvCell(e.type),
        _csvCell(e.demoId),
        _csvCell(e.stepId ?? ""),
        _csvCell(e.hotspotId ?? ""),
        _csvCell(e.chapterId ?? ""),
        _csvCell(e.fromStepId ?? ""),
        _csvCell(e.toStepId ?? ""),
        e.timestamp,
        e.timeOnStep ?? "",
        _csvCell(e.sessionId),
      ].join(","),
    );

    return [header, ...rows].join("\n");
  }

  /**
   * Export all stored events and computed metrics as a JSON string.
   *
   * @returns Serialised {@link AnalyticsExport} object.
   */
  exportAsJSON(): string {
    const payload: AnalyticsExport = {
      demoId:     this._demoId,
      events:     this._loadEvents(),
      metrics:    this.computeMetrics(),
      exportedAt: Date.now(),
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Delete all stored analytics data for this demo (events + metrics cache).
   */
  clearData(): void {
    _removeLocalStorage(_storageKey(this._demoId));
    _removeLocalStorage(`${_storageKey(this._demoId)}_metrics`);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Build and persist a single {@link AnalyticsEvent}, enforcing the 10 000
   * event cap via FIFO eviction.
   */
  private _record(
    partial: Omit<AnalyticsEvent, "demoId" | "timestamp" | "sessionId">,
  ): void {
    if (!this._sessionId) return; // no active session

    const event: AnalyticsEvent = {
      ...partial,
      demoId:    this._demoId,
      timestamp: Date.now(),
      sessionId: this._sessionId,
    };

    const events = this._loadEvents();
    events.push(event);

    // FIFO eviction: drop oldest events when cap is exceeded.
    const trimmed = events.length > MAX_EVENTS
      ? events.slice(events.length - MAX_EVENTS)
      : events;

    _setLocalStorage(_storageKey(this._demoId), JSON.stringify(trimmed));
  }

  /** Load and parse the stored event array for this demo. */
  private _loadEvents(): AnalyticsEvent[] {
    const raw = _getLocalStorage(_storageKey(this._demoId));
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as AnalyticsEvent[]) : [];
    } catch {
      return [];
    }
  }

  /** Return the seconds elapsed since the current step view started. */
  private _elapsedOnStep(): number {
    if (this._stepStartTime === null) return 0;
    return (Date.now() - this._stepStartTime) / 1000;
  }

  /** Reset the 30-minute inactivity timer. */
  private _resetInactivityTimer(): void {
    this._clearInactivityTimer();

    if (typeof window === "undefined") return;

    this._inactivityTimer = setTimeout(() => {
      // Auto-end session after 30 minutes of no tracked activity.
      this.endSession();
    }, SESSION_TIMEOUT_MS);
  }

  /** Clear any pending inactivity timer. */
  private _clearInactivityTimer(): void {
    if (this._inactivityTimer !== null) {
      clearTimeout(this._inactivityTimer);
      this._inactivityTimer = null;
    }
  }
}

// ─── Module-private helpers ───────────────────────────────────────────────────

/** Generate a unique session identifier. */
function _generateSessionId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Derive the localStorage key for a given demo's event log. */
function _storageKey(demoId: string): string {
  return `spotlight_analytics_${demoId}`;
}

/** SSR-safe localStorage.getItem wrapper. */
function _getLocalStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** SSR-safe localStorage.setItem wrapper. */
function _setLocalStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Quota exceeded or private browsing restriction — fail silently.
  }
}

/** SSR-safe localStorage.removeItem wrapper. */
function _removeLocalStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Fail silently.
  }
}

/**
 * Wrap a cell value for CSV export.
 * Strings containing commas, quotes, or newlines are quoted and internal
 * double-quotes are escaped by doubling.
 */
function _csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
