"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Demo, DemoStep, Chapter } from "@/engine/demo-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepListProps {
  demo: Demo;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  onReorderSteps: (fromIndex: number, toIndex: number) => void;
  onAddStep: () => void;
  onDeleteStep: (stepId: string) => void;
  onDuplicateStep: (stepId: string) => void;
}

// ─── Step thumbnail ───────────────────────────────────────────────────────────

function StepThumbnail({ step }: { step: DemoStep }) {
  if (step.screenshotDataUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={step.screenshotDataUrl}
        alt={step.title ?? "Step"}
        className="w-full h-full object-cover"
        draggable={false}
      />
    );
  }
  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-800">
      <svg
        className="w-5 h-5 text-zinc-600"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A2.25 2.25 0 0023.25 18V6A2.25 2.25 0 0021 3.75H3A2.25 2.25 0 00.75 6v12A2.25 2.25 0 003 20.25z"
        />
      </svg>
    </div>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

interface StepCardProps {
  step: DemoStep;
  index: number;
  isSelected: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  hasBranchTargets: boolean;
}

function StepCard({
  step,
  index,
  isSelected,
  isDragOver,
  onSelect,
  onDelete,
  onDuplicate,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  hasBranchTargets,
}: StepCardProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={cn(
        "relative flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer",
        "border transition-all duration-150",
        isSelected
          ? "border-violet-500/70 bg-violet-500/10"
          : "border-transparent hover:border-zinc-700 hover:bg-zinc-800/60",
        isDragOver && "border-violet-400 bg-violet-500/15 scale-[1.01]"
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      aria-selected={isSelected}
    >
      {/* Drop indicator line */}
      {isDragOver && (
        <div className="absolute -top-px left-2 right-2 h-0.5 rounded-full bg-violet-500" />
      )}

      {/* Drag handle */}
      <div className="shrink-0 cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-400 transition-colors">
        <svg
          className="w-3 h-3"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="9" cy="6" r="2" />
          <circle cx="15" cy="6" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="9" cy="18" r="2" />
          <circle cx="15" cy="18" r="2" />
        </svg>
      </div>

      {/* Thumbnail */}
      <div className="relative shrink-0 w-16 h-10 rounded-md overflow-hidden border border-zinc-700/60 bg-zinc-800">
        <StepThumbnail step={step} />
        {/* Step number badge */}
        <div className="absolute bottom-0.5 left-0.5 text-[9px] font-semibold leading-none bg-black/70 text-zinc-300 rounded px-1 py-0.5">
          {index + 1}
        </div>
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-200 truncate leading-tight">
          {step.title ?? `Step ${index + 1}`}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {step.hotspots.length > 0 && (
            <span className="text-[10px] text-zinc-500">
              {step.hotspots.length}hs
            </span>
          )}
          {step.callouts.length > 0 && (
            <span className="text-[10px] text-zinc-500">
              {step.callouts.length}co
            </span>
          )}
          {hasBranchTargets && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] text-violet-400"
              title="Has branch targets"
            >
              <svg
                className="w-2.5 h-2.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
              </svg>
            </span>
          )}
        </div>
      </div>

      {/* Hover action buttons */}
      {showActions && (
        <div
          className="shrink-0 flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            title="Duplicate step"
            onClick={onDuplicate}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/60 transition-colors"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
          <button
            title="Delete step"
            onClick={onDelete}
            className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Chapter header ───────────────────────────────────────────────────────────

function ChapterHeader({
  chapter,
  isCollapsed,
  onToggle,
}: {
  chapter: Chapter;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-zinc-800/40 rounded-lg transition-colors"
    >
      <svg
        className={cn(
          "w-3 h-3 text-zinc-500 transition-transform duration-200",
          !isCollapsed && "rotate-90"
        )}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest truncate">
        {chapter.title}
      </span>
      <span className="ml-auto text-[10px] text-zinc-600">
        {chapter.stepIds.length}
      </span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StepList({
  demo,
  selectedStepId,
  onSelectStep,
  onReorderSteps,
  onAddStep,
  onDeleteStep,
  onDuplicateStep,
}: StepListProps) {
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(
    new Set()
  );
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragSourceIndex = useRef<number | null>(null);

  const toggleChapter = useCallback((chapterId: string) => {
    setCollapsedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      dragSourceIndex.current = index;
      e.dataTransfer.setData("text/plain", String(index));
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverIndex(index);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      const fromIndex = dragSourceIndex.current;
      if (fromIndex !== null && fromIndex !== toIndex) {
        onReorderSteps(fromIndex, toIndex);
      }
      dragSourceIndex.current = null;
      setDragOverIndex(null);
    },
    [onReorderSteps]
  );

  const handleDragEnd = useCallback(() => {
    dragSourceIndex.current = null;
    setDragOverIndex(null);
  }, []);

  // Steps that have at least one hotspot with a branch target
  const stepsWithBranches = new Set(
    demo.steps
      .filter((s) => s.hotspots.some((h) => h.branchTo !== undefined))
      .map((s) => s.id)
  );

  const hasChapters = demo.chapters.length > 0;

  const renderStep = (step: DemoStep) => {
    const globalIndex = demo.steps.findIndex((s) => s.id === step.id);
    return (
      <StepCard
        key={step.id}
        step={step}
        index={globalIndex}
        isSelected={selectedStepId === step.id}
        isDragOver={dragOverIndex === globalIndex}
        onSelect={() => onSelectStep(step.id)}
        onDelete={() => onDeleteStep(step.id)}
        onDuplicate={() => onDuplicateStep(step.id)}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        hasBranchTargets={stepsWithBranches.has(step.id)}
      />
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-zinc-900/60 border-r border-zinc-800">
      {/* Header */}
      <div className="shrink-0 px-3 py-2.5 border-b border-zinc-800/80 flex items-center justify-between">
        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
          Steps
        </p>
        <span className="text-[11px] text-zinc-600">{demo.steps.length}</span>
      </div>

      {/* Scrollable step list */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-0.5">
        {!hasChapters
          ? // Flat list
            demo.steps.map((step) => renderStep(step))
          : // Grouped by chapters
            demo.chapters.map((chapter) => {
              const chapterSteps = chapter.stepIds
                .map((id) => demo.steps.find((s) => s.id === id))
                .filter((s): s is DemoStep => Boolean(s));

              const isCollapsed = collapsedChapters.has(chapter.id);

              return (
                <div key={chapter.id} className="mb-1">
                  <ChapterHeader
                    chapter={chapter}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleChapter(chapter.id)}
                  />
                  {!isCollapsed && (
                    <div className="ml-2 space-y-0.5 mt-0.5">
                      {chapterSteps.map((step) => renderStep(step))}
                    </div>
                  )}
                </div>
              );
            })}

        {/* Uncategorised steps when chapters exist */}
        {hasChapters &&
          (() => {
            const categorisedIds = new Set(
              demo.chapters.flatMap((c) => c.stepIds)
            );
            const uncategorised = demo.steps.filter(
              (s) => !categorisedIds.has(s.id)
            );
            if (uncategorised.length === 0) return null;
            return (
              <div className="mt-1">
                <p className="px-2 py-1 text-[10px] font-medium text-zinc-600 uppercase tracking-widest">
                  Uncategorised
                </p>
                <div className="space-y-0.5">
                  {uncategorised.map((step) => renderStep(step))}
                </div>
              </div>
            );
          })()}
      </div>

      {/* Add step button */}
      <div className="shrink-0 p-2 border-t border-zinc-800/80">
        <Button
          variant="outline"
          size="sm"
          onClick={onAddStep}
          className="w-full justify-center gap-1.5 text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:border-zinc-600"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Step
        </Button>
      </div>
    </div>
  );
}
