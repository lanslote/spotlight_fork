"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BACKGROUND_PRESETS } from "@/engine/compositor";
import type {
  BackgroundStyle,
  DeviceFrameConfig,
  TextOverlay,
  GrainConfig,
  DeviceFrame,
} from "@/engine/compositor";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StylePanelProps {
  background: BackgroundStyle;
  deviceFrame: DeviceFrameConfig;
  textOverlays: TextOverlay[];
  grain: GrainConfig;
  onBackgroundChange: (bg: BackgroundStyle) => void;
  onDeviceFrameChange: (df: DeviceFrameConfig) => void;
  onTextOverlaysChange: (overlays: TextOverlay[]) => void;
  onGrainChange: (grain: GrainConfig) => void;
  className?: string;
}

type SectionKey = "background" | "frame" | "overlays" | "effects";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEVICE_FRAMES: { value: DeviceFrame; label: string }[] = [
  { value: "none",    label: "None" },
  { value: "browser", label: "Browser" },
  { value: "minimal", label: "Minimal" },
  { value: "macbook", label: "MacBook" },
  { value: "iphone",  label: "iPhone" },
  { value: "ipad",    label: "iPad" },
];

const COLOR_SCHEMES: { value: NonNullable<DeviceFrameConfig["colorScheme"]>; label: string }[] = [
  { value: "midnight",   label: "Midnight" },
  { value: "silver",     label: "Silver" },
  { value: "space-gray", label: "Space Gray" },
  { value: "starlight",  label: "Starlight" },
];

const TEXT_ANIMATIONS: NonNullable<TextOverlay["animation"]>[] = [
  "fade", "slide-up", "slide-down", "typewriter",
];

const ANIMATION_LABELS: Record<NonNullable<TextOverlay["animation"]>, string> = {
  fade: "Fade",
  "slide-up": "Slide Up",
  "slide-down": "Slide Down",
  typewriter: "Typewriter",
};

// Background preview swatches (CSS gradient / solid representations)
const PRESET_SWATCHES: Record<string, string> = {
  "midnight-gradient": "radial-gradient(circle, #1e1b4b, #0f0c29, #050314)",
  "aurora-gradient":   "linear-gradient(135deg, #051e19, #10b981, #050f1e)",
  "ember-gradient":    "linear-gradient(160deg, #280a00, #f97316, #140500)",
  "frost-gradient":    "linear-gradient(180deg, #0f172a, #3b82f6, #0a0f1e)",
  "noir":              "#0a0a0a",
  "clean-white":       "#f5f5f5",
  "blurred":           "linear-gradient(135deg, #18181b, #3f3f46)",
};

let _overlayIdCounter = 0;
function makeOverlayId() {
  return `overlay_${++_overlayIdCounter}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  sectionKey: SectionKey;
  openSection: SectionKey | null;
  onToggle: (key: SectionKey) => void;
  children: React.ReactNode;
}

function Section({ title, sectionKey, openSection, onToggle, children }: SectionProps) {
  const isOpen = openSection === sectionKey;
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      <button
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors duration-150"
      >
        <span className="text-sm font-medium text-zinc-200">{title}</span>
        <svg
          className={cn("w-4 h-4 text-zinc-500 transition-transform duration-200", isOpen && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-800/60 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: (v: boolean) => void;
}

function ToggleRow({ label, description, checked, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-zinc-300">{label}</p>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onToggle(!checked)}
        className={cn(
          "relative shrink-0 w-10 h-5.5 rounded-full border transition-all duration-200",
          checked
            ? "bg-violet-600 border-violet-500"
            : "bg-zinc-700 border-zinc-600",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked && "translate-x-[18px]",
          )}
        />
      </button>
    </div>
  );
}

interface InlineSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}

function InlineSlider({ label, min, max, step, value, onChange, format }: InlineSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = format ? format(value) : String(value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">{label}</label>
        <span className="text-[11px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">{display}</span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="relative w-full h-1.5 rounded-full bg-zinc-800">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-600 to-indigo-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute w-4 h-4 rounded-full -translate-x-1/2 pointer-events-none bg-white shadow-[0_0_0_2px_rgba(139,92,246,0.6)]"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Text overlay editor ────────────────────────────────────────────────────────

interface TextOverlayEditorProps {
  overlay: TextOverlay;
  onChange: (updated: TextOverlay) => void;
  onDelete: () => void;
}

function TextOverlayEditor({ overlay, onChange, onDelete }: TextOverlayEditorProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg bg-zinc-800/60 border border-zinc-700/60 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <svg
            className={cn("w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform duration-150", expanded && "rotate-90")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-sm text-zinc-300 truncate">{overlay.text || "(empty)"}</span>
        </button>
        <button
          onClick={onDelete}
          className="shrink-0 p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          aria-label="Delete overlay"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-zinc-700/40 space-y-3">
          {/* Text content */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Text</label>
            <input
              type="text"
              value={overlay.text}
              onChange={(e) => onChange({ ...overlay, text: e.target.value })}
              placeholder="Enter overlay text…"
              className="w-full px-3 py-2 rounded-lg text-sm bg-zinc-900 border border-zinc-700 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-colors"
            />
          </div>

          {/* Position */}
          <div className="grid grid-cols-2 gap-2">
            <InlineSlider
              label="X"
              min={0}
              max={1}
              step={0.01}
              value={overlay.x}
              onChange={(v) => onChange({ ...overlay, x: v })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <InlineSlider
              label="Y"
              min={0}
              max={1}
              step={0.01}
              value={overlay.y}
              onChange={(v) => onChange({ ...overlay, y: v })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </div>

          {/* Timing */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Start (s)</label>
              <input
                type="number"
                value={overlay.startTime}
                min={0}
                step={0.1}
                onChange={(e) => onChange({ ...overlay, startTime: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg text-sm bg-zinc-900 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">End (s)</label>
              <input
                type="number"
                value={overlay.endTime}
                min={0}
                step={0.1}
                onChange={(e) => onChange({ ...overlay, endTime: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg text-sm bg-zinc-900 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Font size */}
          <InlineSlider
            label="Font size"
            min={12}
            max={96}
            step={2}
            value={overlay.fontSize}
            onChange={(v) => onChange({ ...overlay, fontSize: v })}
            format={(v) => `${v}px`}
          />

          {/* Animation */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Animation</label>
            <div className="flex flex-wrap gap-1.5">
              {TEXT_ANIMATIONS.map((anim) => (
                <button
                  key={anim}
                  onClick={() => onChange({ ...overlay, animation: anim })}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium border transition-all duration-100",
                    overlay.animation === anim
                      ? "bg-violet-600/20 border-violet-500/40 text-violet-400"
                      : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400",
                  )}
                >
                  {ANIMATION_LABELS[anim]}
                </button>
              ))}
              <button
                onClick={() => onChange({ ...overlay, animation: undefined })}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium border transition-all duration-100",
                  !overlay.animation
                    ? "bg-violet-600/20 border-violet-500/40 text-violet-400"
                    : "bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400",
                )}
              >
                None
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function StylePanel({
  background,
  deviceFrame,
  textOverlays,
  grain,
  onBackgroundChange,
  onDeviceFrameChange,
  onTextOverlaysChange,
  onGrainChange,
  className,
}: StylePanelProps) {
  const [openSection, setOpenSection] = useState<SectionKey | null>("background");

  function toggleSection(key: SectionKey) {
    setOpenSection((prev) => (prev === key ? null : key));
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  function addTextOverlay() {
    const newOverlay: TextOverlay = {
      id: makeOverlayId(),
      text: "New overlay",
      x: 0.5,
      y: 0.8,
      fontSize: 28,
      fontFamily: "Inter, sans-serif",
      fontWeight: 600,
      color: { r: 255, g: 255, b: 255, a: 1 },
      textAlign: "center",
      startTime: 0,
      endTime: 5,
      animation: "fade",
      animationDuration: 0.3,
    };
    onTextOverlaysChange([...textOverlays, newOverlay]);
  }

  function updateOverlay(index: number, updated: TextOverlay) {
    onTextOverlaysChange(textOverlays.map((o, i) => (i === index ? updated : o)));
  }

  function deleteOverlay(index: number) {
    onTextOverlaysChange(textOverlays.filter((_, i) => i !== index));
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* ── Background ────────────────────────────────────────────────────── */}
      <Section
        title="Background"
        sectionKey="background"
        openSection={openSection}
        onToggle={toggleSection}
      >
        <div className="grid grid-cols-4 gap-2.5">
          {Object.entries(BACKGROUND_PRESETS).map(([key, preset]) => {
            const isActive = background.type === preset.type &&
              JSON.stringify(background.gradientStops) === JSON.stringify(preset.gradientStops) &&
              (background as BackgroundStyle).blurAmount === preset.blurAmount &&
              (background.color as { r?: number } | undefined)?.r === (preset.color as { r?: number } | undefined)?.r;

            return (
              <button
                key={key}
                title={key.replace(/-/g, " ")}
                onClick={() => onBackgroundChange(preset)}
                className={cn(
                  "relative w-full aspect-square rounded-xl transition-all duration-150 overflow-hidden",
                  "border-2",
                  isActive
                    ? "border-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.25)]"
                    : "border-transparent hover:border-zinc-600",
                )}
              >
                <div
                  className="absolute inset-0"
                  style={{ background: PRESET_SWATCHES[key] ?? "#18181b" }}
                />
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-white/90 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-violet-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white/80 text-center py-0.5 capitalize">
                  {key.split("-").slice(0, 1).join("")}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Device Frame ──────────────────────────────────────────────────── */}
      <Section
        title="Device Frame"
        sectionKey="frame"
        openSection={openSection}
        onToggle={toggleSection}
      >
        <div className="space-y-3">
          {/* Frame type radio group */}
          <div className="grid grid-cols-3 gap-1.5">
            {DEVICE_FRAMES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onDeviceFrameChange({ ...deviceFrame, type: value })}
                className={cn(
                  "px-2 py-2 rounded-lg text-xs font-medium border transition-all duration-100 text-center",
                  deviceFrame.type === value
                    ? "bg-violet-600/20 border-violet-500/40 text-violet-400"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Color scheme — only when frame is not "none" */}
          {deviceFrame.type !== "none" && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Color Scheme</label>
              <div className="grid grid-cols-2 gap-1.5">
                {COLOR_SCHEMES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => onDeviceFrameChange({ ...deviceFrame, colorScheme: value })}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-100 text-left",
                      deviceFrame.colorScheme === value
                        ? "bg-violet-600/20 border-violet-500/40 text-violet-400"
                        : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Toggles */}
          {deviceFrame.type !== "none" && (
            <div className="space-y-2.5 pt-1">
              <ToggleRow
                label="Shadow"
                checked={deviceFrame.showShadow !== false}
                onToggle={(v) => onDeviceFrameChange({ ...deviceFrame, showShadow: v })}
              />
              <ToggleRow
                label="Glass reflection"
                checked={!!deviceFrame.showReflection}
                onToggle={(v) => onDeviceFrameChange({ ...deviceFrame, showReflection: v })}
              />
            </div>
          )}
        </div>
      </Section>

      {/* ── Text Overlays ─────────────────────────────────────────────────── */}
      <Section
        title={`Text Overlays${textOverlays.length > 0 ? ` (${textOverlays.length})` : ""}`}
        sectionKey="overlays"
        openSection={openSection}
        onToggle={toggleSection}
      >
        <div className="space-y-2">
          {textOverlays.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-3">
              No overlays yet — add one below
            </p>
          ) : (
            textOverlays.map((overlay, i) => (
              <TextOverlayEditor
                key={overlay.id}
                overlay={overlay}
                onChange={(updated) => updateOverlay(i, updated)}
                onDelete={() => deleteOverlay(i)}
              />
            ))
          )}
          <button
            onClick={addTextOverlay}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-zinc-400 border border-dashed border-zinc-700 hover:border-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/40 transition-all duration-150"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Text Overlay
          </button>
        </div>
      </Section>

      {/* ── Effects ───────────────────────────────────────────────────────── */}
      <Section
        title="Effects"
        sectionKey="effects"
        openSection={openSection}
        onToggle={toggleSection}
      >
        <div className="space-y-3">
          <ToggleRow
            label="Film Grain"
            description="Adds subtle noise for a cinematic feel"
            checked={!!grain.enabled}
            onToggle={(v) => onGrainChange({ ...grain, enabled: v })}
          />
          {grain.enabled && (
            <div className="pl-4 border-l-2 border-zinc-800 space-y-3">
              <InlineSlider
                label="Intensity"
                min={0.01}
                max={0.15}
                step={0.005}
                value={grain.intensity ?? 0.03}
                onChange={(v) => onGrainChange({ ...grain, intensity: v })}
                format={(v) => `${Math.round(v * 100)}%`}
              />
              <InlineSlider
                label="Size"
                min={0.5}
                max={3}
                step={0.1}
                value={grain.size ?? 1}
                onChange={(v) => onGrainChange({ ...grain, size: v })}
                format={(v) => `${v.toFixed(1)}x`}
              />
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
