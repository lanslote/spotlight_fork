"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { PreviewCanvas } from "@/components/editor/preview-canvas";
import { PropertyPanel, type TemplateProps } from "@/components/editor/property-panel";
import { TimelineBar, type TimelineScene } from "@/components/editor/timeline-bar";
import { ExportDialog } from "@/components/editor/export-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Download,
  Share2,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
  PanelLeftOpen,
  PanelRightOpen,
} from "lucide-react";
import Link from "next/link";

// ── Template registry ─────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: "product-hunt",
    name: "Product Hunt Launch",
    category: "Product Launch",
    description: "Dramatic reveal for your PH launch day",
    durationRange: "30-60s",
    aspectRatios: ["16:9", "1:1"] as ("16:9" | "1:1")[],
    gradient: ["#7c3aed", "#2563eb"] as [string, string],
    defaultProps: {
      productName: "Spotlight",
      tagline: "Ship product videos that look like Apple made them",
      category: "Product Launch",
      features: ["60fps Canvas Rendering", "WebCodecs Export", "6 Premium Templates"],
      theme: "midnight",
      duration: 45,
      gradientStart: "#7c3aed",
      gradientEnd: "#2563eb",
    },
  },
  {
    id: "feature-announce",
    name: "Feature Announcement",
    category: "Feature",
    description: "Showcase new features with style",
    durationRange: "15-45s",
    aspectRatios: ["16:9", "1:1"] as ("16:9" | "1:1")[],
    gradient: ["#059669", "#06b6d4"] as [string, string],
    defaultProps: {
      productName: "Acme App",
      tagline: "Three new features, shipped today",
      category: "Feature",
      version: "v2.1.0",
      features: ["Dark Mode", "API Webhooks", "CSV Export"],
      theme: "aurora",
      duration: 30,
      gradientStart: "#059669",
      gradientEnd: "#06b6d4",
    },
  },
  {
    id: "social-teaser",
    name: "Social Teaser",
    category: "Social",
    description: "Scroll-stopping social media clips",
    durationRange: "15-30s",
    aspectRatios: ["9:16", "1:1"] as ("9:16" | "1:1")[],
    gradient: ["#e11d48", "#f59e0b"] as [string, string],
    defaultProps: {
      productName: "Something Big",
      tagline: "Coming soon. Stay tuned.",
      category: "Social",
      features: ["Drop 01", "Limited Access", "Sign up now"],
      theme: "sunset",
      duration: 20,
      gradientStart: "#e11d48",
      gradientEnd: "#f59e0b",
    },
  },
  {
    id: "landing-hero",
    name: "Landing Hero",
    category: "Landing",
    description: "Looping hero video for your site",
    durationRange: "10-30s",
    aspectRatios: ["16:9"] as ("16:9")[],
    gradient: ["#8b5cf6", "#ec4899"] as [string, string],
    defaultProps: {
      productName: "HeroKit",
      tagline: "Your product, beautifully framed",
      category: "Landing",
      features: ["Infinite loop", "No sound needed", "Pure visuals"],
      theme: "midnight",
      duration: 20,
      gradientStart: "#8b5cf6",
      gradientEnd: "#ec4899",
    },
  },
  {
    id: "changelog",
    name: "Changelog Update",
    category: "Changelog",
    description: "Beautiful version release videos",
    durationRange: "15-45s",
    aspectRatios: ["16:9", "1:1"] as ("16:9" | "1:1")[],
    gradient: ["#3b82f6", "#6366f1"] as [string, string],
    defaultProps: {
      productName: "YourApp",
      tagline: "What shipped this week",
      category: "Changelog",
      version: "v3.0.0",
      features: ["Performance 2x faster", "Redesigned onboarding", "15 bug fixes"],
      theme: "midnight",
      duration: 30,
      gradientStart: "#3b82f6",
      gradientEnd: "#6366f1",
    },
  },
  {
    id: "app-store",
    name: "App Store Preview",
    category: "App Store",
    description: "Vertical preview for iOS/Android stores",
    durationRange: "15-30s",
    aspectRatios: ["9:16"] as ("9:16")[],
    gradient: ["#f43f5e", "#8b5cf6"] as [string, string],
    defaultProps: {
      productName: "MyApp",
      tagline: "The best app you'll use today",
      category: "App Store",
      features: ["Intuitive design", "Lightning fast", "Privacy first"],
      theme: "sunset",
      duration: 25,
      gradientStart: "#f43f5e",
      gradientEnd: "#8b5cf6",
    },
  },
];

// ── Timeline scenes ───────────────────────────────────────────────────────────

function buildScenes(templateId: string, grad: [string, string]): TimelineScene[] {
  return [
    { id: "intro",    name: "Intro",    duration: 3.5, gradient: grad },
    { id: "features", name: "Features", duration: 4.0, gradient: [grad[1], grad[0]] },
    { id: "outro",    name: "Outro",    duration: 3.0, gradient: grad },
  ];
}

// ── Editor page ───────────────────────────────────────────────────────────────

type AspectRatioType = "16:9" | "9:16" | "1:1";

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = (params?.id as string) ?? "product-hunt";

  // Find template config
  const templateConfig = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];

  // Editor state
  const [props, setProps] = useState<TemplateProps>(templateConfig.defaultProps);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>(
    (templateConfig.aspectRatios[0] as AspectRatioType) ?? "16:9"
  );
  const [activeSceneId, setActiveSceneId] = useState("intro");
  const [exportOpen, setExportOpen] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const scenes = useMemo(
    () => buildScenes(templateId, templateConfig.gradient),
    [templateId, templateConfig.gradient]
  );

  const totalDuration = useMemo(
    () => scenes.reduce((t, s) => t + s.duration, 0),
    [scenes]
  );

  const handlePropsChange = useCallback((updated: Partial<TemplateProps>) => {
    setProps((prev) => ({ ...prev, ...updated }));
  }, []);

  return (
    <div className="flex flex-col h-screen bg-surface-0 overflow-hidden">
      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 h-12 bg-surface-1 border-b border-white/[0.06] flex items-center gap-2 px-3">
        {/* Back */}
        <Link href="/templates">
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition-all text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Templates</span>
          </button>
        </Link>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        {/* Template name + logo */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-5 h-5 rounded-md shrink-0"
            style={{
              background: `linear-gradient(135deg, ${templateConfig.gradient[0]}, ${templateConfig.gradient[1]})`,
            }}
          />
          <span className="text-sm font-medium text-zinc-200 truncate">
            {templateConfig.name}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Panel toggles */}
        <button
          onClick={() => setLeftPanelOpen((v) => !v)}
          className={cn(
            "p-2 rounded-lg transition-all text-xs",
            leftPanelOpen
              ? "text-accent-400 bg-accent-500/10"
              : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05]"
          )}
          title="Toggle properties panel"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>

        <button
          onClick={() => setRightPanelOpen((v) => !v)}
          className={cn(
            "p-2 rounded-lg transition-all",
            rightPanelOpen
              ? "text-accent-400 bg-accent-500/10"
              : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05]"
          )}
          title="Toggle timeline panel"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        {/* History (decorative) */}
        <button
          className="p-2 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] transition-all"
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          className="p-2 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] transition-all"
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-white/[0.08] mx-1" />

        {/* Share */}
        <button
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition-all"
          title="Share"
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* Export CTA */}
        <Button
          variant="primary"
          size="sm"
          onClick={() => setExportOpen(true)}
          className="gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </Button>
      </header>

      {/* ── Three-panel body ───────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left: Property panel */}
        {leftPanelOpen && (
          <div className="w-64 shrink-0 overflow-hidden transition-all duration-200">
            <PropertyPanel
              props={props}
              onChange={handlePropsChange}
              templateId={templateId}
              className="h-full"
            />
          </div>
        )}

        {/* Center: Canvas preview */}
        <div className="flex-1 min-w-0 overflow-hidden p-3">
          <PreviewCanvas
            templateId={templateId}
            props={props}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            className="h-full"
          />
        </div>

        {/* Right: Timeline */}
        {rightPanelOpen && (
          <div className="w-52 shrink-0 overflow-hidden transition-all duration-200">
            <TimelineBar
              scenes={scenes}
              activeSceneId={activeSceneId}
              totalDuration={totalDuration}
              onSceneClick={setActiveSceneId}
              className="h-full"
            />
          </div>
        )}
      </div>

      {/* Export dialog */}
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        templateId={templateId}
        productName={props.productName}
      />
    </div>
  );
}
