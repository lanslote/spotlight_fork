"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select } from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TemplateProps {
  productName: string;
  tagline: string;
  category?: string;
  version?: string;
  features: string[];
  theme: string;
  duration: number;
  gradientStart: string;
  gradientEnd: string;
}

interface PropertyPanelProps {
  props: TemplateProps;
  onChange: (updated: Partial<TemplateProps>) => void;
  templateId: string;
  className?: string;
}

// ── Themes ────────────────────────────────────────────────────────────────────

const THEMES = [
  { id: "midnight", label: "Midnight",  color1: "#6366f1", color2: "#a78bfa" },
  { id: "aurora",   label: "Aurora",    color1: "#10b981", color2: "#2dd4bf" },
  { id: "ember",    label: "Ember",     color1: "#f97316", color2: "#ef4444" },
  { id: "frost",    label: "Frost",     color1: "#3b82f6", color2: "#0ea5e9" },
  { id: "noir",     label: "Noir",      color1: "#71717a", color2: "#a1a1aa" },
  { id: "sunset",   label: "Sunset",    color1: "#f43f5e", color2: "#fb923c" },
];

const themeGradients: Record<string, [string, string]> = {
  midnight: ["#050818", "#6366f1"],
  aurora:   ["#010d0a", "#10b981"],
  ember:    ["#0f0500", "#f97316"],
  frost:    ["#0f172a", "#3b82f6"],
  noir:     ["#000000", "#71717a"],
  sunset:   ["#0d0005", "#f43f5e"],
};

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.05] last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider hover:text-zinc-200 transition-colors"
      >
        {title}
        {open ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PropertyPanel({ props, onChange, templateId, className }: PropertyPanelProps) {
  const handleFeatureChange = (idx: number, value: string) => {
    const updated = [...props.features];
    updated[idx] = value;
    onChange({ features: updated });
  };

  const handleFeatureAdd = () => {
    onChange({ features: [...props.features, ""] });
  };

  const handleFeatureRemove = (idx: number) => {
    onChange({ features: props.features.filter((_, i) => i !== idx) });
  };

  const handleThemeSelect = (themeId: string) => {
    const grad = themeGradients[themeId];
    if (grad) {
      onChange({ theme: themeId, gradientStart: grad[0], gradientEnd: grad[1] });
    } else {
      onChange({ theme: themeId });
    }
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-surface-1 border-r border-white/[0.05] overflow-y-auto",
        className
      )}
    >
      {/* Panel header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.05]">
        <h2 className="text-sm font-semibold text-zinc-200">Properties</h2>
        <p className="text-xs text-zinc-500 mt-0.5 font-mono">{templateId}</p>
      </div>

      {/* Sections */}
      <div className="flex-1 min-h-0">

        {/* Content */}
        <Section title="Content">
          <Input
            label="Product Name"
            value={props.productName}
            onChange={(e) => onChange({ productName: e.target.value })}
            placeholder="Your Product"
          />
          <Input
            label="Tagline"
            value={props.tagline}
            onChange={(e) => onChange({ tagline: e.target.value })}
            placeholder="One line that sells it"
          />
          <Input
            label="Category"
            value={props.category ?? ""}
            onChange={(e) => onChange({ category: e.target.value })}
            placeholder="e.g. Product Launch"
          />
          {(templateId === "changelog" || templateId === "feature-announce") && (
            <Input
              label="Version"
              value={props.version ?? ""}
              onChange={(e) => onChange({ version: e.target.value })}
              placeholder="e.g. v2.0.0"
            />
          )}
        </Section>

        {/* Features */}
        <Section title="Feature List">
          <div className="space-y-2">
            {props.features.map((feat, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono text-zinc-600 bg-surface-3 shrink-0">
                  {idx + 1}
                </span>
                <input
                  type="text"
                  value={feat}
                  onChange={(e) => handleFeatureChange(idx, e.target.value)}
                  placeholder={`Feature ${idx + 1}`}
                  className={cn(
                    "flex-1 min-w-0 text-sm rounded-lg px-3 py-1.5",
                    "bg-surface-2 border border-white/[0.07] text-zinc-100 placeholder-zinc-600",
                    "focus:outline-none focus:border-accent-500/60",
                    "transition-colors duration-150"
                  )}
                />
                <button
                  onClick={() => handleFeatureRemove(idx)}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={handleFeatureAdd}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-accent-400 transition-colors py-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add feature
            </button>
          </div>
        </Section>

        {/* Theme */}
        <Section title="Theme">
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeSelect(theme.id)}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-150",
                  "border",
                  props.theme === theme.id
                    ? "border-accent-500/60 bg-accent-500/10"
                    : "border-white/[0.06] bg-surface-2 hover:border-white/[0.12]"
                )}
              >
                {/* Color swatch */}
                <div
                  className="w-10 h-6 rounded-md"
                  style={{
                    background: `linear-gradient(135deg, ${theme.color1}, ${theme.color2})`,
                  }}
                />
                <span className="text-[10px] text-zinc-400">{theme.label}</span>
                {props.theme === theme.id && (
                  <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-400" />
                )}
              </button>
            ))}
          </div>

          {/* Custom gradient colors */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">
                From
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={props.gradientStart}
                  onChange={(e) => onChange({ gradientStart: e.target.value })}
                  className="w-8 h-8 rounded-md cursor-pointer bg-transparent border-0 p-0"
                />
                <input
                  type="text"
                  value={props.gradientStart}
                  onChange={(e) => onChange({ gradientStart: e.target.value })}
                  className="flex-1 min-w-0 text-xs font-mono rounded px-2 py-1.5 bg-surface-2 border border-white/[0.07] text-zinc-400 focus:outline-none focus:border-accent-500/40"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">
                To
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={props.gradientEnd}
                  onChange={(e) => onChange({ gradientEnd: e.target.value })}
                  className="w-8 h-8 rounded-md cursor-pointer bg-transparent border-0 p-0"
                />
                <input
                  type="text"
                  value={props.gradientEnd}
                  onChange={(e) => onChange({ gradientEnd: e.target.value })}
                  className="flex-1 min-w-0 text-xs font-mono rounded px-2 py-1.5 bg-surface-2 border border-white/[0.07] text-zinc-400 focus:outline-none focus:border-accent-500/40"
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Timing */}
        <Section title="Timing">
          <Slider
            label="Duration"
            min={10}
            max={120}
            step={5}
            value={props.duration}
            onChange={(v) => onChange({ duration: v })}
            displayValue={(v) => `${v}s`}
          />
        </Section>

      </div>

      {/* Footer hint */}
      <div className="shrink-0 px-4 py-3 border-t border-white/[0.05]">
        <p className="text-[11px] text-zinc-600 text-center">
          Changes preview instantly ↑
        </p>
      </div>
    </aside>
  );
}
