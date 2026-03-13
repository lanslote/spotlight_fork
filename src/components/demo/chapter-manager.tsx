"use client";

/**
 * ChapterManager — sidebar panel for organising demo steps into chapters and
 * visualising the branching flow between steps.
 *
 * Features:
 *   - Inline chapter title editing
 *   - Add / delete chapters
 *   - Reorder chapters via drag-and-drop (pointer events, no external library)
 *   - Step cards within each chapter; click to select
 *   - SVG branch-arrow overlay connecting steps that have hotspot branchTargetIds
 *   - Current-step highlight
 */

import {
  useCallback,
  useRef,
  useState,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { makeId } from "@/engine/scene";
import type { Demo, DemoStep, Chapter } from "@/engine/demo-engine";

interface ChapterManagerProps {
  demo: Demo;
  onUpdateDemo: (demo: Demo) => void;
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Gather all [fromStepIndex, toStepIndex] branch pairs across the demo. */
function gatherBranches(
  steps: DemoStep[]
): Array<{ fromId: string; toId: string; label: string }> {
  const branches: Array<{ fromId: string; toId: string; label: string }> = [];
  const idSet = new Set(steps.map((s) => s.id));
  for (const step of steps) {
    for (const hotspot of step.hotspots) {
      const target = hotspot.branchTo;
      if (target && idSet.has(target)) {
        branches.push({
          fromId: step.id,
          toId: target,
          label: hotspot.tooltip || hotspot.id,
        });
      }
    }
  }
  return branches;
}

const CHAPTER_COLORS = [
  "#8b5cf6", // violet-500
  "#6366f1", // indigo-500
  "#06b6d4", // cyan-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
];

function chapterColor(index: number): string {
  return CHAPTER_COLORS[index % CHAPTER_COLORS.length];
}

// ─── Chapter title editor ─────────────────────────────────────────────────────

function ChapterTitle({
  chapter,
  color,
  onRename,
}: {
  chapter: Chapter;
  color: string;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(chapter.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== chapter.title) onRename(trimmed);
    else setDraft(chapter.title);
  }, [draft, chapter.title, onRename]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") { setEditing(false); setDraft(chapter.title); }
    },
    [commit, chapter.title]
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-full bg-zinc-800 border border-violet-500 rounded px-2 py-0.5 text-sm text-zinc-100 outline-none"
      />
    );
  }

  return (
    <span
      className="text-sm font-semibold text-zinc-200 cursor-pointer hover:text-white truncate flex-1"
      style={{ borderLeft: `3px solid ${color}`, paddingLeft: 6 }}
      onClick={() => { setEditing(true); setDraft(chapter.title); }}
      title="Click to rename"
    >
      {chapter.title}
    </span>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  isSelected,
  isCurrent,
  color,
  onSelect,
}: {
  step: DemoStep;
  isSelected: boolean;
  isCurrent: boolean;
  color: string;
  onSelect: () => void;
}) {
  const hasBranch = step.hotspots.some((h) => h.branchTo);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer",
        "text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60",
        "transition-colors duration-100 select-none",
        isSelected && "bg-zinc-800 text-zinc-100",
        isCurrent && "text-violet-300"
      )}
      onClick={onSelect}
    >
      {/* Color dot */}
      <span
        className="shrink-0 w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: isCurrent ? "#a78bfa" : color }}
      />
      {/* Step title */}
      <span className="truncate flex-1">{step.title ?? step.id}</span>
      {/* Branch indicator */}
      {hasBranch && (
        <span className="shrink-0 text-[10px] text-violet-400 font-mono">⇢</span>
      )}
    </div>
  );
}

// ─── Branch SVG ───────────────────────────────────────────────────────────────

interface NodeLayout {
  stepId: string;
  y: number; // centre y in the SVG
}

function BranchArrows({
  branches,
  nodeLayouts,
  svgWidth,
}: {
  branches: Array<{ fromId: string; toId: string; label: string }>;
  nodeLayouts: NodeLayout[];
  svgWidth: number;
}) {
  const layoutMap = new Map(nodeLayouts.map((n) => [n.stepId, n.y]));

  return (
    <svg
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ width: svgWidth, height: "100%" }}
    >
      <defs>
        <marker
          id="branch-arrow"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="#8b5cf6" opacity="0.8" />
        </marker>
      </defs>
      {branches.map((b, i) => {
        const fromY = layoutMap.get(b.fromId);
        const toY = layoutMap.get(b.toId);
        if (fromY == null || toY == null) return null;

        const x1 = svgWidth - 8;
        const x2 = svgWidth - 8;
        const midX = x1 + 16;
        const path = `M${x1},${fromY} C${midX},${fromY} ${midX},${toY} ${x2},${toY}`;

        return (
          <g key={i}>
            <path
              d={path}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="1.5"
              strokeOpacity="0.7"
              markerEnd="url(#branch-arrow)"
            />
            {/* Mid-path label */}
            <text
              x={midX + 2}
              y={(fromY + toY) / 2}
              fill="#a78bfa"
              fontSize="9"
              dominantBaseline="middle"
              opacity="0.8"
            >
              {b.label.slice(0, 12)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChapterManager({
  demo,
  onUpdateDemo,
  selectedStepId = null,
  onSelectStep,
}: ChapterManagerProps) {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    () => new Set(demo.chapters.map((c) => c.id))
  );

  // ── Chapter mutations ─────────────────────────────────────────────────────

  const renameChapter = useCallback(
    (chapterId: string, title: string) => {
      onUpdateDemo({
        ...demo,
        updatedAt: Date.now(),
        chapters: demo.chapters.map((c) =>
          c.id === chapterId ? { ...c, title } : c
        ),
      });
    },
    [demo, onUpdateDemo]
  );

  const addChapter = useCallback(() => {
    const id = makeId("ch");
    const newChapter: Chapter = { id, title: `Chapter ${demo.chapters.length + 1}`, stepIds: [] };
    const updated: Demo = {
      ...demo,
      updatedAt: Date.now(),
      chapters: [...demo.chapters, newChapter],
    };
    onUpdateDemo(updated);
    setExpandedChapters((prev) => { const s = new Set(Array.from(prev)); s.add(id); return s; });
  }, [demo, onUpdateDemo]);

  const deleteChapter = useCallback(
    (chapterId: string) => {
      // Remove chapter; steps become orphans (no chapterId)
      onUpdateDemo({
        ...demo,
        updatedAt: Date.now(),
        chapters: demo.chapters.filter((c) => c.id !== chapterId),
        steps: demo.steps.map((s) =>
          s.chapter === chapterId ? { ...s, chapter: undefined } : s
        ),
      });
    },
    [demo, onUpdateDemo]
  );

  const toggleExpand = useCallback((chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }, []);

  // ── Drag-to-reorder chapters ───────────────────────────────────────────────

  const dragChapterRef = useRef<{ id: string; startIndex: number } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleChapterDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, chapterId: string, index: number) => {
      dragChapterRef.current = { id: chapterId, startIndex: index };
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleChapterDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault();
      setDragOverIndex(index);
    },
    []
  );

  const handleChapterDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
      e.preventDefault();
      setDragOverIndex(null);
      const drag = dragChapterRef.current;
      if (!drag || drag.startIndex === targetIndex) return;
      const chapters = [...demo.chapters];
      const [moved] = chapters.splice(drag.startIndex, 1);
      chapters.splice(targetIndex, 0, moved);
      onUpdateDemo({ ...demo, updatedAt: Date.now(), chapters });
    },
    [demo, onUpdateDemo]
  );

  // ── Build step index per chapter ───────────────────────────────────────────

  const stepsByChapter = demo.chapters.reduce<Record<string, DemoStep[]>>(
    (acc, chapter) => {
      acc[chapter.id] = chapter.stepIds
        .map((sid) => demo.steps.find((s) => s.id === sid))
        .filter((s): s is DemoStep => s != null);
      return acc;
    },
    {}
  );

  const orphanSteps = demo.steps.filter((s) => !s.chapter);

  // ── Branch arrows layout ───────────────────────────────────────────────────

  // Assign a y-position to each step card for branch SVG arrows.
  // We count items top-to-bottom: chapter header ≈ 36px, step card ≈ 32px.
  const CHAPTER_HEADER_H = 36;
  const STEP_CARD_H = 32;
  const nodeLayouts: NodeLayout[] = [];
  let runningY = 0;

  for (const chapter of demo.chapters) {
    runningY += CHAPTER_HEADER_H;
    if (expandedChapters.has(chapter.id)) {
      for (const step of stepsByChapter[chapter.id] ?? []) {
        nodeLayouts.push({ stepId: step.id, y: runningY + STEP_CARD_H / 2 });
        runningY += STEP_CARD_H;
      }
    }
  }
  // Orphan steps
  for (const step of orphanSteps) {
    nodeLayouts.push({ stepId: step.id, y: runningY + STEP_CARD_H / 2 });
    runningY += STEP_CARD_H;
  }

  const allSteps = demo.steps;
  const branches = gatherBranches(allSteps);

  return (
    <div className="relative flex flex-col h-full select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          Chapters
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-violet-400 hover:text-violet-300"
          onClick={addChapter}
        >
          + Add
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="relative flex-1 overflow-y-auto overflow-x-hidden">
        {/* Branch arrow SVG overlay */}
        <BranchArrows
          branches={branches}
          nodeLayouts={nodeLayouts}
          svgWidth={16}
        />

        {/* Chapter list */}
        <div className="py-1">
          {demo.chapters.map((chapter, idx) => {
            const color = chapterColor(idx);
            const expanded = expandedChapters.has(chapter.id);
            const chapterSteps = stepsByChapter[chapter.id] ?? [];

            return (
              <div
                key={chapter.id}
                draggable
                onDragStart={(e) => handleChapterDragStart(e, chapter.id, idx)}
                onDragOver={(e) => handleChapterDragOver(e, idx)}
                onDrop={(e) => handleChapterDrop(e, idx)}
                onDragLeave={() => setDragOverIndex(null)}
                className={cn(
                  "mx-2 mb-1 rounded-lg border transition-colors duration-100",
                  dragOverIndex === idx
                    ? "border-violet-500 bg-violet-500/5"
                    : "border-zinc-800 bg-zinc-900/40"
                )}
              >
                {/* Chapter header */}
                <div className="flex items-center gap-1 px-2 py-1.5">
                  {/* Expand toggle */}
                  <button
                    className="shrink-0 w-4 h-4 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
                    onClick={() => toggleExpand(chapter.id)}
                    aria-label={expanded ? "Collapse" : "Expand"}
                  >
                    <span className={cn("text-[10px] transition-transform", expanded ? "rotate-90" : "")}>
                      ▶
                    </span>
                  </button>

                  {/* Editable title */}
                  <ChapterTitle
                    chapter={chapter}
                    color={color}
                    onRename={(title) => renameChapter(chapter.id, title)}
                  />

                  {/* Step count badge */}
                  <span className="shrink-0 text-[10px] text-zinc-500">
                    {chapterSteps.length}
                  </span>

                  {/* Delete chapter */}
                  <button
                    className="shrink-0 w-4 h-4 rounded flex items-center justify-center text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-0.5"
                    onClick={() => deleteChapter(chapter.id)}
                    aria-label="Delete chapter"
                  >
                    ×
                  </button>
                </div>

                {/* Steps within chapter */}
                {expanded && chapterSteps.length > 0 && (
                  <div className="px-2 pb-1.5 flex flex-col gap-0.5">
                    {chapterSteps.map((step) => (
                      <StepCard
                        key={step.id}
                        step={step}
                        isSelected={selectedStepId === step.id}
                        isCurrent={false}
                        color={color}
                        onSelect={() => onSelectStep?.(step.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Empty chapter hint */}
                {expanded && chapterSteps.length === 0 && (
                  <p className="px-4 pb-2 text-[11px] text-zinc-600 italic">
                    No steps assigned
                  </p>
                )}
              </div>
            );
          })}

          {/* Orphaned steps (not in any chapter) */}
          {orphanSteps.length > 0 && (
            <div className="mx-2 mt-1">
              <p className="px-2 py-1 text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">
                Unassigned
              </p>
              <div className="flex flex-col gap-0.5">
                {orphanSteps.map((step) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    isSelected={selectedStepId === step.id}
                    isCurrent={false}
                    color="#52525b"
                    onSelect={() => onSelectStep?.(step.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {demo.chapters.length === 0 && orphanSteps.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center px-4">
              <p className="text-xs text-zinc-500">No chapters yet.</p>
              <Button variant="outline" size="sm" onClick={addChapter}>
                + Add first chapter
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Footer: total steps summary */}
      <div className="shrink-0 px-3 py-1.5 border-t border-zinc-800 flex items-center justify-between">
        <span className="text-[11px] text-zinc-600">
          {demo.steps.length} step{demo.steps.length !== 1 ? "s" : ""}
        </span>
        <span className="text-[11px] text-zinc-600">
          {demo.chapters.length} chapter{demo.chapters.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
