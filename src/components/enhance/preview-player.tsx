"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn, formatDuration } from "@/lib/utils";
import type { Compositor } from "@/engine/compositor";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PreviewPlayerProps {
  /** The compositor instance that renders frames */
  compositor: Compositor | null;
  /** Source video element */
  videoElement: HTMLVideoElement | null;
  /** Total duration in seconds */
  duration: number;
  /** Output dimensions */
  width: number;
  height: number;
  /** Called when current time changes */
  onTimeChange?: (time: number) => void;
  className?: string;
}

type PlaybackSpeed = 0.5 | 1 | 2;

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 2];

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function IconPlay({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6.3 4.25a.75.75 0 0 0-1.05.68v10.14a.75.75 0 0 0 1.05.68l9-5.07a.75.75 0 0 0 0-1.36l-9-5.07Z" />
    </svg>
  );
}

function IconPause({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.75 4a.75.75 0 0 0-.75.75v10.5a.75.75 0 0 0 1.5 0V4.75A.75.75 0 0 0 5.75 4Zm8.5 0a.75.75 0 0 0-.75.75v10.5a.75.75 0 0 0 1.5 0V4.75A.75.75 0 0 0 14.25 4Z"
      />
    </svg>
  );
}

function IconRestart({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4.5 7.5A5.5 5.5 0 0 1 15.5 10" />
      <path d="M2 5.5l2.5 2 2.5-2" />
    </svg>
  );
}

function IconFullscreen({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
    </svg>
  );
}

function IconExitFullscreen({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 3v4H3M13 3v4h4M17 13h-4v4M7 17v-4H3" />
    </svg>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  current: number;
  duration: number;
  onSeek: (time: number) => void;
}

function ProgressBar({ current, duration, onSeek }: ProgressBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const getTimeFromEvent = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track || duration <= 0) return 0;
      const rect = track.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return fraction * duration;
    },
    [duration]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      isDraggingRef.current = true;
      onSeek(getTimeFromEvent(e.clientX));
    },
    [getTimeFromEvent, onSeek]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      onSeek(getTimeFromEvent(e.clientX));
    },
    [getTimeFromEvent, onSeek]
  );

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const pct = duration > 0 ? Math.min(1, current / duration) * 100 : 0;

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuenow={Math.round(current)}
      aria-label="Playback position"
      tabIndex={0}
      className="relative h-1.5 bg-zinc-700 rounded-full cursor-pointer group/progress"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Filled portion */}
      <div
        className="absolute inset-y-0 left-0 bg-violet-500 rounded-full pointer-events-none"
        style={{ width: `${pct}%` }}
      />
      {/* Scrubber thumb — shown on hover / drag */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-violet-400 opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none shadow-md"
        style={{ left: `calc(${pct}% - 6px)` }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PreviewPlayer({
  compositor,
  videoElement,
  duration,
  width,
  height,
  onTimeChange,
  className,
}: PreviewPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // RAF / playback state kept in refs to avoid triggering re-renders per frame
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null); // wall clock when play started
  const pausedAtRef = useRef<number>(0);            // video time when paused / seeked
  const speedRef = useRef<PlaybackSpeed>(1);
  const isPlayingRef = useRef(false);

  // React state drives the UI only
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [displayDimensions, setDisplayDimensions] = useState({ w: width, h: height });
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keep speed ref in sync with state
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // Keep isPlayingRef in sync with state
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // ── Canvas sizing via ResizeObserver ────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ratio = width / height;

    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const containerW = entry.contentRect.width;
      const containerH = entry.contentRect.height;

      let w = containerW;
      let h = containerW / ratio;
      if (h > containerH) {
        h = containerH;
        w = containerH * ratio;
      }

      setDisplayDimensions({ w: Math.round(w), h: Math.round(h) });
    });

    obs.observe(el);
    return () => obs.disconnect();
  }, [width, height]);

  // ── RAF loop ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const loop = (now: number) => {
      // Advance time only when playing
      if (isPlayingRef.current && duration > 0) {
        if (startTimeRef.current === null) {
          // Resuming from a pause/seek — anchor wall clock to current position
          startTimeRef.current = now - (pausedAtRef.current / speedRef.current) * 1000;
        }
        const wallElapsed = (now - startTimeRef.current) / 1000;
        let t = wallElapsed * speedRef.current;

        // Clamp to duration and stop at the end
        if (t >= duration) {
          t = duration;
          pausedAtRef.current = duration;
          startTimeRef.current = null;
          isPlayingRef.current = false;
          setIsPlaying(false);
          setCurrentTime(duration);
          onTimeChange?.(duration);
          rafRef.current = requestAnimationFrame(loop);
          return;
        }

        pausedAtRef.current = t;
        setCurrentTime(t);
        onTimeChange?.(t);
      } else {
        // Paused — reset wall anchor so that resume starts cleanly
        startTimeRef.current = null;
      }

      // Render the current frame
      const t = pausedAtRef.current;

      if (compositor && videoElement) {
        // Seek the source video element to the desired position
        if (Math.abs(videoElement.currentTime - t) > 0.05) {
          videoElement.currentTime = t;
        }
        compositor.compositeFrame(videoElement, t, canvas);
      } else {
        // Draw a placeholder when compositor or video isn't ready
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#09090b";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [compositor, videoElement, duration, onTimeChange]);

  // ── Playback controls ───────────────────────────────────────────────────────

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (!next) {
        // Pausing — freeze wall clock anchor
        startTimeRef.current = null;
      }
      return next;
    });
  }, []);

  const handleRestart = useCallback(() => {
    pausedAtRef.current = 0;
    startTimeRef.current = null;
    setCurrentTime(0);
    onTimeChange?.(0);
    setIsPlaying(true);
  }, [onTimeChange]);

  const handleSeek = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(duration, time));
      pausedAtRef.current = clamped;
      startTimeRef.current = null; // force wall-clock re-anchor on next tick
      setCurrentTime(clamped);
      onTimeChange?.(clamped);
    },
    [duration, onTimeChange]
  );

  const handleSpeedChange = useCallback((s: PlaybackSpeed) => {
    // Re-anchor wall clock so playback position doesn't jump on speed change
    startTimeRef.current = null;
    setSpeed(s);
  }, []);

  const handleFullscreen = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Sync fullscreen state on external exit (e.g. Escape key)
  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only respond when focus is inside our wrapper or wrapper has no focused child
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      if (!wrapper.contains(document.activeElement) && document.activeElement !== document.body) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          handlePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSeek(pausedAtRef.current - 1);
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSeek(pausedAtRef.current + 1);
          break;
        case "Home":
          e.preventDefault();
          handleSeek(0);
          break;
        case "End":
          e.preventDefault();
          handleSeek(duration);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handlePlayPause, handleSeek, duration]);

  // ── Loading state ───────────────────────────────────────────────────────────

  const isLoading = compositor === null || videoElement === null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      ref={wrapperRef}
      tabIndex={-1}
      className={cn(
        "relative flex flex-col bg-zinc-950 rounded-xl overflow-hidden outline-none",
        "focus-within:ring-1 focus-within:ring-violet-500/30",
        className
      )}
    >
      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative flex-1 flex items-center justify-center bg-zinc-950 overflow-hidden min-h-0"
      >
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-zinc-950">
            <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-violet-500 animate-spin" />
            <span className="text-sm text-zinc-500">Loading preview…</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={displayDimensions.w}
          height={displayDimensions.h}
          className="relative z-10 rounded-lg shadow-[0_0_48px_rgba(0,0,0,0.7)]"
        />
      </div>

      {/* Controls bar */}
      <div className="shrink-0 bg-zinc-900/90 backdrop-blur-sm border-t border-white/[0.06] px-4 pt-2.5 pb-3 flex flex-col gap-2">
        {/* Progress bar row */}
        <ProgressBar
          current={currentTime}
          duration={duration}
          onSeek={handleSeek}
        />

        {/* Button row */}
        <div className="flex items-center gap-2">
          {/* Restart */}
          <button
            onClick={handleRestart}
            aria-label="Restart"
            className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <IconRestart className="w-5 h-5" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={handlePlayPause}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-white hover:text-violet-400 transition-colors"
          >
            {isPlaying ? (
              <IconPause className="w-5 h-5" />
            ) : (
              <IconPlay className="w-5 h-5" />
            )}
          </button>

          {/* Time display */}
          <span className="ml-1 text-sm font-mono text-zinc-400 tabular-nums select-none">
            {formatDuration(currentTime)}
            <span className="mx-1 text-zinc-600">/</span>
            {formatDuration(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Speed selector */}
          <div className="flex items-center gap-1">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSpeedChange(s)}
                aria-label={`Set speed to ${s}x`}
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
                  speed === s
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                )}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Fullscreen */}
          <button
            onClick={handleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors ml-1"
          >
            {isFullscreen ? (
              <IconExitFullscreen className="w-5 h-5" />
            ) : (
              <IconFullscreen className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
