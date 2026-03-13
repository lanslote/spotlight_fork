"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { EXPORT_FORMATS, type ExportFormat } from "@/engine/compositor";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExportPanelProps {
  onExport: (format: ExportFormat) => void;
  isExporting: boolean;
  exportProgress: number;  // 0–1
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Estimate file size from bitrate and a default assumed duration (10s). */
function estimateFileSizeMB(format: ExportFormat, durationSeconds = 30): string {
  const bytes = (format.bitrate / 8) * durationSeconds;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) return `~${(mb / 1024).toFixed(1)} GB`;
  return `~${mb.toFixed(0)} MB`;
}

function formatBitrate(bps: number): string {
  const mbps = bps / 1_000_000;
  return `${mbps.toFixed(0)} Mbps`;
}

/** Map format id to a simple color accent for the card */
function formatAccentClass(id: string): string {
  const map: Record<string, string> = {
    "4k":         "from-amber-500/20 to-amber-500/5 border-amber-500/25",
    "1080p":      "from-violet-500/15 to-violet-500/5 border-violet-500/20",
    "720p":       "from-blue-500/15 to-blue-500/5 border-blue-500/20",
    "twitter":    "from-sky-500/15 to-sky-500/5 border-sky-500/20",
    "instagram":  "from-pink-500/15 to-pink-500/5 border-pink-500/20",
    "tiktok":     "from-rose-500/15 to-rose-500/5 border-rose-500/20",
    "gif-preview":"from-emerald-500/15 to-emerald-500/5 border-emerald-500/20",
  };
  return map[id] ?? "from-zinc-700/30 to-zinc-800/20 border-zinc-700/40";
}

function formatDimensionLabel(format: ExportFormat): string {
  return `${format.width} × ${format.height}`;
}

// ── Format card ───────────────────────────────────────────────────────────────

interface FormatCardProps {
  format: ExportFormat;
  isSelected: boolean;
  onSelect: () => void;
}

function FormatCard({ format, isSelected, onSelect }: FormatCardProps) {
  const accentClasses = formatAccentClass(format.id);
  const isVertical = format.height > format.width;
  const isSquare = format.width === format.height;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "relative w-full text-left rounded-xl border p-3.5 transition-all duration-150",
        "hover:brightness-105",
        isSelected
          ? [
              "bg-gradient-to-br",
              accentClasses,
              "ring-2 ring-violet-500/40 shadow-[0_0_0_1px_rgba(139,92,246,0.1)]",
            ]
          : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60",
      )}
    >
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center shadow-md">
          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Aspect preview */}
        <div className="shrink-0 flex items-center justify-center w-10 h-10">
          <div
            className={cn(
              "rounded-sm border-2 bg-zinc-800",
              isSelected ? "border-violet-400/60" : "border-zinc-600",
            )}
            style={{
              width: isSquare ? 28 : isVertical ? 18 : 32,
              height: isSquare ? 28 : isVertical ? 34 : 20,
            }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <p className={cn("text-sm font-medium leading-tight", isSelected ? "text-zinc-100" : "text-zinc-200")}>
            {format.name}
          </p>
          <p className="text-xs text-zinc-500 leading-snug">{format.description}</p>
        </div>
      </div>

      {/* Specs row */}
      <div className="mt-2.5 flex items-center gap-3 text-[11px] text-zinc-500 flex-wrap">
        <span className="font-mono">{formatDimensionLabel(format)}</span>
        <span className="text-zinc-700">·</span>
        <span>{format.fps} fps</span>
        <span className="text-zinc-700">·</span>
        <span>{formatBitrate(format.bitrate)}</span>
      </div>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ExportPanel({
  onExport,
  isExporting,
  exportProgress,
  className,
}: ExportPanelProps) {
  const [selectedFormatId, setSelectedFormatId] = useState<string>("1080p");

  const selectedFormat = EXPORT_FORMATS.find((f) => f.id === selectedFormatId) ?? EXPORT_FORMATS[0];
  const progressPct = Math.round(Math.max(0, Math.min(1, exportProgress)) * 100);

  // Estimate file size based on average ~30s video duration as a placeholder
  const estimatedSize = estimateFileSizeMB(selectedFormat, 30);

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">Export</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Select a format and export your enhanced recording</p>
      </div>

      {/* ── Format cards grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        {EXPORT_FORMATS.map((format) => (
          <FormatCard
            key={format.id}
            format={format}
            isSelected={format.id === selectedFormatId}
            onSelect={() => setSelectedFormatId(format.id)}
          />
        ))}
      </div>

      {/* ── Selected format summary ───────────────────────────────────────── */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 flex items-center justify-between gap-4">
        <div className="space-y-0.5 min-w-0">
          <p className="text-xs text-zinc-400">Selected format</p>
          <p className="text-sm font-medium text-zinc-100 truncate">{selectedFormat.name}</p>
        </div>
        <div className="text-right shrink-0 space-y-0.5">
          <p className="text-xs text-zinc-500">Est. file size</p>
          <p className="text-sm font-medium text-violet-400">{estimatedSize}</p>
        </div>
      </div>

      {/* ── Export button / progress ──────────────────────────────────────── */}
      <div className="space-y-2.5">
        {isExporting ? (
          <>
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 font-medium">Exporting…</span>
                <span className="font-mono text-violet-400">{progressPct}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-200 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-600 text-center">
                Encoding {selectedFormat.name} — this may take a moment
              </p>
            </div>

            {/* Cancel button */}
            <button
              onClick={() => { /* parent controls cancellation via prop updates */ }}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium",
                "bg-zinc-800 text-zinc-400 border border-zinc-700",
                "hover:bg-zinc-700 hover:text-zinc-200 hover:border-zinc-600",
                "transition-all duration-150",
              )}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Cancel export
            </button>
          </>
        ) : (
          <button
            onClick={() => onExport(selectedFormat)}
            className={cn(
              "w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-semibold",
              "bg-gradient-to-br from-violet-600 to-indigo-600 text-white",
              "shadow-[0_4px_16px_rgba(124,58,237,0.35)]",
              "hover:from-violet-500 hover:to-indigo-500 hover:-translate-y-px",
              "hover:shadow-[0_6px_24px_rgba(124,58,237,0.45)]",
              "active:translate-y-0 transition-all duration-150",
            )}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export {selectedFormat.name}
          </button>
        )}
      </div>

      {/* ── Format legend ─────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/60 px-4 py-3 space-y-2">
        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Format specs</p>
        <div className="grid grid-cols-3 gap-y-1.5 text-xs">
          <span className="text-zinc-500">Resolution</span>
          <span className="col-span-2 text-zinc-300 font-mono">{formatDimensionLabel(selectedFormat)}</span>
          <span className="text-zinc-500">Frame rate</span>
          <span className="col-span-2 text-zinc-300">{selectedFormat.fps} fps</span>
          <span className="text-zinc-500">Bitrate</span>
          <span className="col-span-2 text-zinc-300">{formatBitrate(selectedFormat.bitrate)}</span>
          <span className="text-zinc-500">Est. size</span>
          <span className="col-span-2 text-violet-400">{estimatedSize} <span className="text-zinc-600">(30s video)</span></span>
        </div>
      </div>
    </div>
  );
}
