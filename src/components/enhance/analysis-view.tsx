"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn, formatDuration } from "@/lib/utils";
import type {
  AnalysisResult,
  SceneSegment,
  DetectedClick,
  SegmentType,
} from "@/engine/video-analyzer";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalysisViewProps {
  analysis: AnalysisResult;
  videoUrl: string;
  onAccept: () => void;
  onReanalyze: () => void;
  className?: string;
}

// ── Segment color config ───────────────────────────────────────────────────────

const SEGMENT_COLORS: Record<SegmentType, { bar: string; badge: string; label: string }> = {
  content:    { bar: "bg-blue-500",   badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",   label: "Content" },
  idle:       { bar: "bg-zinc-500",   badge: "bg-zinc-700/60 text-zinc-400 border-zinc-600/40",   label: "Idle" },
  scroll:     { bar: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Scroll" },
  transition: { bar: "bg-orange-500", badge: "bg-orange-500/15 text-orange-400 border-orange-500/30", label: "Transition" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 10);
  return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}.${ms}s`;
}

function pct(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StatPillProps {
  label: string;
  value: string;
  accent?: boolean;
}

function StatPill({ label, value, accent }: StatPillProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl bg-zinc-800/60 border border-zinc-700/50 min-w-[80px]">
      <span className={cn("text-base font-semibold tabular-nums", accent ? "text-violet-400" : "text-zinc-100")}>
        {value}
      </span>
      <span className="text-[11px] text-zinc-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
    </div>
  );
}

interface SegmentBadgeProps {
  type: SegmentType;
}

function SegmentBadge({ type }: SegmentBadgeProps) {
  const cfg = SEGMENT_COLORS[type];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border", cfg.badge)}>
      {cfg.label}
    </span>
  );
}

// ── Canvas overlay for cursor path + click markers ────────────────────────────

interface VideoOverlayProps {
  analysis: AnalysisResult;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function VideoOverlay({ analysis, containerRef }: VideoOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width: cw, height: ch } = container.getBoundingClientRect();
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cw, ch);

    const { cursorPath, clicks, source } = analysis;

    // ── Cursor path ─────────────────────────────────────────────────────
    if (cursorPath.points.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(139, 92, 246, 0.55)"; // violet-500
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      cursorPath.points.forEach((pt, i) => {
        const x = pt.position.x * cw;
        const y = pt.position.y * ch;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Arrowhead at last point
      const last = cursorPath.points[cursorPath.points.length - 1];
      const prev = cursorPath.points[cursorPath.points.length - 2];
      if (prev) {
        const dx = last.position.x - prev.position.x;
        const dy = last.position.y - prev.position.y;
        const angle = Math.atan2(dy * ch, dx * cw);
        const ax = last.position.x * cw;
        const ay = last.position.y * ch;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.fillStyle = "rgba(139, 92, 246, 0.8)";
        ctx.moveTo(0, 0);
        ctx.lineTo(-8, -4);
        ctx.lineTo(-8, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // ── Click markers (pulsing dots) ────────────────────────────────────
    // Draw as static filled circles (pulse is CSS-driven via separate DOM elements)
    clicks.forEach((click) => {
      const x = click.position.x * cw;
      const y = click.position.y * ch;

      // Outer ring
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)"; // rose-500
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(239, 68, 68, 0.9)";
      ctx.fill();
    });

    void source; // used indirectly via analysis shape
  }, [analysis, containerRef]);

  useEffect(() => {
    draw();
    const observer = new ResizeObserver(draw);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [draw, containerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}

// ── Scene timeline ─────────────────────────────────────────────────────────────

interface SceneTimelineProps {
  segments: SceneSegment[];
  duration: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function SceneTimeline({ segments, duration, selectedId, onSelect }: SceneTimelineProps) {
  return (
    <div className="relative h-8 flex rounded-lg overflow-hidden border border-zinc-700/50 bg-zinc-900">
      {segments.map((seg) => {
        const leftPct = pct(seg.startTime, duration);
        const widthPct = pct(seg.duration, duration);
        const cfg = SEGMENT_COLORS[seg.type];
        const isSelected = seg.id === selectedId;
        return (
          <button
            key={seg.id}
            className={cn(
              "absolute inset-y-0 flex items-center justify-center overflow-hidden",
              "transition-all duration-150 cursor-pointer hover:brightness-110",
              cfg.bar,
              isSelected && "ring-2 ring-inset ring-white/40 brightness-110",
              "opacity-80 hover:opacity-100",
            )}
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
            title={`${cfg.label} · ${formatSeconds(seg.startTime)} → ${formatSeconds(seg.endTime)}`}
            onClick={() => onSelect(seg.id)}
          >
            {widthPct > 6 && (
              <span className="text-[10px] font-medium text-white/80 px-1 truncate">
                {formatSeconds(seg.duration)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Segments list ──────────────────────────────────────────────────────────────

interface SegmentsListProps {
  segments: SceneSegment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function SegmentsList({ segments, selectedId, onSelect }: SegmentsListProps) {
  return (
    <div className="space-y-1.5">
      {segments.map((seg, i) => {
        const isSelected = seg.id === selectedId;
        return (
          <button
            key={seg.id}
            onClick={() => onSelect(seg.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left",
              "border transition-all duration-150",
              isSelected
                ? "bg-zinc-800 border-zinc-600"
                : "bg-zinc-800/40 border-zinc-800 hover:bg-zinc-800/70 hover:border-zinc-700",
            )}
          >
            <span className="text-xs text-zinc-600 tabular-nums w-5 shrink-0 text-right">
              {i + 1}
            </span>
            <SegmentBadge type={seg.type} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="font-mono">{formatSeconds(seg.startTime)}</span>
                <svg className="w-3 h-3 text-zinc-600 shrink-0" fill="none" viewBox="0 0 16 16">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-mono">{formatSeconds(seg.endTime)}</span>
              </div>
            </div>
            <span className="text-xs font-mono text-zinc-500 shrink-0">
              {formatSeconds(seg.duration)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AnalysisView({
  analysis,
  videoUrl,
  onAccept,
  onReanalyze,
  className,
}: AnalysisViewProps) {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    analysis.segments[0]?.id ?? null,
  );
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { segments, clicks, cursorPath, idleRegions, source } = analysis;

  // Computed stats
  const totalIdleTime = idleRegions.reduce((sum, r) => sum + (r.endTime - r.startTime), 0);
  const cursorConfidencePct = Math.round(cursorPath.avgConfidence * 100);

  // Seek video to segment start on selection
  useEffect(() => {
    if (!selectedSegmentId || !videoRef.current) return;
    const seg = segments.find((s) => s.id === selectedSegmentId);
    if (seg) videoRef.current.currentTime = seg.startTime;
  }, [selectedSegmentId, segments]);

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* ── Video preview with overlay ───────────────────────────────── */}
      <div
        ref={videoContainerRef}
        className="relative rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 aspect-video"
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          controls
          playsInline
          muted
        />
        <VideoOverlay analysis={analysis} containerRef={videoContainerRef} />

        {/* Click count badge */}
        {clicks.length > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 text-xs text-white/80">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            {clicks.length} click{clicks.length !== 1 ? "s" : ""} detected
          </div>
        )}
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatPill label="Scenes" value={String(segments.length)} />
        <StatPill label="Clicks" value={String(clicks.length)} />
        <StatPill
          label="Cursor confidence"
          value={`${cursorConfidencePct}%`}
          accent
        />
        <StatPill label="Idle time" value={formatDuration(totalIdleTime)} />
        <StatPill label="Duration" value={formatDuration(source.duration)} />
      </div>

      {/* ── Scene timeline ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            Scene Timeline
          </h3>
          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            {(Object.entries(SEGMENT_COLORS) as [SegmentType, typeof SEGMENT_COLORS[SegmentType]][]).map(
              ([type, cfg]) => (
                <span key={type} className="flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-sm", cfg.bar)} />
                  {cfg.label}
                </span>
              ),
            )}
          </div>
        </div>
        <SceneTimeline
          segments={segments}
          duration={source.duration}
          selectedId={selectedSegmentId}
          onSelect={setSelectedSegmentId}
        />
        {/* Time axis */}
        <div className="flex justify-between text-[10px] text-zinc-600 font-mono px-0.5">
          <span>0:00</span>
          <span>{formatDuration(source.duration / 4)}</span>
          <span>{formatDuration(source.duration / 2)}</span>
          <span>{formatDuration((source.duration * 3) / 4)}</span>
          <span>{formatDuration(source.duration)}</span>
        </div>
      </div>

      {/* ── Segments list ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          Segments ({segments.length})
        </h3>
        <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
          <SegmentsList
            segments={segments}
            selectedId={selectedSegmentId}
            onSelect={setSelectedSegmentId}
          />
        </div>
      </div>

      {/* ── Action buttons ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onReanalyze}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium",
            "bg-zinc-800 text-zinc-300 border border-zinc-700",
            "hover:bg-zinc-700 hover:text-zinc-100 hover:border-zinc-600",
            "transition-all duration-150",
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Re-analyze
        </button>
        <button
          onClick={onAccept}
          className={cn(
            "flex-[2] flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium",
            "bg-gradient-to-br from-violet-600 to-indigo-600 text-white",
            "shadow-[0_4px_16px_rgba(124,58,237,0.35)]",
            "hover:from-violet-500 hover:to-indigo-500 hover:-translate-y-px",
            "hover:shadow-[0_6px_24px_rgba(124,58,237,0.45)]",
            "active:translate-y-0 transition-all duration-150",
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Accept & Continue
        </button>
      </div>
    </div>
  );
}
