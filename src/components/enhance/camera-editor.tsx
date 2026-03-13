"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn, formatDuration, clamp } from "@/lib/utils";
import type { CameraKeyframe, CameraState } from "@/engine/camera-system";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CameraEditorProps {
  keyframes: CameraKeyframe[];
  duration: number;
  currentTime: number;
  onKeyframesChange: (keyframes: CameraKeyframe[]) => void;
  onTimeChange: (time: number) => void;
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RULER_HEIGHT = 24;
const TIMELINE_HEIGHT = 48;
const CURVE_HEIGHT = 56;
const DIAMOND_SIZE = 10;
const PLAYHEAD_WIDTH = 2;
const EASING_OPTIONS: CameraKeyframe["easing"][] = ["spring", "ease-out", "linear"];
const EASING_LABELS: Record<NonNullable<CameraKeyframe["easing"]>, string> = {
  spring: "Spring",
  "ease-out": "Ease Out",
  linear: "Linear",
};

const DEFAULT_STATE: CameraState = { x: 0.5, y: 0.5, zoom: 1.0, rotation: 0 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeToX(time: number, duration: number, width: number): number {
  return (time / duration) * width;
}

function xToTime(x: number, duration: number, width: number): number {
  return clamp((x / width) * duration, 0, duration);
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return m > 0 ? `${m}:${sec.padStart(4, "0")}` : `${sec}s`;
}

// ── Zoom curve canvas ─────────────────────────────────────────────────────────

interface ZoomCurveProps {
  keyframes: CameraKeyframe[];
  duration: number;
  width: number;
}

function ZoomCurve({ keyframes, duration, width }: ZoomCurveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const h = CURVE_HEIGHT;
    canvas.width = width;
    canvas.height = h;
    ctx.clearRect(0, 0, width, h);

    if (keyframes.length === 0) return;

    // Determine zoom min/max for scaling
    const zooms = keyframes.map((kf) => kf.state.zoom);
    const minZ = Math.min(1.0, ...zooms);
    const maxZ = Math.max(1.0, ...zooms);
    const range = Math.max(0.1, maxZ - minZ);

    const zoomToY = (z: number) =>
      h - 4 - ((z - minZ) / range) * (h - 12);

    // Draw grid line at zoom=1
    const y1 = zoomToY(1.0);
    ctx.strokeStyle = "rgba(63,63,70,0.6)"; // zinc-700
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y1);
    ctx.lineTo(width, y1);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw curve
    ctx.beginPath();
    ctx.strokeStyle = "rgba(139,92,246,0.7)"; // violet-500
    ctx.lineWidth = 1.5;

    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    sorted.forEach((kf, i) => {
      const x = timeToX(kf.time, duration, width);
      const y = zoomToY(kf.state.zoom);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill area under curve
    ctx.beginPath();
    sorted.forEach((kf, i) => {
      const x = timeToX(kf.time, duration, width);
      const y = zoomToY(kf.state.zoom);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (sorted.length > 0) {
      ctx.lineTo(timeToX(sorted[sorted.length - 1].time, duration, width), h);
      ctx.lineTo(timeToX(sorted[0].time, duration, width), h);
      ctx.closePath();
    }
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(139,92,246,0.2)");
    grad.addColorStop(1, "rgba(139,92,246,0.02)");
    ctx.fillStyle = grad;
    ctx.fill();
  }, [keyframes, duration, width]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={CURVE_HEIGHT}
      className="w-full"
      style={{ height: CURVE_HEIGHT }}
      aria-hidden="true"
    />
  );
}

// ── Ruler ─────────────────────────────────────────────────────────────────────

interface RulerProps {
  duration: number;
  width: number;
}

function Ruler({ duration, width }: RulerProps) {
  // Determine a nice tick interval
  const tickCount = Math.min(20, Math.floor(width / 60));
  const rawInterval = duration / tickCount;
  const roundedInterval = Math.max(0.5, Math.round(rawInterval * 2) / 2);

  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += roundedInterval) {
    ticks.push(parseFloat(t.toFixed(2)));
  }

  return (
    <div className="relative" style={{ height: RULER_HEIGHT }}>
      {ticks.map((t) => {
        const left = (t / duration) * 100;
        const isMinute = t % 60 === 0 && t > 0;
        return (
          <div
            key={t}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${left}%`, transform: "translateX(-50%)" }}
          >
            <div className={cn("w-px", isMinute ? "h-3 bg-zinc-500" : "h-2 bg-zinc-600")} />
            {left > 2 && left < 98 && (
              <span className="text-[9px] text-zinc-600 mt-0.5 whitespace-nowrap">
                {formatTime(t)}
              </span>
            )}
          </div>
        );
      })}
      {/* Start / end labels */}
      <span className="absolute left-0 text-[9px] text-zinc-600 top-3">0:00</span>
      <span className="absolute right-0 text-[9px] text-zinc-600 top-3">{formatDuration(duration)}</span>
    </div>
  );
}

// ── Keyframe editor panel ─────────────────────────────────────────────────────

interface KeyframeEditorProps {
  keyframe: CameraKeyframe;
  onChange: (updated: CameraKeyframe) => void;
  onDelete: () => void;
}

function KeyframeEditor({ keyframe, onChange, onDelete }: KeyframeEditorProps) {
  const { state, time, holdDuration = 0, easing = "spring" } = keyframe;

  function updateState(patch: Partial<CameraState>) {
    onChange({ ...keyframe, state: { ...state, ...patch } });
  }

  function updateField<K extends keyof CameraKeyframe>(key: K, value: CameraKeyframe[K]) {
    onChange({ ...keyframe, [key]: value });
  }

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-zinc-100">Keyframe at {formatTime(time)}</p>
          <p className="text-[11px] text-zinc-500">Drag the diamond on the timeline to reposition</p>
        </div>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/15 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
          Delete
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Zoom */}
        <div className="col-span-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Zoom</label>
            <span className="text-[11px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">
              {state.zoom.toFixed(2)}x
            </span>
          </div>
          <div className="relative h-5 flex items-center">
            <div className="relative w-full h-1.5 rounded-full bg-zinc-800">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-600 to-indigo-500"
                style={{ width: `${((state.zoom - 1.0) / 1.5) * 100}%` }}
              />
            </div>
            <input
              type="range"
              min={1.0}
              max={2.5}
              step={0.05}
              value={state.zoom}
              onChange={(e) => updateState({ zoom: Number(e.target.value) })}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
            <div
              className="absolute w-4 h-4 rounded-full -translate-x-1/2 pointer-events-none bg-white shadow-[0_0_0_2px_rgba(139,92,246,0.6)]"
              style={{ left: `${((state.zoom - 1.0) / 1.5) * 100}%` }}
            />
          </div>
        </div>

        {/* Pan X */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Pan X</label>
            <span className="text-[11px] font-mono text-zinc-400">{state.x.toFixed(2)}</span>
          </div>
          <div className="relative h-5 flex items-center">
            <div className="relative w-full h-1.5 rounded-full bg-zinc-800">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-zinc-500"
                style={{ width: `${state.x * 100}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={state.x}
              onChange={(e) => updateState({ x: Number(e.target.value) })}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
            <div
              className="absolute w-4 h-4 rounded-full -translate-x-1/2 pointer-events-none bg-white shadow-[0_0_0_2px_rgba(113,113,122,0.6)]"
              style={{ left: `${state.x * 100}%` }}
            />
          </div>
        </div>

        {/* Pan Y */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Pan Y</label>
            <span className="text-[11px] font-mono text-zinc-400">{state.y.toFixed(2)}</span>
          </div>
          <div className="relative h-5 flex items-center">
            <div className="relative w-full h-1.5 rounded-full bg-zinc-800">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-zinc-500"
                style={{ width: `${state.y * 100}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={state.y}
              onChange={(e) => updateState({ y: Number(e.target.value) })}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
            <div
              className="absolute w-4 h-4 rounded-full -translate-x-1/2 pointer-events-none bg-white shadow-[0_0_0_2px_rgba(113,113,122,0.6)]"
              style={{ left: `${state.y * 100}%` }}
            />
          </div>
        </div>

        {/* Hold duration */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Hold</label>
            <span className="text-[11px] font-mono text-zinc-400">{holdDuration.toFixed(1)}s</span>
          </div>
          <div className="relative h-5 flex items-center">
            <div className="relative w-full h-1.5 rounded-full bg-zinc-800">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-zinc-500"
                style={{ width: `${(holdDuration / 5) * 100}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={holdDuration}
              onChange={(e) => updateField("holdDuration", Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
            <div
              className="absolute w-4 h-4 rounded-full -translate-x-1/2 pointer-events-none bg-white shadow-[0_0_0_2px_rgba(113,113,122,0.6)]"
              style={{ left: `${(holdDuration / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Easing */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Easing</label>
          <div className="flex gap-1">
            {EASING_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => updateField("easing", opt)}
                className={cn(
                  "flex-1 px-1.5 py-1 rounded-md text-[11px] font-medium border transition-all duration-100",
                  easing === opt
                    ? "bg-violet-600/20 border-violet-500/40 text-violet-400"
                    : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400",
                )}
              >
                {EASING_LABELS[opt!]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CameraEditor({
  keyframes,
  duration,
  currentTime,
  onKeyframesChange,
  onTimeChange,
  className,
}: CameraEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(600);

  // Keep track of container width
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setTimelineWidth(entries[0].contentRect.width);
    });
    obs.observe(el);
    setTimelineWidth(el.getBoundingClientRect().width);
    return () => obs.disconnect();
  }, []);

  // ── Drag helpers ───────────────────────────────────────────────────────────

  const getTimeFromPointer = useCallback(
    (clientX: number): number => {
      const el = timelineRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return xToTime(clientX - rect.left, duration, rect.width);
    },
    [duration],
  );

  const handleTimelinePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-keyframe]")) return;
      setIsDraggingPlayhead(true);
      setSelectedIndex(null);
      onTimeChange(getTimeFromPointer(e.clientX));
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getTimeFromPointer, onTimeChange],
  );

  const handleTimelinePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDraggingPlayhead) {
        onTimeChange(getTimeFromPointer(e.clientX));
      } else if (draggingIndex !== null) {
        const newTime = getTimeFromPointer(e.clientX);
        const updated = keyframes.map((kf, i) =>
          i === draggingIndex ? { ...kf, time: newTime } : kf,
        );
        onKeyframesChange(updated);
      }
    },
    [
      isDraggingPlayhead,
      draggingIndex,
      getTimeFromPointer,
      onTimeChange,
      keyframes,
      onKeyframesChange,
    ],
  );

  const handleTimelinePointerUp = useCallback(() => {
    setIsDraggingPlayhead(false);
    setDraggingIndex(null);
  }, []);

  const handleKeyframePointerDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      e.stopPropagation();
      setSelectedIndex(index);
      setDraggingIndex(index);
      timelineRef.current?.setPointerCapture(e.pointerId);
    },
    [],
  );

  // ── Keyframe operations ────────────────────────────────────────────────────

  const addKeyframe = useCallback(() => {
    const newKf: CameraKeyframe = {
      time: currentTime,
      state: { ...DEFAULT_STATE },
      holdDuration: 0,
      easing: "spring",
    };
    const updated = [...keyframes, newKf].sort((a, b) => a.time - b.time);
    onKeyframesChange(updated);
    const newIdx = updated.findIndex((kf) => kf.time === newKf.time);
    setSelectedIndex(newIdx);
  }, [currentTime, keyframes, onKeyframesChange]);

  const deleteSelected = useCallback(() => {
    if (selectedIndex === null) return;
    const updated = keyframes.filter((_, i) => i !== selectedIndex);
    onKeyframesChange(updated);
    setSelectedIndex(null);
  }, [selectedIndex, keyframes, onKeyframesChange]);

  const updateKeyframe = useCallback(
    (index: number, updated: CameraKeyframe) => {
      const newKfs = keyframes.map((kf, i) => (i === index ? updated : kf));
      onKeyframesChange(newKfs.sort((a, b) => a.time - b.time));
    },
    [keyframes, onKeyframesChange],
  );

  const selectedKeyframe = selectedIndex !== null ? keyframes[selectedIndex] : null;

  // Playhead left %
  const playheadPct = pct(currentTime, duration);

  function pct(value: number, total: number) {
    return total === 0 ? 0 : clamp((value / total) * 100, 0, 100);
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={addKeyframe}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-100 hover:border-zinc-600 transition-all duration-150"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add at {formatTime(currentTime)}
          </button>
          {selectedIndex !== null && (
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/15 transition-all duration-150"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Delete selected
            </button>
          )}
        </div>
        <span className="text-xs text-zinc-500 font-mono">
          {keyframes.length} keyframe{keyframes.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Timeline area ─────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden select-none">
        {/* Ruler */}
        <div className="px-3 pt-2 pb-0 border-b border-zinc-800/50">
          <Ruler duration={duration} width={timelineWidth} />
        </div>

        {/* Keyframe track */}
        <div
          ref={timelineRef}
          className="relative cursor-crosshair"
          style={{ height: TIMELINE_HEIGHT }}
          onPointerDown={handleTimelinePointerDown}
          onPointerMove={handleTimelinePointerMove}
          onPointerUp={handleTimelinePointerUp}
          onPointerLeave={handleTimelinePointerUp}
        >
          {/* Track background */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-zinc-800 mx-3" />

          {/* Keyframe diamonds */}
          {keyframes.map((kf, i) => {
            const left = pct(kf.time, duration);
            const isSelected = i === selectedIndex;
            return (
              <div
                key={i}
                data-keyframe
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing",
                  "transition-colors duration-100",
                )}
                style={{ left: `${left}%` }}
                onPointerDown={(e) => handleKeyframePointerDown(e, i)}
              >
                {/* Diamond shape via rotate */}
                <div
                  className={cn(
                    "rotate-45 transition-all duration-100",
                    isSelected
                      ? "bg-violet-500 shadow-[0_0_0_2px_rgba(139,92,246,0.4),0_0_8px_rgba(139,92,246,0.5)]"
                      : "bg-zinc-400 hover:bg-violet-400",
                  )}
                  style={{ width: DIAMOND_SIZE, height: DIAMOND_SIZE }}
                />
              </div>
            );
          })}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: `${playheadPct}%`, width: PLAYHEAD_WIDTH }}
          >
            <div className="absolute inset-0 bg-rose-500" />
            {/* Playhead handle */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-sm bg-rose-500 rotate-45" />
            {/* Time label */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-rose-500 text-white text-[10px] font-mono">
              {formatTime(currentTime)}
            </div>
          </div>
        </div>

        {/* Zoom curve */}
        <div className="px-3 pb-3 pt-2 border-t border-zinc-800/50">
          <p className="text-[10px] text-zinc-600 mb-1 uppercase tracking-wide">Zoom level</p>
          <ZoomCurve keyframes={keyframes} duration={duration} width={timelineWidth} />
        </div>
      </div>

      {/* ── Selected keyframe editor ──────────────────────────────────────── */}
      {selectedKeyframe !== null && selectedIndex !== null ? (
        <KeyframeEditor
          keyframe={selectedKeyframe}
          onChange={(updated) => updateKeyframe(selectedIndex, updated)}
          onDelete={deleteSelected}
        />
      ) : (
        <div className="flex items-center justify-center h-16 rounded-xl bg-zinc-900/50 border border-dashed border-zinc-800 text-xs text-zinc-600">
          Click a keyframe diamond to edit its properties
        </div>
      )}
    </div>
  );
}
