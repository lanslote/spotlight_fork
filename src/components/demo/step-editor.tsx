"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { makeId } from "@/engine/demo-engine";
import type {
  DemoStep,
  Demo,
  Hotspot,
  Callout,
  BlurRegion,
  TransitionType,
} from "@/engine/demo-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

type OverlayKind = "hotspot" | "callout" | "blur";
type ActiveTool = "select" | "hotspot" | "callout" | "blur";

interface SelectedOverlay {
  kind: OverlayKind;
  id: string;
}

export interface StepEditorProps {
  step: DemoStep;
  onChange: (updated: DemoStep) => void;
  /** Needed to populate the branch target dropdown. */
  demo: Demo;
}

// ─── Option lists ─────────────────────────────────────────────────────────────

const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: "fade", label: "Fade" },
  { value: "slide-left", label: "Slide Left" },
  { value: "slide-right", label: "Slide Right" },
  { value: "zoom", label: "Zoom" },
  { value: "morph", label: "Morph" },
  { value: "none", label: "None" },
];

const HOTSPOT_STYLE_OPTIONS = [
  { value: "pulse", label: "Pulse" },
  { value: "highlight", label: "Highlight" },
  { value: "outline", label: "Outline" },
  { value: "arrow", label: "Arrow" },
];

const HOTSPOT_TYPE_OPTIONS = [
  { value: "click", label: "Click" },
  { value: "hover", label: "Hover" },
  { value: "scroll", label: "Scroll" },
];

const CALLOUT_ANCHOR_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

const BLUR_MODE_OPTIONS = [
  { value: "blur", label: "Blur" },
  { value: "mask", label: "Mask" },
  { value: "pixelate", label: "Pixelate" },
];
const CALLOUT_STYLE_OPTIONS = [
  { value: "tooltip", label: "Tooltip" },
  { value: "badge", label: "Badge" },
  { value: "numbered", label: "Numbered" },
  { value: "arrow", label: "Arrow" },
];

// ─── Overlay factory helpers ───────────────────────────────────────────────────

function newHotspot(cx: number, cy: number): Hotspot {
  const size = 0.06;
  return {
    id: makeId("hs"),
    type: "click",
    bounds: {
      x: Math.max(0, cx - size / 2),
      y: Math.max(0, cy - size / 2),
      width: size,
      height: size,
    },
    style: "pulse",
  };
}

function newCallout(cx: number, cy: number): Callout {
  return {
    id: makeId("co"),
    text: "Add annotation here",
    position: { x: Math.max(0.05, Math.min(0.95, cx)), y: Math.max(0.05, Math.min(0.95, cy)) },
    anchor: "bottom",
    style: "tooltip",
  };
}

function newBlurRegion(cx: number, cy: number): BlurRegion {
  return {
    id: makeId("blur"),
    bounds: {
      x: Math.max(0, cx - 0.1),
      y: Math.max(0, cy - 0.05),
      width: 0.2,
      height: 0.1,
    },
    mode: "blur",
    intensity: 0.6,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a fraction (0–1) rect to CSS percentages for absolute overlay. */
function rectToStyle(
  x: number,
  y: number,
  w: number,
  h: number
): React.CSSProperties {
  return {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    width: `${w * 100}%`,
    height: `${h * 100}%`,
  };
}

// ─── Overlay components ───────────────────────────────────────────────────────

function HotspotOverlay({
  hotspot,
  isSelected,
  onSelect,
  onDragEnd,
}: {
  hotspot: Hotspot;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}) {
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect();
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      dragStart.current = {
        mx: e.clientX,
        my: e.clientY,
        ox: hotspot.bounds.x,
        oy: hotspot.bounds.y,
      };

      const onMove = (ev: MouseEvent) => {
        if (!dragStart.current) return;
        const dx = (ev.clientX - dragStart.current.mx) / rect.width;
        const dy = (ev.clientY - dragStart.current.my) / rect.height;
        const nx = Math.max(0, Math.min(1 - hotspot.bounds.width, dragStart.current.ox + dx));
        const ny = Math.max(0, Math.min(1 - hotspot.bounds.height, dragStart.current.oy + dy));
        if (containerRef.current) {
          containerRef.current.style.left = `${nx * 100}%`;
          containerRef.current.style.top = `${ny * 100}%`;
        }
      };

      const onUp = (ev: MouseEvent) => {
        if (!dragStart.current) return;
        const dx = (ev.clientX - dragStart.current.mx) / rect.width;
        const dy = (ev.clientY - dragStart.current.my) / rect.height;
        const nx = Math.max(0, Math.min(1 - hotspot.bounds.width, dragStart.current.ox + dx));
        const ny = Math.max(0, Math.min(1 - hotspot.bounds.height, dragStart.current.oy + dy));
        onDragEnd(nx, ny);
        dragStart.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [hotspot.bounds.height, hotspot.bounds.width, hotspot.bounds.x, hotspot.bounds.y, onDragEnd, onSelect]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute cursor-move",
        isSelected && "ring-2 ring-violet-400 ring-offset-1 ring-offset-transparent"
      )}
      style={rectToStyle(hotspot.bounds.x, hotspot.bounds.y, hotspot.bounds.width, hotspot.bounds.height)}
      onMouseDown={handleMouseDown}
    >
      {/* Pulse ring for pulse style */}
      {hotspot.style === "pulse" && (
        <div className="absolute inset-0 rounded-full border-2 border-violet-500 animate-ping opacity-60" />
      )}
      <div
        className={cn(
          "absolute inset-0 rounded-full flex items-center justify-center transition-colors",
          hotspot.style === "pulse" && "bg-violet-500/30 border-2 border-violet-400",
          hotspot.style === "highlight" && "bg-yellow-400/30 border-2 border-yellow-400",
          hotspot.style === "outline" && "bg-transparent border-2 border-zinc-300",
          hotspot.style === "arrow" && "bg-violet-500/20 border-2 border-violet-500"
        )}
      />
      {/* Tooltip preview */}
      {hotspot.tooltip && isSelected && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] bg-zinc-900 border border-zinc-700 text-zinc-200 rounded px-2 py-1 pointer-events-none">
          {hotspot.tooltip}
        </div>
      )}
    </div>
  );
}

function CalloutOverlay({
  callout,
  isSelected,
  onSelect,
  onDragEnd,
}: {
  callout: Callout;
  isSelected: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect();
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      dragStart.current = { mx: e.clientX, my: e.clientY, ox: callout.position.x, oy: callout.position.y };

      const onMove = (ev: MouseEvent) => {
        if (!dragStart.current || !containerRef.current) return;
        const dx = (ev.clientX - dragStart.current.mx) / rect.width;
        const dy = (ev.clientY - dragStart.current.my) / rect.height;
        containerRef.current.style.left = `${(dragStart.current.ox + dx) * 100}%`;
        containerRef.current.style.top = `${(dragStart.current.oy + dy) * 100}%`;
      };

      const onUp = (ev: MouseEvent) => {
        if (!dragStart.current) return;
        const dx = (ev.clientX - dragStart.current.mx) / rect.width;
        const dy = (ev.clientY - dragStart.current.my) / rect.height;
        onDragEnd(
          Math.max(0, Math.min(0.95, dragStart.current.ox + dx)),
          Math.max(0, Math.min(0.95, dragStart.current.oy + dy))
        );
        dragStart.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [callout.position.x, callout.position.y, onDragEnd, onSelect]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute cursor-move rounded-lg px-2 py-1.5 text-xs leading-snug select-none",
        "bg-zinc-900/90 border backdrop-blur-sm",
        callout.style === "tooltip" && "border-zinc-600 text-zinc-200",
        callout.style === "badge" && "border-violet-500/60 bg-violet-900/70 text-violet-100",
        callout.style === "arrow" && "border-yellow-500/60 bg-yellow-900/60 text-yellow-100",
        isSelected && "ring-2 ring-violet-400 ring-offset-1 ring-offset-transparent"
      )}
      style={rectToStyle(callout.position.x, callout.position.y, 0.15, 0.06)}
      onMouseDown={handleMouseDown}
      contentEditable={isSelected}
      suppressContentEditableWarning
    >
      {callout.number !== undefined && (
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-600 text-[9px] font-bold text-white mr-1">
          {callout.number}
        </span>
      )}
      {callout.text}
    </div>
  );
}

function BlurOverlay({
  region,
  isSelected,
  onSelect,
}: {
  region: BlurRegion;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const blurPx = Math.round(region.intensity * 20);
  return (
    <div
      className={cn(
        "absolute cursor-pointer border-2 border-dashed",
        isSelected
          ? "border-violet-400"
          : "border-zinc-500/50 hover:border-zinc-400",
        "transition-colors"
      )}
      style={{
        ...rectToStyle(region.bounds.x, region.bounds.y, region.bounds.width, region.bounds.height),
        backdropFilter:
          region.mode === "blur"
            ? `blur(${blurPx}px)`
            : region.mode === "pixelate"
            ? `blur(${Math.round(blurPx / 3)}px)`
            : "none",
        background:
          region.mode === "mask" ? "rgba(9,9,11,0.8)" : "rgba(0,0,0,0.15)",
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Mode badge */}
      <span className="absolute top-1 left-1 text-[9px] font-semibold uppercase tracking-wide bg-black/60 text-zinc-400 rounded px-1 leading-4">
        {region.mode}
      </span>
    </div>
  );
}

// ─── Properties panel ─────────────────────────────────────────────────────────

function HotspotProperties({
  hotspot,
  demo,
  onChange,
  onDelete,
}: {
  hotspot: Hotspot;
  demo: Demo;
  onChange: (updated: Hotspot) => void;
  onDelete: () => void;
}) {
  const branchOptions = [
    { value: "", label: "None (next step)" },
    ...demo.steps
      .filter((s) => s.id !== hotspot.id)
      .map((s, i) => ({
        value: s.id,
        label: `Step ${i + 1}: ${s.title ?? `Step ${i + 1}`}`,
      })),
  ];

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
        Hotspot
      </p>
      <Select
        label="Type"
        options={HOTSPOT_TYPE_OPTIONS}
        value={hotspot.type}
        onChange={(v) => onChange({ ...hotspot, type: v as Hotspot["type"] })}
      />
      <Select
        label="Style"
        options={HOTSPOT_STYLE_OPTIONS}
        value={hotspot.style}
        onChange={(v) => onChange({ ...hotspot, style: v as Hotspot["style"] })}
      />
      <Input
        label="Tooltip"
        value={hotspot.tooltip ?? ""}
        placeholder="Add tooltip text…"
        onChange={(e) => onChange({ ...hotspot, tooltip: e.target.value || undefined })}
      />
      <Select
        label="Branch Target"
        options={branchOptions}
        value={hotspot.branchTo ?? ""}
        onChange={(v) => onChange({ ...hotspot, branchTo: v || undefined })}
      />
      <Button variant="danger" size="sm" className="w-full" onClick={onDelete}>
        Delete Hotspot
      </Button>
    </div>
  );
}

function CalloutProperties({
  callout,
  onChange,
  onDelete,
}: {
  callout: Callout;
  onChange: (updated: Callout) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
        Callout
      </p>
      <Textarea
        label="Text"
        value={callout.text}
        rows={3}
        onChange={(e) => onChange({ ...callout, text: e.target.value })}
      />
      <Select
        label="Style"
        options={CALLOUT_STYLE_OPTIONS}
        value={callout.style}
        onChange={(v) => onChange({ ...callout, style: v as Callout["style"] })}
      />
      <Select
        label="Anchor Direction"
        options={CALLOUT_ANCHOR_OPTIONS}
        value={callout.anchor}
        onChange={(v) => onChange({ ...callout, anchor: v as Callout["anchor"] })}
      />
      <Input
        label="Badge Number"
        type="number"
        value={callout.number ?? ""}
        placeholder="None"
        min={1}
        max={99}
        onChange={(e) =>
          onChange({
            ...callout,
            number: e.target.value === "" ? undefined : parseInt(e.target.value, 10),
          })
        }
      />
      <Button variant="danger" size="sm" className="w-full" onClick={onDelete}>
        Delete Callout
      </Button>
    </div>
  );
}

function BlurProperties({
  region,
  onChange,
  onDelete,
}: {
  region: BlurRegion;
  onChange: (updated: BlurRegion) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
        Blur Region
      </p>
      <Select
        label="Mode"
        options={BLUR_MODE_OPTIONS}
        value={region.mode}
        onChange={(v) => onChange({ ...region, mode: v as BlurRegion["mode"] })}
      />
      <Slider
        label="Intensity"
        min={0}
        max={100}
        step={1}
        value={Math.round(region.intensity * 100)}
        onChange={(v) => onChange({ ...region, intensity: v / 100 })}
        displayValue={(v) => `${v}%`}
      />
      <Button variant="danger" size="sm" className="w-full" onClick={onDelete}>
        Delete Region
      </Button>
    </div>
  );
}

// ─── Step properties sidebar ──────────────────────────────────────────────────

function StepProperties({
  step,
  demo,
  onChange,
}: {
  step: DemoStep;
  demo: Demo;
  onChange: (updated: DemoStep) => void;
}) {
  const chapterOptions = [
    { value: "", label: "None" },
    ...demo.chapters.map((c) => ({ value: c.id, label: c.title })),
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-2">
          Step
        </p>
        <Input
          label="Title"
          value={step.title ?? ""}
          placeholder="Step title"
          onChange={(e) => onChange({ ...step, title: e.target.value || undefined })}
        />
      </div>

      <Select
        label="Transition"
        options={TRANSITION_OPTIONS}
        value={step.transition}
        onChange={(v) => onChange({ ...step, transition: v as TransitionType })}
      />

      <Input
        label="Duration (seconds)"
        type="number"
        value={step.duration}
        min={0}
        step={0.1}
        placeholder="0 = wait for click"
        onChange={(e) =>
          onChange({ ...step, duration: parseFloat(e.target.value) || 0 })
        }
      />

      <Textarea
        label="Voiceover"
        value={step.voiceoverText ?? ""}
        rows={3}
        placeholder="Optional voiceover script for this step…"
        onChange={(e) => onChange({ ...step, voiceoverText: e.target.value })}
      />

      {demo.chapters.length > 0 && (
        <Select
          label="Chapter"
          options={chapterOptions}
          value={step.chapter ?? ""}
          onChange={(v) => onChange({ ...step, chapter: v || undefined })}
        />
      )}

      {/* Click target coords */}
      <div>
        <p className="text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
          Click Target
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {(["x", "y", "width", "height"] as const).map((field) => (
            <Input
              key={field}
              label={field.toUpperCase()}
              type="number"
              value={step.clickTarget?.[field] ?? ""}
              min={0}
              max={1}
              step={0.01}
              placeholder="—"
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onChange({
                  ...step,
                  clickTarget: {
                    x: step.clickTarget?.x ?? 0,
                    y: step.clickTarget?.y ?? 0,
                    width: step.clickTarget?.width ?? 0.1,
                    height: step.clickTarget?.height ?? 0.1,
                    [field]: isNaN(val) ? 0 : val,
                  },
                });
              }}
            />
          ))}
        </div>
        {step.clickTarget && (
          <button
            className="mt-1.5 text-[11px] text-zinc-600 hover:text-rose-400 transition-colors"
            onClick={() => onChange({ ...step, clickTarget: undefined })}
          >
            Clear click target
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StepEditor({ step, onChange, demo }: StepEditorProps) {
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [selectedOverlay, setSelectedOverlay] = useState<SelectedOverlay | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const propertiesPanelId = useId();

  // Deselect overlay when step changes
  useEffect(() => {
    setSelectedOverlay(null);
  }, [step.id]);

  // ── Overlay mutation helpers ───────────────────────────────────────────────

  const updateHotspot = useCallback(
    (updated: Hotspot) =>
      onChange({
        ...step,
        hotspots: step.hotspots.map((h) => (h.id === updated.id ? updated : h)),
      }),
    [onChange, step]
  );

  const deleteHotspot = useCallback(
    (id: string) => {
      setSelectedOverlay(null);
      onChange({ ...step, hotspots: step.hotspots.filter((h) => h.id !== id) });
    },
    [onChange, step]
  );

  const updateCallout = useCallback(
    (updated: Callout) =>
      onChange({
        ...step,
        callouts: step.callouts.map((c) => (c.id === updated.id ? updated : c)),
      }),
    [onChange, step]
  );

  const deleteCallout = useCallback(
    (id: string) => {
      setSelectedOverlay(null);
      onChange({ ...step, callouts: step.callouts.filter((c) => c.id !== id) });
    },
    [onChange, step]
  );

  const updateBlurRegion = useCallback(
    (updated: BlurRegion) =>
      onChange({
        ...step,
        blurRegions: step.blurRegions.map((b) =>
          b.id === updated.id ? updated : b
        ),
      }),
    [onChange, step]
  );

  const deleteBlurRegion = useCallback(
    (id: string) => {
      setSelectedOverlay(null);
      onChange({
        ...step,
        blurRegions: step.blurRegions.filter((b) => b.id !== id),
      });
    },
    [onChange, step]
  );

  // ── Canvas click: add overlay based on active tool ─────────────────────────

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeTool === "select") {
        setSelectedOverlay(null);
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;

      if (activeTool === "hotspot") {
        const hotspot = newHotspot(fx, fy);
        onChange({ ...step, hotspots: [...step.hotspots, hotspot] });
        setSelectedOverlay({ kind: "hotspot", id: hotspot.id });
        setActiveTool("select");
      } else if (activeTool === "callout") {
        const callout = newCallout(fx, fy);
        onChange({ ...step, callouts: [...step.callouts, callout] });
        setSelectedOverlay({ kind: "callout", id: callout.id });
        setActiveTool("select");
      } else if (activeTool === "blur") {
        const blur = newBlurRegion(fx, fy);
        onChange({ ...step, blurRegions: [...step.blurRegions, blur] });
        setSelectedOverlay({ kind: "blur", id: blur.id });
        setActiveTool("select");
      }
    },
    [activeTool, onChange, step]
  );

  // ── Resolve selected overlay object ───────────────────────────────────────

  const selectedHotspot =
    selectedOverlay?.kind === "hotspot"
      ? step.hotspots.find((h) => h.id === selectedOverlay.id) ?? null
      : null;

  const selectedCallout =
    selectedOverlay?.kind === "callout"
      ? step.callouts.find((c) => c.id === selectedOverlay.id) ?? null
      : null;

  const selectedBlurRegion =
    selectedOverlay?.kind === "blur"
      ? step.blurRegions.find((b) => b.id === selectedOverlay.id) ?? null
      : null;

  // ── Tool button helper ─────────────────────────────────────────────────────

  function ToolButton({
    tool,
    label,
    children,
  }: {
    tool: ActiveTool;
    label: string;
    children: React.ReactNode;
  }) {
    return (
      <button
        title={label}
        aria-label={label}
        onClick={() => setActiveTool(tool)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors",
          activeTool === tool
            ? "bg-violet-600/30 text-violet-300 border border-violet-500/40"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-transparent"
        )}
      >
        {children}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-zinc-950">
      {/* ── Canvas area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="shrink-0 h-10 bg-zinc-900/80 border-b border-zinc-800 flex items-center gap-1 px-3">
          <ToolButton tool="select" label="Select">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
            </svg>
          </ToolButton>

          <div className="w-px h-4 bg-zinc-700 mx-0.5" />

          <ToolButton tool="hotspot" label="Hotspot">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" />
              <path strokeLinecap="round" d="M12 2v2M12 20v2M2 12h2M20 12h2" />
            </svg>
          </ToolButton>

          <ToolButton tool="callout" label="Callout">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </ToolButton>

          <ToolButton tool="blur" label="Blur">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A2.25 2.25 0 0023.25 18V6A2.25 2.25 0 0021 3.75H3A2.25 2.25 0 00.75 6v12A2.25 2.25 0 003 20.25z" />
            </svg>
          </ToolButton>

          {/* Cursor hint */}
          {activeTool !== "select" && (
            <span className="ml-2 text-[11px] text-violet-400 italic">
              Click on canvas to place
            </span>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-zinc-950">
          <div
            ref={canvasRef}
            className={cn(
              "relative w-full max-w-3xl select-none",
              "rounded-xl overflow-hidden border border-zinc-800",
              "shadow-[0_8px_40px_rgba(0,0,0,0.5)]",
              activeTool !== "select" && "cursor-crosshair"
            )}
            style={{ aspectRatio: `${demo.settings.width}/${demo.settings.height}` }}
            onClick={handleCanvasClick}
          >
            {/* Screenshot */}
            {step.screenshotDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={step.screenshotDataUrl}
                alt="Step screenshot"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center">
                    <svg className="w-6 h-6 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A2.25 2.25 0 0023.25 18V6A2.25 2.25 0 0021 3.75H3A2.25 2.25 0 00.75 6v12A2.25 2.25 0 003 20.25z" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-500">No screenshot for this step</p>
                  <p className="text-xs text-zinc-600">Upload a video to generate screenshots automatically</p>
                </div>
              </div>
            )}

            {/* Blur regions (rendered behind other overlays) */}
            {step.blurRegions.map((region) => (
              <BlurOverlay
                key={region.id}
                region={region}
                isSelected={selectedOverlay?.id === region.id}
                onSelect={() => setSelectedOverlay({ kind: "blur", id: region.id })}
              />
            ))}

            {/* Callout overlays */}
            {step.callouts.map((callout) => (
              <CalloutOverlay
                key={callout.id}
                callout={callout}
                isSelected={selectedOverlay?.id === callout.id}
                onSelect={() => setSelectedOverlay({ kind: "callout", id: callout.id })}
                onDragEnd={(x, y) => updateCallout({ ...callout, position: { x, y } })}
              />
            ))}

            {/* Hotspot overlays */}
            {step.hotspots.map((hotspot) => (
              <HotspotOverlay
                key={hotspot.id}
                hotspot={hotspot}
                isSelected={selectedOverlay?.id === hotspot.id}
                onSelect={() => setSelectedOverlay({ kind: "hotspot", id: hotspot.id })}
                onDragEnd={(x, y) => updateHotspot({ ...hotspot, bounds: { ...hotspot.bounds, x, y } })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Right properties sidebar ──────────────────────────────────────── */}
      <aside
        id={propertiesPanelId}
        className="w-52 shrink-0 border-l border-zinc-800 bg-zinc-900/60 flex flex-col overflow-y-auto overflow-x-hidden"
      >
        <div className="px-3 py-2.5 border-b border-zinc-800/80">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
            Properties
          </p>
        </div>

        <div className="p-3 space-y-6">
          {/* Overlay-specific properties */}
          {selectedHotspot && (
            <HotspotProperties
              hotspot={selectedHotspot}
              demo={demo}
              onChange={updateHotspot}
              onDelete={() => deleteHotspot(selectedHotspot.id)}
            />
          )}
          {selectedCallout && (
            <CalloutProperties
              callout={selectedCallout}
              onChange={updateCallout}
              onDelete={() => deleteCallout(selectedCallout.id)}
            />
          )}
          {selectedBlurRegion && (
            <BlurProperties
              region={selectedBlurRegion}
              onChange={updateBlurRegion}
              onDelete={() => deleteBlurRegion(selectedBlurRegion.id)}
            />
          )}

          {/* Divider when overlay is selected */}
          {selectedOverlay && (
            <div className="border-t border-zinc-800" />
          )}

          {/* Step properties are always visible */}
          <StepProperties step={step} demo={demo} onChange={onChange} />
        </div>
      </aside>
    </div>
  );
}
