"use client";

/**
 * @module DemoPlayer
 *
 * Interactive demo player — canvas + DOM hybrid.
 *
 * Architecture:
 *   <canvas>  — renders the step screenshot, crossfade transitions, and blur
 *               regions via CanvasRenderingContext2D pixel manipulation.
 *   DOM layer — absolutely-positioned hotspot and callout overlays driven by
 *               React state so they can carry CSS animations and pointer events.
 *
 * The DemoEngine drives all state transitions; the component only subscribes to
 * engine events and translates them into React state updates.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { cn } from "@/lib/utils";
import {
  DemoEngine,
  type Demo,
  type DemoStep,
  type Hotspot,
  type Callout,
  type PlaybackState,
} from "@/engine/demo-engine";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DemoPlayerProps {
  demo: Demo;
  className?: string;
  /** Start playing immediately on mount. */
  autoplay?: boolean;
  /** Jump to a specific step id on mount. */
  startStep?: string;
  /** Called once the final step has been shown. */
  onComplete?: () => void;
  /** Called whenever the active step changes. */
  onStepChange?: (stepId: string) => void;
  /** Render simplified chrome (no sidebar, minimal controls) for iframes. */
  embedded?: boolean;
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M6.3 4.25a.75.75 0 0 0-1.05.68v10.14a.75.75 0 0 0 1.05.68l9-5.07a.75.75 0 0 0 0-1.36l-9-5.07Z" />
    </svg>
  );
}

function IconPause({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.75 4a.75.75 0 0 0-.75.75v10.5a.75.75 0 0 0 1.5 0V4.75A.75.75 0 0 0 5.75 4Zm8.5 0a.75.75 0 0 0-.75.75v10.5a.75.75 0 0 0 1.5 0V4.75A.75.75 0 0 0 14.25 4Z"
      />
    </svg>
  );
}

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12.5 5l-5 5 5 5" />
    </svg>
  );
}

function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7.5 5l5 5-5 5" />
    </svg>
  );
}

function IconFullscreen({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
    </svg>
  );
}

function IconExitFullscreen({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 3v4H3M13 3v4h4M17 13h-4v4M7 17v-4H3" />
    </svg>
  );
}

function IconMenu({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 5h14M3 10h14M3 15h14" />
    </svg>
  );
}

// ─── Canvas rendering helpers ─────────────────────────────────────────────────

/**
 * Load an image from a data URL and resolve once decoded.
 * Uses a module-level cache so repeated loads of the same screenshot
 * don't incur extra allocations.
 */
const imageCache = new Map<string, HTMLImageElement>();

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(dataUrl);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(dataUrl, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Draw one step screenshot onto a canvas and apply blur regions.
 *
 * Blur is implemented via a two-pass approach: the source image is drawn at
 * full resolution, then each BlurRegion is re-drawn with a CSS filter applied
 * to an offscreen canvas that is composited back into the main canvas.
 */
async function renderStepToCanvas(
  canvas: HTMLCanvasElement,
  step: DemoStep,
  alpha = 1
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx || !step.screenshotDataUrl) return;

  const img = await loadImage(step.screenshotDataUrl);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Apply blur regions using an offscreen canvas with CSS filter.
  if (step.blurRegions && step.blurRegions.length > 0) {
    const offscreen = document.createElement("canvas");
    offscreen.width  = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext("2d")!;

    offCtx.filter = "blur(12px)";
    offCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
    offCtx.filter = "none";

    for (const region of step.blurRegions) {
      const { x, y, width, height } = region.bounds;
      const px = x * canvas.width;
      const py = y * canvas.height;
      const pw = width * canvas.width;
      const ph = height * canvas.height;

      ctx.drawImage(offscreen, px, py, pw, ph, px, py, pw, ph);
    }
  }

  ctx.restore();
}

// ─── Hotspot overlay ──────────────────────────────────────────────────────────

interface HotspotOverlayProps {
  hotspot: Hotspot;
  onClick: (hotspot: Hotspot) => void;
}

function HotspotOverlay({ hotspot, onClick }: HotspotOverlayProps) {
  const { bounds, tooltip, style } = hotspot;

  // Bounds are in the demo's logical pixel space; render as fractions of the
  // player container's dimensions (assumed to match demo settings width/height).
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left:   `${bounds.x * 100}%`,
    top:    `${bounds.y * 100}%`,
    width:  `${bounds.width * 100}%`,
    height: `${bounds.height * 100}%`,
    cursor: "pointer",
  };

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onClick(hotspot);
    },
    [hotspot, onClick]
  );

  // Shared accessibility attrs
  const a11y = {
    role: "button" as const,
    tabIndex: 0,
    "aria-label": tooltip ?? `Hotspot ${hotspot.id}`,
    onClick: handleClick,
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick(hotspot);
      }
    },
  };

  if (style === "pulse") {
    return (
      <div style={containerStyle} {...a11y} className="group">
        {/* Outer animated ring */}
        <span
          className="absolute inset-0 rounded-full bg-violet-500/20 animate-ping"
          style={{ animationDuration: "1.4s" }}
        />
        {/* Inner dot */}
        <span className="absolute inset-[30%] rounded-full bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.8)]" />
        {/* Tooltip on hover */}
        {tooltip && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {tooltip}
          </span>
        )}
      </div>
    );
  }

  if (style === "highlight") {
    return (
      <div
        style={{ ...containerStyle, backgroundColor: "rgba(139, 92, 246, 0.25)", borderRadius: 4 }}
        {...a11y}
        className="group"
      >
        {tooltip && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {tooltip}
          </span>
        )}
      </div>
    );
  }

  if (style === "outline") {
    return (
      <div
        style={{
          ...containerStyle,
          border: "2px dashed rgba(139, 92, 246, 0.8)",
          borderRadius: 4,
          backgroundColor: "transparent",
        }}
        {...a11y}
        className="group"
      >
        {tooltip && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {tooltip}
          </span>
        )}
      </div>
    );
  }

  if (style === "arrow") {
    // Center point of the hotspot in percentage coords.
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    return (
      <div
        style={{
          position: "absolute",
          left: `${cx * 100}%`,
          top:  `${cy * 100}%`,
          transform: "translate(-50%, -50%)",
          cursor: "pointer",
        }}
        {...a11y}
        className="group"
      >
        <svg width="32" height="32" viewBox="0 0 32 32" className="drop-shadow-lg">
          <path
            d="M16 4 L28 20 L20 18 L20 28 L12 28 L12 18 L4 20 Z"
            fill="rgba(139,92,246,0.9)"
            stroke="white"
            strokeWidth="1"
          />
        </svg>
        {tooltip && (
          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {tooltip}
          </span>
        )}
      </div>
    );
  }

  // Fallback: render as an invisible click target.
  return <div style={containerStyle} {...a11y} />;
}

// ─── Callout overlay ──────────────────────────────────────────────────────────

interface CalloutOverlayProps {
  callout: Callout;
  /** Interpolated text (variables already replaced). */
  text: string;
}

function CalloutOverlay({ callout, text }: CalloutOverlayProps) {
  const { position, style, number: num } = callout;

  const base: React.CSSProperties = {
    position: "absolute",
    left: `${position.x * 100}%`,
    top:  `${position.y * 100}%`,
    transform: "translate(-50%, -50%)",
    zIndex: 20,
    pointerEvents: "none",
  };

  if (style === "tooltip") {
    return (
      <div style={base}>
        <div className="relative bg-zinc-900 border border-zinc-700 text-zinc-100 text-xs px-3 py-2 rounded-lg shadow-lg max-w-[220px] text-center">
          {text}
          {/* Speech bubble tail pointing downward */}
          <span
            className="absolute left-1/2 -translate-x-1/2 top-full"
            style={{
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid #3f3f46", // zinc-700
            }}
          />
        </div>
      </div>
    );
  }

  if (style === "badge") {
    return (
      <div style={base}>
        <div className="w-7 h-7 rounded-full bg-violet-600 border-2 border-white text-white text-xs font-bold flex items-center justify-center shadow-lg">
          {num ?? "!"}
        </div>
      </div>
    );
  }

  if (style === "numbered") {
    return (
      <div style={{ ...base, transform: "translate(-50%, -50%)" }}>
        <div className="flex items-start gap-2 bg-zinc-900/95 border border-zinc-700 rounded-xl px-3 py-2 shadow-lg max-w-[240px]">
          <div className="shrink-0 w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
            {num ?? "1"}
          </div>
          <span className="text-xs text-zinc-200 leading-relaxed">{text}</span>
        </div>
      </div>
    );
  }

  if (style === "arrow") {
    // Render a label with a triangular pointer on the left side.
    return (
      <div style={base}>
        <div className="flex items-center gap-1">
          <svg width="20" height="14" viewBox="0 0 20 14" className="shrink-0">
            <path d="M0 7 L20 0 L16 7 L20 14 Z" fill="rgba(139,92,246,0.9)" />
          </svg>
          <div className="bg-zinc-900/95 border border-zinc-700 text-zinc-200 text-xs px-2 py-1 rounded-lg shadow-lg max-w-[200px]">
            {text}
          </div>
        </div>
      </div>
    );
  }

  // Default: plain text label.
  return (
    <div style={base}>
      <span className="bg-zinc-900/90 border border-zinc-700 text-zinc-200 text-xs px-2 py-1 rounded-md shadow-lg">
        {text}
      </span>
    </div>
  );
}

// ─── Chapter sidebar ──────────────────────────────────────────────────────────

interface ChapterSidebarProps {
  demo: Demo;
  currentStepId: string;
  onStepClick: (stepId: string) => void;
  onClose: () => void;
}

function ChapterSidebar({ demo, currentStepId, onStepClick, onClose }: ChapterSidebarProps) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-64 bg-zinc-950/95 border-l border-zinc-800 flex flex-col z-30 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <span className="text-sm font-semibold text-zinc-100">{demo.title}</span>
        <button
          onClick={onClose}
          aria-label="Close chapters"
          className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="w-4 h-4" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto py-2">
        {demo.chapters.map((chapter) => {
          const chapterSteps = demo.steps.filter((s) => s.chapter === chapter.id);
          return (
            <div key={chapter.id} className="mb-1">
              <div className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 select-none">
                {chapter.title}
              </div>
              {chapterSteps.map((step, stepIdx) => (
                <button
                  key={step.id}
                  onClick={() => onStepClick(step.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                    step.id === currentStepId
                      ? "bg-violet-500/15 text-violet-300"
                      : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 w-5 h-5 rounded-full text-[10px] font-semibold flex items-center justify-center",
                      step.id === currentStepId
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-800 text-zinc-400"
                    )}
                  >
                    {stepIdx + 1}
                  </span>
                  <span className="truncate text-xs">{step.title ?? `Step ${stepIdx + 1}`}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step progress bar ────────────────────────────────────────────────────────

interface StepProgressBarProps {
  steps: DemoStep[];
  currentStepId: string;
  onStepClick: (stepId: string) => void;
}

function StepProgressBar({ steps, currentStepId, onStepClick }: StepProgressBarProps) {
  const currentIdx = steps.findIndex((s) => s.id === currentStepId);

  return (
    <div className="flex items-center gap-1 px-2">
      {steps.map((step, idx) => (
        <button
          key={step.id}
          onClick={() => onStepClick(step.id)}
          aria-label={`Go to step ${idx + 1}${step.title ? `: ${step.title}` : ""}`}
          title={step.title ?? `Step ${idx + 1}`}
          className={cn(
            "flex-1 h-1 rounded-full transition-all duration-300",
            idx < currentIdx
              ? "bg-violet-500"
              : idx === currentIdx
              ? "bg-violet-400 scale-y-150"
              : "bg-zinc-700 hover:bg-zinc-600"
          )}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DemoPlayer({
  demo,
  className,
  autoplay = false,
  startStep,
  onComplete,
  onStepChange,
  embedded = false,
}: DemoPlayerProps) {
  // ── Refs ──────────────────────────────────────────────────────────────────

  /** The primary (foreground) canvas — always visible. */
  const canvasARef = useRef<HTMLCanvasElement>(null);
  /** The secondary (background) canvas — fades in during crossfade transitions. */
  const canvasBRef = useRef<HTMLCanvasElement>(null);
  /** The outer wrapper for fullscreen requests. */
  const wrapperRef = useRef<HTMLDivElement>(null);
  /** The overlay container (positioned relative to the canvas area). */
  const overlayRef = useRef<HTMLDivElement>(null);
  /** Stable engine reference. */
  const engineRef = useRef<DemoEngine | null>(null);
  /** RAF handle for the crossfade loop. */
  const rafRef = useRef<number>(0);
  /** Whether a crossfade is currently running. */
  const transitioningRef = useRef(false);

  // ── State ─────────────────────────────────────────────────────────────────

  const [currentStep, setCurrentStep] = useState<DemoStep | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ── Engine bootstrap ──────────────────────────────────────────────────────

  useEffect(() => {
    const engine = new DemoEngine(demo);
    engineRef.current = engine;

    // Subscribe to engine events.
    const handleStepChange = (stepId: string) => {
      const step = demo.steps.find((s) => s.id === stepId) ?? null;
      setCurrentStep(step);
      onStepChange?.(stepId);

      if (step) {
        // Start crossfade transition.
        beginTransition(step);
      }
    };

    const handlePlaybackChange = (state: PlaybackState) => {
      setIsPlaying(state === "playing");
    };

    const handleComplete = () => {
      setIsPlaying(false);
      onComplete?.();
    };

    engine.on("step-change", (e) => handleStepChange(e.stepId ?? ""));
    engine.on("state-change", () => handlePlaybackChange(engine.getState()));
    engine.on("completed", handleComplete);

    // Jump to startStep or first step.
    const initialStepId = startStep ?? demo.steps[0]?.id;
    if (initialStepId) {
      engine.goToStep(initialStepId);
    }

    if (autoplay) {
      engine.play();
    }

    return () => {
      // Listeners are cleared by destroy(); no need to off() individually.
      engine.destroy();
      engineRef.current = null;
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  // ── Canvas sizing ─────────────────────────────────────────────────────────

  const [canvasSize, setCanvasSize] = useState({ w: 1280, h: 720 });

  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;

    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setCanvasSize({ w: Math.round(width), h: Math.round(height) });
    });

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Step transition ──────────────────────────────────────────────────────

  /**
   * Transition from the current canvas content to the new step's screenshot.
   * Uses two canvas elements and applies the transition type set on the step:
   *   - "none"        — instant cut
   *   - "fade"        — crossfade (opacity)
   *   - "slide-left"  — new step slides in from the right
   *   - "slide-right" — new step slides in from the left
   *   - "zoom"        — new step scales up from center
   *   - "morph"       — crossfade with a subtle scale
   */
  const beginTransition = useCallback(async (newStep: DemoStep) => {
    const canvasA = canvasARef.current;
    const canvasB = canvasBRef.current;
    if (!canvasA || !canvasB) return;

    // Abort any ongoing transition.
    cancelAnimationFrame(rafRef.current);
    transitioningRef.current = true;
    setIsTransitioning(true);

    const transition = newStep.transition ?? "fade";

    // "none" — instant cut, no animation.
    if (transition === "none") {
      await renderStepToCanvas(canvasA, newStep);
      canvasA.style.opacity = "1";
      canvasA.style.transform = "";
      canvasB.style.opacity = "0";
      canvasB.style.transform = "";
      transitioningRef.current = false;
      setIsTransitioning(false);
      return;
    }

    const duration = transition === "morph" ? 450 : 350; // ms
    const startTime = performance.now();

    // Draw the incoming frame onto canvasB.
    await renderStepToCanvas(canvasB, newStep);

    // Reset transforms before starting.
    canvasB.style.opacity = "0";
    canvasB.style.transform = "";

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic

      switch (transition) {
        case "fade":
          canvasA.style.opacity = String(1 - eased);
          canvasA.style.transform = "";
          canvasB.style.opacity = String(eased);
          canvasB.style.transform = "";
          break;

        case "slide-left":
          canvasA.style.opacity = "1";
          canvasA.style.transform = `translateX(${-eased * 100}%)`;
          canvasB.style.opacity = "1";
          canvasB.style.transform = `translateX(${(1 - eased) * 100}%)`;
          break;

        case "slide-right":
          canvasA.style.opacity = "1";
          canvasA.style.transform = `translateX(${eased * 100}%)`;
          canvasB.style.opacity = "1";
          canvasB.style.transform = `translateX(${-(1 - eased) * 100}%)`;
          break;

        case "zoom":
          canvasA.style.opacity = String(1 - eased);
          canvasA.style.transform = "";
          canvasB.style.opacity = String(eased);
          canvasB.style.transform = `scale(${0.8 + 0.2 * eased})`;
          break;

        case "morph":
          canvasA.style.opacity = String(1 - eased);
          canvasA.style.transform = `scale(${1 + 0.05 * eased})`;
          canvasB.style.opacity = String(eased);
          canvasB.style.transform = `scale(${0.95 + 0.05 * eased})`;
          break;

        default:
          canvasA.style.opacity = String(1 - eased);
          canvasB.style.opacity = String(eased);
          break;
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Swap: render new step onto canvasA, reset transforms, hide canvasB.
        renderStepToCanvas(canvasA, newStep).then(() => {
          canvasA.style.opacity = "1";
          canvasA.style.transform = "";
          canvasB.style.opacity = "0";
          canvasB.style.transform = "";
          transitioningRef.current = false;
          setIsTransitioning(false);
        });
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  // ── Playback controls ─────────────────────────────────────────────────────

  const handlePlayPause = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isPlaying) {
      engine.pause();
    } else {
      engine.play();
    }
  }, [isPlaying]);

  const handlePrev = useCallback(() => {
    engineRef.current?.previousStep();
  }, []);

  const handleNext = useCallback(() => {
    engineRef.current?.nextStep();
  }, []);

  const handleStepClick = useCallback((stepId: string) => {
    engineRef.current?.goToStep(stepId);
    setIsSidebarOpen(false);
  }, []);

  const handleHotspotClick = useCallback((hotspot: Hotspot) => {
    const { bounds } = hotspot;
    // Use the center of the hotspot bounds as the click coordinate.
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    engineRef.current?.handleClick(cx, cy);
  }, []);

  // ── Fullscreen ────────────────────────────────────────────────────────────

  const handleFullscreen = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── Keyboard navigation ───────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      // Only handle keys when this player is focused or in fullscreen.
      const isFocused =
        wrapper.contains(document.activeElement) ||
        document.activeElement === document.body ||
        !!document.fullscreenElement;
      if (!isFocused) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          handlePlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handlePrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          handleNext();
          break;
        case "Escape":
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handlePlayPause, handlePrev, handleNext]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const currentStepId = currentStep?.id ?? demo.steps[0]?.id ?? "";
  const currentStepIndex = demo.steps.findIndex((s) => s.id === currentStepId);
  const canGoPrev = currentStepIndex > 0;
  const canGoNext = currentStepIndex < demo.steps.length - 1;

  // Resolve callout text through variable interpolation.
  const resolvedCallouts =
    currentStep?.callouts.map((c) => ({
      ...c,
      resolvedText: engineRef.current?.interpolateVariables(c.text) ?? c.text,
    })) ?? [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={wrapperRef}
      tabIndex={-1}
      className={cn(
        "relative flex bg-zinc-950 outline-none overflow-hidden",
        embedded ? "rounded-lg" : "rounded-2xl",
        "focus-within:ring-1 focus-within:ring-violet-500/30",
        className
      )}
    >
      {/* ── Main content area ──────────────────────────────────────────────── */}
      <div className="relative flex-1 flex flex-col min-w-0">
        {/* ── Canvas + overlay ─────────────────────────────────────────────── */}
        <div
          ref={overlayRef}
          className="relative flex-1 bg-black overflow-hidden"
          style={{ aspectRatio: "16/9" }}
        >
          {/* Background canvas (transition target) */}
          <canvas
            ref={canvasBRef}
            width={canvasSize.w}
            height={canvasSize.h}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ opacity: 0 }}
            aria-hidden="true"
          />

          {/* Foreground canvas (always visible) */}
          <canvas
            ref={canvasARef}
            width={canvasSize.w}
            height={canvasSize.h}
            className="absolute inset-0 w-full h-full object-contain"
            aria-label={currentStep?.title ?? demo.title}
          />

          {/* Hotspot overlays */}
          {!isTransitioning &&
            currentStep?.hotspots.map((hotspot) => (
              <HotspotOverlay
                key={hotspot.id}
                hotspot={hotspot}
                onClick={handleHotspotClick}
              />
            ))}

          {/* Callout overlays */}
          {!isTransitioning &&
            resolvedCallouts.map((callout) => (
              <CalloutOverlay
                key={callout.id}
                callout={callout}
                text={callout.resolvedText}
              />
            ))}

          {/* Loading / empty state */}
          {!currentStep && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-violet-500 animate-spin" />
            </div>
          )}
        </div>

        {/* ── Controls bar ───────────────────────────────────────────────────── */}
        <div
          className={cn(
            "shrink-0 bg-zinc-900/90 backdrop-blur-sm border-t border-white/[0.06]",
            embedded ? "px-3 pt-2 pb-2" : "px-4 pt-2.5 pb-3",
            "flex flex-col gap-2"
          )}
        >
          {/* Step progress bar */}
          <StepProgressBar
            steps={demo.steps}
            currentStepId={currentStepId}
            onStepClick={handleStepClick}
          />

          {/* Button row */}
          <div className="flex items-center gap-2">
            {/* Prev */}
            <button
              onClick={handlePrev}
              disabled={!canGoPrev}
              aria-label="Previous step"
              className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <IconChevronLeft className="w-5 h-5" />
            </button>

            {/* Play / Pause */}
            <button
              onClick={handlePlayPause}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-white hover:text-violet-400 transition-colors"
            >
              {isPlaying ? (
                <IconPause className="w-5 h-5" />
              ) : (
                <IconPlay className="w-5 h-5" />
              )}
            </button>

            {/* Next */}
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              aria-label="Next step"
              className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <IconChevronRight className="w-5 h-5" />
            </button>

            {/* Step counter */}
            <span className="ml-1 text-xs font-mono text-zinc-500 tabular-nums select-none">
              {currentStepIndex + 1}
              <span className="mx-0.5 text-zinc-700">/</span>
              {demo.steps.length}
            </span>

            {/* Step title */}
            {currentStep?.title && !embedded && (
              <span className="ml-2 text-xs text-zinc-400 truncate max-w-[200px]">
                {currentStep.title}
              </span>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Chapters toggle (only when there are chapters and not embedded) */}
            {!embedded && demo.chapters.length > 0 && (
              <button
                onClick={() => setIsSidebarOpen((v) => !v)}
                aria-label={isSidebarOpen ? "Close chapters" : "Open chapters"}
                aria-expanded={isSidebarOpen}
                className={cn(
                  "p-1 rounded-md transition-colors",
                  isSidebarOpen
                    ? "text-violet-400 bg-violet-500/15"
                    : "text-zinc-500 hover:text-white hover:bg-white/[0.06]"
                )}
              >
                <IconMenu className="w-5 h-5" />
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={handleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              {isFullscreen ? (
                <IconExitFullscreen className="w-5 h-5" />
              ) : (
                <IconFullscreen className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Chapter sidebar ──────────────────────────────────────────────────── */}
      {!embedded && isSidebarOpen && (
        <ChapterSidebar
          demo={demo}
          currentStepId={currentStepId}
          onStepClick={handleStepClick}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
