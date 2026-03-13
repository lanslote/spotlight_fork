"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn, formatDuration, clamp } from "@/lib/utils";
import type { SceneSegment, SegmentType } from "@/engine/video-analyzer";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TimelineEditorProps {
  segments: SceneSegment[];
  totalDuration: number;
  currentTime: number;
  onTimeChange: (time: number) => void;
  onSegmentTrim: (segmentId: string, startTime: number, endTime: number) => void;
  onSegmentDelete: (segmentId: string) => void;
  className?: string;
}

type DragMode = "none" | "playhead" | "trim-start" | "trim-end" | "segment-select";

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RULER_HEIGHT = 20;
const TRACK_HEIGHT = 52;
const HANDLE_WIDTH = 8;
const MIN_SEGMENT_DURATION = 0.2; // seconds

const SEGMENT_CONFIG: Record<
  SegmentType,
  { bg: string; border: string; badge: string; label: string }
> = {
  content:    { bg: "bg-blue-600/70",    border: "border-blue-500/60",    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",    label: "Content" },
  idle:       { bg: "bg-zinc-600/60",    border: "border-zinc-500/50",    badge: "bg-zinc-700/50 text-zinc-400 border-zinc-600/40",    label: "Idle" },
  scroll:     { bg: "bg-emerald-600/70", border: "border-emerald-500/60", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", label: "Scroll" },
  transition: { bg: "bg-orange-600/70",  border: "border-orange-500/60",  badge: "bg-orange-500/20 text-orange-300 border-orange-500/30",  label: "Transition" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(value: number, total: number): number {
  if (total === 0) return 0;
  return clamp((value / total) * 100, 0, 100);
}

function timeFromPct(p: number, duration: number): number {
  return clamp((p / 100) * duration, 0, duration);
}

function xToTime(clientX: number, rect: DOMRect, duration: number): number {
  const relX = clientX - rect.left;
  return clamp((relX / rect.width) * duration, 0, duration);
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return m > 0 ? `${m}:${sec}` : `${Number(sec).toFixed(1)}s`;
}

// ── Ruler ─────────────────────────────────────────────────────────────────────

interface RulerProps {
  duration: number;
  width: number;
}

function Ruler({ duration, width }: RulerProps) {
  const tickCount = Math.max(5, Math.min(20, Math.floor(width / 80)));
  const interval = duration / tickCount;
  const roundedInterval = Math.max(0.5, Math.round(interval * 2) / 2);

  const ticks: number[] = [];
  for (let t = 0; t <= duration + 0.01; t += roundedInterval) {
    ticks.push(parseFloat(t.toFixed(2)));
  }

  return (
    <div
      className="relative bg-zinc-900/80 border-b border-zinc-800"
      style={{ height: RULER_HEIGHT }}
    >
      {ticks.map((t) => {
        const left = pct(t, duration);
        if (left > 100) return null;
        const isMajor = t === 0 || t === duration || (t % (roundedInterval * 5) < 0.01);
        return (
          <div
            key={t}
            className="absolute top-0 flex flex-col"
            style={{ left: `${left}%`, transform: "translateX(-50%)" }}
          >
            <div className={cn("w-px", isMajor ? "h-3 bg-zinc-500" : "h-1.5 bg-zinc-700")} />
            {(isMajor || left < 4 || left > 96) && (
              <span className="text-[9px] text-zinc-600 mt-0.5 whitespace-nowrap" style={{ transform: "translateX(-50%)", marginLeft: "50%" }}>
                {formatDuration(t)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TimelineEditor({
  segments,
  totalDuration,
  currentTime,
  onTimeChange,
  onSegmentTrim,
  onSegmentDelete,
  className,
}: TimelineEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>("none");
  const [dragSegmentId, setDragSegmentId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, content: "",
  });
  const [timelineWidth, setTimelineWidth] = useState(600);

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Track container width for responsive ruler
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setTimelineWidth(entries[0].contentRect.width);
    });
    obs.observe(el);
    setTimelineWidth(el.getBoundingClientRect().width);
    return () => obs.disconnect();
  }, []);

  // ── Drag pointer handlers ──────────────────────────────────────────────────

  const getTrackRect = useCallback((): DOMRect | null => {
    return trackRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const handleTrackPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only act on direct clicks on the track background (not segment buttons)
      if ((e.target as HTMLElement).closest("[data-segment]")) return;
      const rect = getTrackRect();
      if (!rect) return;

      setDragMode("playhead");
      setSelectedId(null);
      onTimeChange(xToTime(e.clientX, rect, totalDuration));
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getTrackRect, onTimeChange, totalDuration],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const rect = getTrackRect();
      if (!rect) return;

      const time = xToTime(e.clientX, rect, totalDuration);

      if (dragMode === "playhead") {
        onTimeChange(time);
        return;
      }

      if ((dragMode === "trim-start" || dragMode === "trim-end") && dragSegmentId) {
        const seg = segments.find((s) => s.id === dragSegmentId);
        if (!seg) return;

        if (dragMode === "trim-start") {
          const newStart = clamp(time, 0, seg.endTime - MIN_SEGMENT_DURATION);
          onSegmentTrim(dragSegmentId, newStart, seg.endTime);
        } else {
          const newEnd = clamp(time, seg.startTime + MIN_SEGMENT_DURATION, totalDuration);
          onSegmentTrim(dragSegmentId, seg.startTime, newEnd);
        }
      }
    },
    [dragMode, dragSegmentId, getTrackRect, onTimeChange, onSegmentTrim, segments, totalDuration],
  );

  const handlePointerUp = useCallback(() => {
    setDragMode("none");
    setDragSegmentId(null);
  }, []);

  const handleTrimHandlePointerDown = useCallback(
    (e: React.PointerEvent, segmentId: string, side: "start" | "end") => {
      e.stopPropagation();
      setDragMode(side === "start" ? "trim-start" : "trim-end");
      setDragSegmentId(segmentId);
      setSelectedId(segmentId);
      trackRef.current?.setPointerCapture(e.pointerId);
    },
    [],
  );

  // ── Tooltip ────────────────────────────────────────────────────────────────

  function showTooltip(e: React.MouseEvent, seg: SceneSegment) {
    const cfg = SEGMENT_CONFIG[seg.type];
    setTooltip({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      content: `${cfg.label}  ·  ${formatTime(seg.startTime)} → ${formatTime(seg.endTime)}  ·  ${formatDuration(seg.duration)}`,
    });
  }

  function hideTooltip() {
    setTooltip((t) => ({ ...t, visible: false }));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const playheadLeft = pct(currentTime, totalDuration);

  return (
    <div className={cn("flex flex-col", className)} ref={containerRef}>
      {/* ── Scrollable timeline ──────────────────────────────────────────── */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        {/* Ruler */}
        <Ruler duration={totalDuration} width={timelineWidth} />

        {/* Track area */}
        <div
          ref={trackRef}
          className="relative overflow-x-auto cursor-crosshair"
          style={{ height: TRACK_HEIGHT }}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Segments */}
          {segments.map((seg) => {
            const leftPct = pct(seg.startTime, totalDuration);
            const widthPct = pct(seg.duration, totalDuration);
            const cfg = SEGMENT_CONFIG[seg.type];
            const isSelected = seg.id === selectedId;
            const isHovered = seg.id === hoveredId;

            return (
              <div
                key={seg.id}
                data-segment
                className={cn(
                  "absolute top-2 bottom-2 rounded-md border transition-all duration-100 group overflow-visible",
                  cfg.bg,
                  cfg.border,
                  isSelected && "ring-2 ring-white/25 ring-inset brightness-110",
                  isHovered && !isSelected && "brightness-105",
                )}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  minWidth: 4,
                }}
                onPointerEnter={(e) => {
                  setHoveredId(seg.id);
                  showTooltip(e, seg);
                }}
                onPointerLeave={() => {
                  setHoveredId(null);
                  hideTooltip();
                }}
                onPointerMove={(e) => showTooltip(e, seg)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(seg.id === selectedId ? null : seg.id);
                }}
              >
                {/* Content */}
                <div className="absolute inset-0 flex items-center px-2 overflow-hidden">
                  {widthPct > 4 && (
                    <span className={cn("text-[10px] font-medium border rounded px-1 py-px leading-none shrink-0", cfg.badge)}>
                      {cfg.label}
                    </span>
                  )}
                  {widthPct > 12 && (
                    <span className="ml-1.5 text-[10px] text-white/60 font-mono truncate">
                      {formatDuration(seg.duration)}
                    </span>
                  )}
                </div>

                {/* Trim handles — only on selected segment */}
                {isSelected && (
                  <>
                    {/* Left / start handle */}
                    <div
                      className="absolute left-0 inset-y-0 flex items-center justify-center cursor-ew-resize z-10"
                      style={{ width: HANDLE_WIDTH }}
                      onPointerDown={(e) => handleTrimHandlePointerDown(e, seg.id, "start")}
                    >
                      <div className="h-6 w-1 rounded-full bg-white/50 hover:bg-white/80 transition-colors" />
                    </div>
                    {/* Right / end handle */}
                    <div
                      className="absolute right-0 inset-y-0 flex items-center justify-center cursor-ew-resize z-10"
                      style={{ width: HANDLE_WIDTH }}
                      onPointerDown={(e) => handleTrimHandlePointerDown(e, seg.id, "end")}
                    >
                      <div className="h-6 w-1 rounded-full bg-white/50 hover:bg-white/80 transition-colors" />
                    </div>
                  </>
                )}

                {/* Delete button — shown on hover */}
                {(isHovered || isSelected) && widthPct > 6 && (
                  <button
                    className="absolute top-1 right-1 z-20 w-4 h-4 rounded flex items-center justify-center bg-black/60 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSegmentDelete(seg.id);
                      if (selectedId === seg.id) setSelectedId(null);
                    }}
                    aria-label={`Delete ${cfg.label} segment`}
                  >
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-30"
            style={{ left: `${playheadLeft}%` }}
          >
            {/* Line */}
            <div className="absolute inset-y-0 w-px bg-rose-500" style={{ left: -0.5 }} />
            {/* Top knob */}
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-sm bg-rose-500 rotate-45" />
            {/* Time chip */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-rose-500/90 text-white text-[9px] font-mono shadow-lg">
              {formatTime(currentTime)}
            </div>
          </div>
        </div>

        {/* Duration label */}
        <div className="flex justify-between items-center px-3 py-1.5 border-t border-zinc-800/50 text-[10px] text-zinc-600">
          <span>{segments.length} segment{segments.length !== 1 ? "s" : ""}</span>
          <span className="font-mono">{formatDuration(totalDuration)}</span>
        </div>
      </div>

      {/* ── Selected segment detail ───────────────────────────────────────── */}
      {selectedId && (() => {
        const seg = segments.find((s) => s.id === selectedId);
        if (!seg) return null;
        const cfg = SEGMENT_CONFIG[seg.type];
        return (
          <div className="mt-3 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border shrink-0", cfg.badge)}>
                  {cfg.label}
                </span>
                <div className="text-xs text-zinc-400 font-mono min-w-0">
                  <span>{formatTime(seg.startTime)}</span>
                  <span className="text-zinc-600 mx-1.5">→</span>
                  <span>{formatTime(seg.endTime)}</span>
                  <span className="text-zinc-600 ml-2">({formatDuration(seg.duration)})</span>
                </div>
              </div>
              <button
                onClick={() => {
                  onSegmentDelete(seg.id);
                  setSelectedId(null);
                }}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/15 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                Delete
              </button>
            </div>
            <p className="text-[11px] text-zinc-600 mt-2">
              Drag the handles at the segment edges to trim start and end times.
            </p>
          </div>
        );
      })()}

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="mt-3 flex items-center gap-4 flex-wrap">
        {(Object.entries(SEGMENT_CONFIG) as [SegmentType, (typeof SEGMENT_CONFIG)[SegmentType]][]).map(
          ([type, cfg]) => (
            <span key={type} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span className={cn("w-2.5 h-2.5 rounded-sm", cfg.bg.split("/")[0])} />
              {cfg.label}
            </span>
          ),
        )}
      </div>

      {/* ── Floating tooltip ─────────────────────────────────────────────── */}
      {tooltip.visible && (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 shadow-xl whitespace-nowrap"
          style={{ left: tooltip.x + 12, top: tooltip.y - 36 }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
