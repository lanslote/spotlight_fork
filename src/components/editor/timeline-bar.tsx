"use client";

import { cn } from "@/lib/utils";
import { GripVertical, Play } from "lucide-react";

export interface TimelineScene {
  id: string;
  name: string;
  duration: number;
  gradient: [string, string];
}

interface TimelineBarProps {
  scenes: TimelineScene[];
  activeSceneId?: string;
  currentTime?: number;
  totalDuration?: number;
  onSceneClick?: (sceneId: string) => void;
  className?: string;
}

export function TimelineBar({
  scenes,
  activeSceneId,
  currentTime = 0,
  totalDuration = 10,
  onSceneClick,
  className,
}: TimelineBarProps) {
  // Compute scene start times
  const scenesWithStart = scenes.reduce<
    (TimelineScene & { startTime: number })[]
  >((acc, scene, idx) => {
    const prev = acc[idx - 1];
    const startTime = prev ? prev.startTime + prev.duration : 0;
    acc.push({ ...scene, startTime });
    return acc;
  }, []);

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-surface-1 border-l border-white/[0.05]",
        className
      )}
    >
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">Timeline</h2>
        <span className="text-xs font-mono text-zinc-500">
          {scenesWithStart.length} scenes
        </span>
      </div>

      {/* Scene list */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1.5">
        {scenesWithStart.map((scene, idx) => {
          const isActive = scene.id === activeSceneId;
          const sceneProgress =
            isActive && currentTime >= scene.startTime
              ? Math.min(
                  (currentTime - scene.startTime) / scene.duration,
                  1
                )
              : 0;
          const isPast = currentTime > scene.startTime + scene.duration;

          return (
            <div
              key={scene.id}
              onClick={() => onSceneClick?.(scene.id)}
              className={cn(
                "group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200",
                "border",
                isActive
                  ? "border-accent-500/40 shadow-[0_0_16px_rgba(139,92,246,0.15)]"
                  : "border-white/[0.05] hover:border-white/[0.1]",
                "bg-surface-2"
              )}
            >
              {/* Gradient mini preview */}
              <div
                className="h-16 w-full relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${scene.gradient[0]} 0%, ${scene.gradient[1]} 100%)`,
                }}
              >
                {/* Progress fill overlay */}
                {(isActive || isPast) && (
                  <div
                    className="absolute inset-0 bg-white/10 origin-left transition-none"
                    style={{
                      transform: `scaleX(${isPast ? 1 : sceneProgress})`,
                      transformOrigin: "left",
                    }}
                  />
                )}
                {/* Noise */}
                <div className="absolute inset-0 bg-black/20 mix-blend-multiply" />

                {/* Scene number badge */}
                <div className="absolute top-2 left-2">
                  <span className="w-5 h-5 rounded-md bg-black/30 backdrop-blur-sm flex items-center justify-center text-[10px] font-semibold text-white/70">
                    {idx + 1}
                  </span>
                </div>

                {/* Active play indicator */}
                {isActive && (
                  <div className="absolute top-2 right-2">
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/30 backdrop-blur-sm text-[10px] text-white">
                      <Play className="w-2 h-2 fill-current" />
                      Live
                    </span>
                  </div>
                )}

                {/* Drag handle */}
                <button
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-white/40 hover:text-white/80"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Drag to reorder"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Scene info */}
              <div className="px-3 py-2 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "text-xs font-medium truncate",
                    isActive ? "text-zinc-100" : "text-zinc-400 group-hover:text-zinc-200"
                  )}
                >
                  {scene.name}
                </span>
                <span className="text-[10px] font-mono text-zinc-600 shrink-0">
                  {scene.duration.toFixed(1)}s
                </span>
              </div>

              {/* Active progress bar */}
              {isActive && (
                <div className="absolute bottom-0 inset-x-0 h-[2px] bg-surface-3">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-none"
                    style={{ width: `${sceneProgress * 100}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Add scene hint */}
        <div className="flex items-center gap-2 px-2 py-3 opacity-40">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[10px] text-zinc-600">drag to reorder</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>
      </div>

      {/* Total duration */}
      <div className="shrink-0 px-4 py-3 border-t border-white/[0.05]">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Total</span>
          <span className="font-mono">
            {scenesWithStart
              .reduce((t, s) => t + s.duration, 0)
              .toFixed(1)}
            s
          </span>
        </div>
        {/* Mini total timeline bar */}
        <div className="mt-2 h-1 bg-surface-3 rounded-full overflow-hidden">
          {scenesWithStart.map((scene, i) => (
            <div
              key={scene.id}
              className="inline-block h-full transition-none"
              style={{
                width: `${(scene.duration / totalDuration) * 100}%`,
                background: `linear-gradient(90deg, ${scene.gradient[0]}, ${scene.gradient[1]})`,
                borderRight: i < scenesWithStart.length - 1 ? "1px solid rgba(0,0,0,0.4)" : undefined,
              }}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
