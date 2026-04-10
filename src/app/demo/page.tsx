"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StepList } from "@/components/demo/step-list";
import { StepEditor } from "@/components/demo/step-editor";
import { cn } from "@/lib/utils";
import {
  createDefaultDemo,
  createDefaultStep,
  reorderSteps,
  addStep,
  removeStep,
  DemoEngine,
} from "@/engine/demo-engine";
import type { Demo, DemoStep, TransitionType } from "@/engine/demo-engine";
import {
  exportAsHTML,
  exportAsJSON,
  generateShareableLink,
  exportAsGIF,
  downloadBlob,
} from "@/engine/demo-exporter";
import { VideoAnalyzer } from "@/engine/video-analyzer";

// ─── Phase machine ─────────────────────────────────────────────────────────────

type Phase = "upload" | "analyze" | "edit-steps" | "preview" | "export";

const PHASES: Phase[] = ["upload", "analyze", "edit-steps", "preview", "export"];

const ANALYZE_STEPS = [
  "Detecting scene boundaries",
  "Extracting screenshots",
  "Mapping click targets",
  "Generating thumbnails",
] as const;

// ─── Sensitivity presets ──────────────────────────────────────────────────────

type Sensitivity = "low" | "medium" | "high" | "very-high";

const SENSITIVITY_PRESETS: Record<Sensitivity, { label: string; description: string; analysisFPS: number; sceneCutThreshold: number; thumbnailScale: number; minSceneDuration: number }> = {
  low: {
    label: "Low",
    description: "Page-level changes only (fewest steps)",
    analysisFPS: 3,
    sceneCutThreshold: 0.35,
    thumbnailScale: 0.1,
    minSceneDuration: 0.8,
  },
  medium: {
    label: "Medium",
    description: "Tab switches, modals, navigation",
    analysisFPS: 5,
    sceneCutThreshold: 0.15,
    thumbnailScale: 0.1,
    minSceneDuration: 0.3,
  },
  high: {
    label: "High",
    description: "Menus, dropdowns, small UI changes",
    analysisFPS: 8,
    sceneCutThreshold: 0.06,
    thumbnailScale: 0.15,
    minSceneDuration: 0.2,
  },
  "very-high": {
    label: "Very High",
    description: "Every visible change (most steps)",
    analysisFPS: 20,
    sceneCutThreshold: 0.02,
    thumbnailScale: 0.25,
    minSceneDuration: 0.1,
  },
};

// ─── Upload phase ─────────────────────────────────────────────────────────────

function UploadPhase({
  onUploadVideo,
  onStartBlank,
  sensitivity,
  onSensitivityChange,
}: {
  onUploadVideo: (file: File) => void;
  onStartBlank: () => void;
  sensitivity: Sensitivity;
  onSensitivityChange: (s: Sensitivity) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("video/")) return;
      onUploadVideo(file);
    },
    [onUploadVideo]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const features = [
    {
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
      ),
      title: "Step-by-step walkthroughs",
      body: "Videos are automatically split into individual steps, each with its own screenshot.",
    },
    {
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <circle cx="12" cy="12" r="3" />
          <path strokeLinecap="round" d="M12 2v2M12 20v2M2 12h2M20 12h2" />
        </svg>
      ),
      title: "Interactive hotspots",
      body: "Add click zones, tooltips, and branching paths to guide viewers through your product.",
    },
    {
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      ),
      title: "Callouts & annotations",
      body: "Highlight UI features with tooltips, badges, and numbered walkthroughs.",
    },
    {
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      ),
      title: "Export everywhere",
      body: "Publish as an embeddable HTML demo, animated GIF, or shareable link.",
    },
  ];

  return (
    <div className="flex flex-col items-center gap-10 w-full max-w-2xl mx-auto pt-8 pb-16 px-4">
      {/* Hero text */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          Build an interactive demo
        </h2>
        <p className="text-sm text-zinc-400 max-w-md">
          Upload a screen recording and Spotlight will turn it into a clickable
          product demo with hotspots, callouts, and branching flows.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200",
          "flex flex-col items-center justify-center gap-4 py-12 px-6",
          isDragging
            ? "border-violet-500 bg-violet-500/5"
            : "border-zinc-700 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-900"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <div
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
            isDragging ? "bg-violet-600/20" : "bg-zinc-800"
          )}
        >
          <svg
            className={cn(
              "w-7 h-7 transition-colors",
              isDragging ? "text-violet-400" : "text-zinc-500"
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-zinc-200">
            Drop a screen recording here
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            MP4, MOV, WebM — up to 500 MB
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-xs text-zinc-600 font-medium">or</span>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onStartBlank}
        className="border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
      >
        Start with a blank demo
      </Button>

      {/* Sensitivity selector */}
      <div className="w-full space-y-2">
        <p className="text-xs font-medium text-zinc-400 text-center">
          Scene detection sensitivity
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(SENSITIVITY_PRESETS) as Sensitivity[]).map((key) => {
            const preset = SENSITIVITY_PRESETS[key];
            const isActive = sensitivity === key;
            return (
              <button
                key={key}
                onClick={() => onSensitivityChange(key)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all text-center",
                  isActive
                    ? "border-violet-500/60 bg-violet-500/10 text-violet-300"
                    : "border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                )}
              >
                <span className={cn("text-xs font-semibold", isActive && "text-violet-300")}>
                  {preset.label}
                </span>
                <span className="text-[9px] leading-tight opacity-70">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Feature bullets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        {features.map((f) => (
          <div
            key={f.title}
            className="flex gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800/80"
          >
            <div className="mt-0.5 shrink-0 text-violet-400">{f.icon}</div>
            <div>
              <p className="text-sm font-medium text-zinc-200">{f.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{f.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Analyze phase ────────────────────────────────────────────────────────────

function AnalyzePhase({
  progress,
  stepLabel,
}: {
  progress: number;
  stepLabel: string;
}) {
  const pct = Math.round(progress * 100);

  return (
    <div className="flex flex-col items-center justify-center gap-8 w-full max-w-md mx-auto px-4 flex-1">
      {/* Pulsing ring */}
      <div className="relative flex items-center justify-center w-20 h-20">
        <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-violet-500/30 animate-ping [animation-delay:300ms]" />
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-[0_0_24px_rgba(124,58,237,0.4)]">
          <svg
            className="w-5 h-5 text-white animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>

      <div className="text-center space-y-1.5">
        <h2 className="text-lg font-semibold text-zinc-100">
          Analyzing your recording…
        </h2>
        <p className="text-sm text-zinc-400">{stepLabel}</p>
      </div>

      {/* Progress bar */}
      <div className="w-full space-y-2">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex flex-col gap-2 w-full">
        {ANALYZE_STEPS.map((s, i) => {
          const stepProgress = progress * ANALYZE_STEPS.length;
          const done = i < Math.floor(stepProgress);
          const active = i === Math.floor(stepProgress) && progress < 1;

          return (
            <div key={s} className="flex items-center gap-3">
              <div
                className={cn(
                  "w-4 h-4 rounded-full shrink-0 flex items-center justify-center border transition-all duration-300",
                  done
                    ? "bg-violet-600 border-violet-600"
                    : active
                    ? "border-violet-500 bg-violet-500/20"
                    : "border-zinc-700 bg-zinc-800/50"
                )}
              >
                {done && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                )}
                {active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                )}
              </div>
              <span
                className={cn(
                  "text-sm transition-colors duration-200",
                  done
                    ? "text-zinc-400 line-through decoration-zinc-600"
                    : active
                    ? "text-zinc-200"
                    : "text-zinc-600"
                )}
              >
                {s}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Edit steps phase ─────────────────────────────────────────────────────────

function EditStepsPhase({
  demo,
  onDemoChange,
}: {
  demo: Demo;
  onDemoChange: (updated: Demo) => void;
}) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    demo.steps[0]?.id ?? null
  );
  const [showBulk, setShowBulk] = useState(false);
  const [bulkTransition, setBulkTransition] = useState<TransitionType>("fade");
  const [bulkDuration, setBulkDuration] = useState("0");

  const selectedStep = demo.steps.find((s) => s.id === selectedStepId) ?? null;

  const handleApplyBulkTransition = useCallback(() => {
    onDemoChange({
      ...demo,
      steps: demo.steps.map((s) => ({ ...s, transition: bulkTransition })),
    });
  }, [demo, onDemoChange, bulkTransition]);

  const handleApplyBulkDuration = useCallback(() => {
    const dur = parseFloat(bulkDuration) || 0;
    onDemoChange({
      ...demo,
      steps: demo.steps.map((s) => ({ ...s, duration: dur })),
    });
  }, [demo, onDemoChange, bulkDuration]);

  const handleReorderSteps = useCallback(
    (fromIndex: number, toIndex: number) => {
      const updated = { ...demo };
      reorderSteps(updated, fromIndex, toIndex);
      onDemoChange(updated);
    },
    [demo, onDemoChange]
  );

  const handleAddStep = useCallback(() => {
    const updated = { ...demo };
    const newStep = createDefaultStep();
    addStep(updated, newStep);
    onDemoChange(updated);
    setSelectedStepId(newStep.id);
  }, [demo, onDemoChange]);

  const handleDeleteStep = useCallback(
    (stepId: string) => {
      const idx = demo.steps.findIndex((s) => s.id === stepId);
      const updated = { ...demo };
      removeStep(updated, stepId);
      onDemoChange(updated);
      // Select adjacent step after deletion
      const remaining = updated.steps;
      if (remaining.length > 0) {
        const nextIdx = Math.min(idx, remaining.length - 1);
        setSelectedStepId(remaining[nextIdx].id);
      } else {
        setSelectedStepId(null);
      }
    },
    [demo, onDemoChange]
  );

  const handleDuplicateStep = useCallback(
    (stepId: string) => {
      const src = demo.steps.find((s) => s.id === stepId);
      if (!src) return;
      const dup: DemoStep = {
        ...src,
        id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        hotspots: src.hotspots.map((h) => ({ ...h })),
        callouts: src.callouts.map((c) => ({ ...c })),
        blurRegions: src.blurRegions.map((b) => ({ ...b })),
      };
      const srcIdx = demo.steps.findIndex((s) => s.id === stepId);
      const updated: Demo = {
        ...demo,
        steps: [
          ...demo.steps.slice(0, srcIdx + 1),
          dup,
          ...demo.steps.slice(srcIdx + 1),
        ],
      };
      onDemoChange(updated);
      setSelectedStepId(dup.id);
    },
    [demo, onDemoChange]
  );

  const handleStepChange = useCallback(
    (updated: DemoStep) => {
      onDemoChange({
        ...demo,
        steps: demo.steps.map((s) => (s.id === updated.id ? updated : s)),
      });
    },
    [demo, onDemoChange]
  );

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Left: step list sidebar */}
      <div className="w-52 shrink-0 flex flex-col overflow-hidden">
        {/* Bulk settings toggle */}
        <div className="shrink-0 border-b border-zinc-800">
          <button
            onClick={() => setShowBulk((v) => !v)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-widest transition-colors",
              showBulk
                ? "text-violet-400 bg-violet-500/10"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
            )}
          >
            <span>Apply to All</span>
            <svg
              className={cn("w-3 h-3 transition-transform", showBulk && "rotate-180")}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {showBulk && (
            <div className="px-3 pb-3 pt-1 space-y-3 bg-zinc-900/40">
              {/* Bulk transition */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                  Transition
                </label>
                <div className="flex gap-1">
                  <select
                    value={bulkTransition}
                    onChange={(e) => setBulkTransition(e.target.value as TransitionType)}
                    title="Bulk transition type"
                    className="flex-1 h-7 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 px-1.5 outline-none focus:border-violet-500"
                  >
                    <option value="fade">Fade</option>
                    <option value="slide-left">Slide Left</option>
                    <option value="slide-right">Slide Right</option>
                    <option value="zoom">Zoom</option>
                    <option value="morph">Morph</option>
                    <option value="none">None</option>
                  </select>
                  <button
                    onClick={handleApplyBulkTransition}
                    className="shrink-0 h-7 px-2 rounded-md bg-violet-600 hover:bg-violet-500 text-[10px] font-semibold text-white transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Bulk duration */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                  Duration (sec)
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={bulkDuration}
                    onChange={(e) => setBulkDuration(e.target.value)}
                    min={0}
                    step={0.5}
                    placeholder="0 = click"
                    className="flex-1 h-7 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 px-2 outline-none focus:border-violet-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={handleApplyBulkDuration}
                    className="shrink-0 h-7 px-2 rounded-md bg-violet-600 hover:bg-violet-500 text-[10px] font-semibold text-white transition-colors"
                  >
                    Apply
                  </button>
                </div>
                <p className="text-[9px] text-zinc-600">0 = wait for click</p>
              </div>
            </div>
          )}
        </div>

        <StepList
          demo={demo}
          selectedStepId={selectedStepId}
          onSelectStep={setSelectedStepId}
          onReorderSteps={handleReorderSteps}
          onAddStep={handleAddStep}
          onDeleteStep={handleDeleteStep}
          onDuplicateStep={handleDuplicateStep}
        />
      </div>

      {/* Center + right: step editor */}
      {selectedStep ? (
        <StepEditor
          step={selectedStep}
          demo={demo}
          onChange={handleStepChange}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-zinc-950">
          <p className="text-sm text-zinc-500">No steps yet.</p>
          <Button variant="outline" size="sm" onClick={handleAddStep}>
            Add your first step
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Preview phase ────────────────────────────────────────────────────────────

function PreviewPhase({ demo }: { demo: Demo }) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [prevStepIdx, setPrevStepIdx] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const step = demo.steps[currentStepIdx];

  const navigateTo = useCallback(
    (nextIdx: number) => {
      if (nextIdx === currentStepIdx) return;
      const nextStep = demo.steps[nextIdx];
      if (!nextStep) return;

      const transition = nextStep.transition ?? "fade";
      if (transition === "none") {
        setCurrentStepIdx(nextIdx);
        return;
      }

      setPrevStepIdx(currentStepIdx);
      setCurrentStepIdx(nextIdx);
      setIsTransitioning(true);

      const duration = transition === "morph" ? 450 : 350;
      setTimeout(() => setIsTransitioning(false), duration);
    },
    [currentStepIdx, demo.steps]
  );

  if (!step) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-zinc-500">No steps to preview.</p>
      </div>
    );
  }

  const transition = step.transition ?? "fade";
  const prevStep = demo.steps[prevStepIdx];

  // CSS animation classes based on transition type
  const getIncomingClass = () => {
    if (!isTransitioning) return "";
    switch (transition) {
      case "fade":
        return "animate-[fadeIn_350ms_ease-out_forwards]";
      case "slide-left":
        return "animate-[slideInFromRight_350ms_ease-out_forwards]";
      case "slide-right":
        return "animate-[slideInFromLeft_350ms_ease-out_forwards]";
      case "zoom":
        return "animate-[zoomIn_350ms_ease-out_forwards]";
      case "morph":
        return "animate-[morphIn_450ms_ease-out_forwards]";
      default:
        return "";
    }
  };

  const getOutgoingClass = () => {
    if (!isTransitioning) return "hidden";
    switch (transition) {
      case "fade":
        return "animate-[fadeOut_350ms_ease-out_forwards]";
      case "slide-left":
        return "animate-[slideOutToLeft_350ms_ease-out_forwards]";
      case "slide-right":
        return "animate-[slideOutToRight_350ms_ease-out_forwards]";
      case "zoom":
        return "animate-[fadeOut_350ms_ease-out_forwards]";
      case "morph":
        return "animate-[morphOut_450ms_ease-out_forwards]";
      default:
        return "hidden";
    }
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-zinc-950">
      {/* Step navigator strip */}
      <div className="w-44 shrink-0 border-r border-zinc-800 bg-zinc-900/60 flex flex-col overflow-y-auto p-2 gap-1">
        {demo.steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => navigateTo(i)}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg text-left transition-colors",
              i === currentStepIdx
                ? "bg-violet-500/15 border border-violet-500/40 text-zinc-100"
                : "hover:bg-zinc-800/60 border border-transparent text-zinc-400"
            )}
          >
            <span className="text-[10px] font-semibold text-zinc-600 w-4 shrink-0">
              {i + 1}
            </span>
            <span className="text-xs truncate">{s.title ?? `Step ${i + 1}`}</span>
          </button>
        ))}
      </div>

      {/* Preview canvas */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        {/* Step card container */}
        <div
          className="relative w-full max-w-3xl rounded-xl overflow-hidden border border-zinc-800 shadow-[0_8px_40px_rgba(0,0,0,0.5)]"
          style={{
            aspectRatio: `${demo.settings.width}/${demo.settings.height}`,
          }}
        >
          {/* Outgoing step (previous) — only visible during transition */}
          {isTransitioning && prevStep && (
            <div className={cn("absolute inset-0 z-10", getOutgoingClass())}>
              {prevStep.screenshotDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={prevStep.screenshotDataUrl}
                  alt="Previous step"
                  className={cn(
                    "w-full h-full",
                    (prevStep.imageFit ?? "cover") === "cover" && "object-cover",
                    prevStep.imageFit === "contain" && "object-contain",
                    prevStep.imageFit === "fill" && "object-fill",
                    prevStep.imageFit === "none" && "object-none"
                  )}
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full bg-zinc-900" />
              )}
            </div>
          )}

          {/* Incoming step (current) */}
          <div className={cn("absolute inset-0 z-20", getIncomingClass())}>
            {step.screenshotDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={step.screenshotDataUrl}
                alt={step.title ?? `Step ${currentStepIdx + 1}`}
                className={cn(
                  "w-full h-full",
                  (step.imageFit ?? "cover") === "cover" && "object-cover",
                  step.imageFit === "contain" && "object-contain",
                  step.imageFit === "fill" && "object-fill",
                  step.imageFit === "none" && "object-none"
                )}
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                <p className="text-sm text-zinc-600">No screenshot</p>
              </div>
            )}

            {/* Render hotspots in preview */}
            {step.hotspots.map((h) => (
              <div
                key={h.id}
                className={cn(
                  "absolute rounded-lg border-2 cursor-pointer",
                  h.style === "pulse" && "border-violet-400 bg-violet-500/20 animate-pulse",
                  h.style === "highlight" && "border-yellow-400 bg-yellow-400/20",
                  h.style === "outline" && "border-zinc-300 bg-transparent",
                  h.style === "arrow" && "border-violet-500 bg-violet-500/15"
                )}
                style={{
                  left: `${h.bounds.x * 100}%`,
                  top: `${h.bounds.y * 100}%`,
                  width: `${h.bounds.width * 100}%`,
                  height: `${h.bounds.height * 100}%`,
                }}
                title={h.tooltip}
                onClick={() => {
                  if (h.branchTo) {
                    const idx = demo.steps.findIndex((s) => s.id === h.branchTo);
                    if (idx >= 0) navigateTo(idx);
                  } else {
                    navigateTo(Math.min(currentStepIdx + 1, demo.steps.length - 1));
                  }
                }}
              />
            ))}

            {/* Render callouts in preview */}
            {step.callouts.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "absolute rounded-lg px-2 py-1.5 pointer-events-none flex flex-col",
                  "bg-zinc-900/90 border backdrop-blur-sm",
                  c.style === "tooltip" && "border-zinc-600 text-zinc-200",
                  c.style === "badge" && "border-violet-500/60 bg-violet-900/70 text-violet-100",
                  c.style === "arrow" && "border-yellow-500/60 bg-yellow-900/60 text-yellow-100",
                  (c.textAlign ?? "left") === "left" && "text-left",
                  c.textAlign === "center" && "text-center",
                  c.textAlign === "right" && "text-right",
                  (c.verticalAlign ?? "top") === "top" && "justify-start",
                  c.verticalAlign === "middle" && "justify-center",
                  c.verticalAlign === "bottom" && "justify-end"
                )}
                style={{
                  left: `${c.position.x * 100}%`,
                  top: `${c.position.y * 100}%`,
                  width: `${(c.width ?? 0.15) * 100}%`,
                  height: `${(c.height ?? 0.06) * 100}%`,
                  fontSize: `${c.fontSize ?? 12}px`,
                }}
              >
                {c.number !== undefined && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-600 text-[9px] font-bold text-white mr-1">
                    {c.number}
                  </span>
                )}
                {c.text}
              </div>
            ))}

            {/* Render blur regions in preview */}
            {step.blurRegions.map((b) => (
              <div
                key={b.id}
                className="absolute pointer-events-none"
                style={{
                  left: `${b.bounds.x * 100}%`,
                  top: `${b.bounds.y * 100}%`,
                  width: `${b.bounds.width * 100}%`,
                  height: `${b.bounds.height * 100}%`,
                  backdropFilter:
                    b.mode === "blur"
                      ? `blur(${Math.round(b.intensity * 20)}px)`
                      : b.mode === "pixelate"
                      ? `blur(${Math.round(b.intensity * 6)}px)`
                      : "none",
                  background: b.mode === "mask" ? "rgba(9,9,11,0.85)" : undefined,
                }}
              />
            ))}
          </div>
        </div>

        {/* Navigation controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={currentStepIdx === 0}
            onClick={() => navigateTo(currentStepIdx - 1)}
            className="border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
          >
            <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Prev
          </Button>

          <span className="text-xs text-zinc-500">
            {currentStepIdx + 1} / {demo.steps.length}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={currentStepIdx === demo.steps.length - 1}
            onClick={() => navigateTo(currentStepIdx + 1)}
            className="border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
          >
            Next
            <svg className="w-3.5 h-3.5 ml-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Button>
        </div>

        {/* Transition type indicator */}
        <span className="text-[10px] text-zinc-600">
          Transition: {step.transition ?? "fade"}
        </span>
      </div>
    </div>
  );
}

// ─── Export phase ─────────────────────────────────────────────────────────────

function ExportPhase({
  demo,
  onBack,
}: {
  demo: Demo;
  onBack: () => void;
}) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const handleExportHTML = useCallback(async () => {
    setExporting("html");
    try {
      const html = await exportAsHTML(demo);
      const blob = new Blob([html], { type: "text/html" });
      downloadBlob(blob, `${demo.title || "demo"}.html`);
      setDone("html");
    } catch (err) {
      console.error("HTML export failed:", err);
    } finally {
      setExporting(null);
    }
  }, [demo]);

  const handleExportJSON = useCallback(() => {
    const json = exportAsJSON(demo);
    const blob = new Blob([json], { type: "application/json" });
    downloadBlob(blob, `${demo.title || "demo"}.json`);
    setDone("json");
  }, [demo]);

  const handleExportGIF = useCallback(async () => {
    setExporting("gif");
    try {
      const blob = await exportAsGIF(demo);
      downloadBlob(blob, `${demo.title || "demo"}.gif`);
      setDone("gif");
    } catch (err) {
      console.error("GIF export failed:", err);
    } finally {
      setExporting(null);
    }
  }, [demo]);

  const handleShareLink = useCallback(() => {
    const link = generateShareableLink(demo);
    setShareLink(link);
    navigator.clipboard.writeText(link).catch(() => {});
    setDone("link");
  }, [demo]);

  const formats = [
    {
      id: "html",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
      ),
      title: "Embeddable HTML",
      body: "Self-contained HTML file. Drop it on any site or share directly.",
      action: handleExportHTML,
      isLoading: exporting === "html",
      isDone: done === "html",
    },
    {
      id: "gif",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A2.25 2.25 0 0023.25 18V6A2.25 2.25 0 0021 3.75H3A2.25 2.25 0 00.75 6v12A2.25 2.25 0 003 20.25z" />
        </svg>
      ),
      title: "Animated GIF",
      body: "Loop-friendly GIF for embedding in emails, docs, or social posts.",
      action: handleExportGIF,
      isLoading: exporting === "gif",
      isDone: done === "gif",
    },
    {
      id: "json",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
      title: "JSON Export",
      body: "Machine-readable backup. Re-import into Spotlight or other tools.",
      action: handleExportJSON,
      isLoading: false,
      isDone: done === "json",
    },
    {
      id: "link",
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      ),
      title: "Shareable Link",
      body: "Generate a URL that encodes the entire demo. No server needed.",
      action: handleShareLink,
      isLoading: false,
      isDone: done === "link",
    },
  ];

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-xl mx-auto pt-8 pb-16 px-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          Export your demo
        </h2>
        <p className="text-sm text-zinc-400">
          Choose a format to share{" "}
          <span className="text-zinc-300 font-medium">{demo.title}</span> with
          the world.
        </p>
      </div>

      <div className="w-full space-y-3">
        {formats.map((f) => (
          <button
            key={f.id}
            disabled={f.isLoading || exporting !== null}
            onClick={f.action}
            className={cn(
              "w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              f.isDone
                ? "border-violet-500/50 bg-violet-500/10"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/80"
            )}
          >
            <div
              className={cn(
                "mt-0.5 shrink-0 rounded-lg w-9 h-9 flex items-center justify-center transition-colors",
                f.isDone ? "bg-violet-600/20 text-violet-300" : "bg-zinc-800 text-zinc-400"
              )}
            >
              {f.isLoading ? (
                <svg className="w-4 h-4 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : f.isDone ? (
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              ) : (
                f.icon
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200">{f.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{f.body}</p>
              {f.id === "link" && done === "link" && shareLink && (
                <p className="mt-2 text-[11px] font-mono text-violet-400 truncate bg-violet-500/10 rounded px-2 py-1">
                  {shareLink}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onBack}
        className="border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
      >
        Back to editing
      </Button>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [demo, setDemo] = useState<Demo>(createDefaultDemo);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [analyzeStep, setAnalyzeStep] = useState<string>(ANALYZE_STEPS[0]);
  const [sensitivity, setSensitivity] = useState<Sensitivity>("medium");

  const phaseIndex = PHASES.indexOf(phase);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStartBlank = useCallback(() => {
    setDemo(createDefaultDemo());
    setPhase("edit-steps");
  }, []);

  const handleUploadVideo = useCallback(
    async (file: File) => {
      setPhase("analyze");
      setAnalyzeProgress(0);

      try {
        // Create a video element for analysis
        const objectUrl = URL.createObjectURL(file);
        const vid = document.createElement("video");
        vid.src = objectUrl;
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = "auto";
        await new Promise<void>((res, rej) => {
          vid.onloadedmetadata = () => res();
          vid.onerror = () => rej(new Error("Failed to load video"));
        });

        // Run actual video analysis with progress reporting
        const preset = SENSITIVITY_PRESETS[sensitivity];
        const analyzer = new VideoAnalyzer({
          analysisFPS: preset.analysisFPS,
          sceneCutThreshold: preset.sceneCutThreshold,
          thumbnailScale: preset.thumbnailScale,
          minSceneDuration: preset.minSceneDuration,
        });

        const phaseMap: Record<string, string> = {
          "extracting": ANALYZE_STEPS[0],
          "analyzing-scenes": ANALYZE_STEPS[1],
          "detecting-cursor": ANALYZE_STEPS[2],
          "detecting-clicks": ANALYZE_STEPS[2],
          "finalizing": ANALYZE_STEPS[3],
        };

        const analysis = await analyzer.analyze(vid, (progressInfo) => {
          const label = phaseMap[progressInfo.phase] ?? progressInfo.message;
          setAnalyzeStep(label);

          // Map per-phase progress to overall progress
          const phaseWeights: Record<string, [number, number]> = {
            "extracting": [0, 0.5],
            "analyzing-scenes": [0.5, 0.65],
            "detecting-cursor": [0.65, 0.8],
            "detecting-clicks": [0.8, 0.9],
            "finalizing": [0.9, 1.0],
          };
          const [start, end] = phaseWeights[progressInfo.phase] ?? [0.9, 1.0];
          setAnalyzeProgress(start + (end - start) * progressInfo.progress);
        });

        setAnalyzeProgress(1);
        setAnalyzeStep(ANALYZE_STEPS[ANALYZE_STEPS.length - 1]);

        // Build multi-step demo from analysis results
        const newDemo = await DemoEngine.fromAnalysis(analysis, vid);
        newDemo.title = file.name.replace(/\.[^.]+$/, "");

        URL.revokeObjectURL(objectUrl);

        setDemo(newDemo);
        setPhase("edit-steps");
      } catch (err) {
        console.error("Video analysis failed:", err);
        setPhase("upload");
      }
    },
    [sensitivity]
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="shrink-0 h-12 bg-zinc-900 border-b border-zinc-800 flex items-center gap-3 px-4">
        {/* Back */}
        <Link href="/">
          <button
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-zinc-500",
              "hover:text-zinc-200 hover:bg-white/[0.05] transition-all text-xs"
            )}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>
        </Link>

        <div className="w-px h-4 bg-zinc-800 mx-0.5" />

        {/* Title — editable when in edit-steps */}
        {phase === "edit-steps" || phase === "preview" || phase === "export" ? (
          <input
            type="text"
            value={demo.title}
            onChange={(e) => setDemo((d) => ({ ...d, title: e.target.value }))}
            className="text-sm font-semibold text-zinc-100 bg-transparent border-none outline-none min-w-0 w-40 truncate placeholder:text-zinc-600"
            placeholder="Untitled Demo"
            aria-label="Demo title"
          />
        ) : (
          <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">
            Demo Builder
          </h1>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Phase indicator dots */}
        <nav className="flex items-center gap-1.5" aria-label="Progress">
          {PHASES.map((p, i) => (
            <div
              key={p}
              title={p.replace(/-/g, " ")}
              className={cn(
                "rounded-full transition-all duration-300",
                i === phaseIndex
                  ? "w-5 h-2 bg-violet-500"
                  : i < phaseIndex
                  ? "w-2 h-2 bg-violet-500/40"
                  : "w-2 h-2 bg-zinc-700"
              )}
            />
          ))}
        </nav>

        {/* Conditional action buttons */}
        {phase === "edit-steps" && demo.steps.length > 0 && (
          <>
            <div className="w-px h-4 bg-zinc-800 mx-0.5" />
            <Button
              variant="primary"
              size="sm"
              onClick={() => setPhase("preview")}
            >
              Preview
            </Button>
          </>
        )}

        {phase === "preview" && (
          <>
            <div className="w-px h-4 bg-zinc-800 mx-0.5" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPhase("edit-steps")}
              className="border-zinc-700 text-zinc-400 hover:text-zinc-200"
            >
              Edit
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setPhase("export")}
            >
              Export
            </Button>
          </>
        )}

        {phase === "export" && (
          <>
            <div className="w-px h-4 bg-zinc-800 mx-0.5" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPhase("preview")}
              className="border-zinc-700 text-zinc-400 hover:text-zinc-200"
            >
              Preview
            </Button>
          </>
        )}
      </header>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
        {phase === "upload" && (
          <div className="flex-1 overflow-y-auto">
            <UploadPhase
              onUploadVideo={handleUploadVideo}
              onStartBlank={handleStartBlank}
              sensitivity={sensitivity}
              onSensitivityChange={setSensitivity}
            />
          </div>
        )}

        {phase === "analyze" && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <AnalyzePhase progress={analyzeProgress} stepLabel={analyzeStep} />
          </div>
        )}

        {phase === "edit-steps" && (
          <EditStepsPhase demo={demo} onDemoChange={setDemo} />
        )}

        {phase === "preview" && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <PreviewPhase demo={demo} />
          </div>
        )}

        {phase === "export" && (
          <div className="flex-1 overflow-y-auto">
            <ExportPhase demo={demo} onBack={() => setPhase("edit-steps")} />
          </div>
        )}
      </main>
    </div>
  );
}
