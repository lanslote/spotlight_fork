"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Play, Pause, Maximize2, RotateCcw } from "lucide-react";
import type { TemplateProps } from "./property-panel";

type AspectRatio = "16:9" | "9:16" | "1:1";

interface PreviewCanvasProps {
  templateId: string;
  props: TemplateProps;
  aspectRatio?: AspectRatio;
  onAspectRatioChange?: (ratio: AspectRatio) => void;
  className?: string;
}

const ASPECT_RATIOS: { value: AspectRatio; label: string; w: number; h: number }[] = [
  { value: "16:9", label: "16:9", w: 1920, h: 1080 },
  { value: "9:16", label: "9:16", w: 1080, h: 1920 },
  { value: "1:1",  label: "1:1",  w: 1080, h: 1080 },
];

// ── Canvas drawing utilities ──────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2;
}

/** Draw a rounded rectangle path */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Draw the animated gradient background */
function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  g1: string,
  g2: string,
  t: number
) {
  // Animated radial gradient
  const angle = t * Math.PI * 2 * 0.15; // slow rotation
  const cx = w * 0.5 + Math.cos(angle) * w * 0.15;
  const cy = h * 0.5 + Math.sin(angle) * h * 0.1;

  const bg = ctx.createLinearGradient(
    w * 0.5 + Math.cos(angle) * w * 0.3,
    0,
    w * 0.5 - Math.cos(angle) * w * 0.3,
    h
  );
  bg.addColorStop(0, g1);
  bg.addColorStop(1, g2);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Secondary radial glow
  const [r1, g1c, b1c] = hexToRgb(g1);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.7);
  glow.addColorStop(0, `rgba(${r1},${g1c},${b1c},0.35)`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Noise overlay (simulate)
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 0, w, h);
}

/** Draw floating geometric particles */
function drawParticles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  g2: string
) {
  const [r, g, b] = hexToRgb(g2);
  const count = 8;
  for (let i = 0; i < count; i++) {
    const seed = i * 137.5;
    const x = ((seed * 13 + t * 20 * (i % 2 === 0 ? 1 : -0.7)) % w + w) % w;
    const y = ((seed * 7 + t * 12 * (i % 3 === 0 ? 1 : -0.5)) % h + h) % h;
    const size = 3 + (i % 4) * 2;
    const alpha = 0.15 + Math.sin(t * 1.5 + i) * 0.1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgba(${r},${g},${b},1)`;
    ctx.translate(x, y);
    ctx.rotate(t * 0.3 + i);
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
}

/** Draw a scene based on elapsed time within a [0, duration] window */
function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sceneTime: number, // 0 → duration
  duration: number,
  props: TemplateProps,
  sceneIdx: number,
  totalTime: number
) {
  const progress = Math.min(sceneTime / duration, 1);
  const g1 = props.gradientStart ?? "#7c3aed";
  const g2 = props.gradientEnd ?? "#2563eb";

  ctx.clearRect(0, 0, w, h);

  // ── Background ──────────────────────────────────────────────────────────────
  drawBackground(ctx, w, h, g1, g2, totalTime);
  drawParticles(ctx, w, h, totalTime, g2);

  const scale = w / 1920;
  ctx.save();
  ctx.scale(scale, scale);
  const lw = 1920; // logical width
  const lh = h / scale;

  // ── Scene-specific content ─────────────────────────────────────────────────

  if (sceneIdx === 0) {
    // INTRO: product name slides up
    const enterProgress = easeOutCubic(Math.min(sceneTime / 0.8, 1));
    const exitProgress = progress > 0.8 ? easeInOutQuart((progress - 0.8) / 0.2) : 0;
    const yOffset = (1 - enterProgress) * 60 - exitProgress * 40;
    const alpha = enterProgress * (1 - exitProgress * 0.5);

    ctx.globalAlpha = alpha;

    // Category chip
    if (props.category) {
      const chipY = lh * 0.38 + yOffset;
      ctx.font = `500 ${Math.round(18 * scale)}px Inter, sans-serif`;
      const chipText = props.category.toUpperCase();
      const chipW = ctx.measureText(chipText).width / scale + 32;
      const chipH = 32;
      const chipX = lw / 2 - (chipW * scale) / 2;

      ctx.save();
      ctx.scale(1 / scale, 1 / scale);
      roundRect(ctx, chipX * scale, chipY * scale, chipW * scale, chipH * scale, 100);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.textAlign = "center";
      ctx.font = `500 ${18}px Inter, sans-serif`;
      ctx.letterSpacing = "3px";
      ctx.fillText(chipText, lw / 2, lh * 0.38 + 20 + yOffset);
    }

    // Product name — big serif headline
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    const name = props.productName ?? "Spotlight";
    const fontSize = Math.max(60, Math.min(120, lw / (name.length * 0.7)));
    ctx.font = `400 ${fontSize}px "Instrument Serif", Georgia, serif`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = `rgba(255,255,255,0.2)`;
    ctx.shadowBlur = 40;
    ctx.fillText(name, lw / 2, lh * 0.5 + yOffset);
    ctx.shadowBlur = 0;

    // Tagline
    if (props.tagline) {
      ctx.globalAlpha = alpha * 0.75;
      ctx.font = `300 ${28}px Inter, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(props.tagline, lw / 2, lh * 0.5 + fontSize * 0.75 + 16 + yOffset);
    }

  } else if (sceneIdx === 1) {
    // FEATURES: staggered feature list
    const features = props.features ?? ["Fast", "Beautiful", "Open-source"];
    const enter = easeOutCubic(Math.min(sceneTime / 0.5, 1));

    // Heading
    ctx.globalAlpha = enter;
    ctx.textAlign = "center";
    ctx.font = `400 ${52}px "Instrument Serif", Georgia, serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText("What's new", lw / 2, lh * 0.2);

    // Feature items
    features.forEach((feat, i) => {
      const delay = 0.1 + i * 0.15;
      const featureProgress = easeOutCubic(Math.max(0, Math.min((sceneTime - delay) / 0.4, 1)));
      const xOff = (1 - featureProgress) * 30;

      ctx.globalAlpha = featureProgress;
      ctx.textAlign = "left";

      const itemY = lh * 0.35 + i * 70;
      const itemX = lw / 2 - 280;

      // Bullet dot
      ctx.beginPath();
      ctx.arc(itemX - 20, itemY - 8, 5, 0, Math.PI * 2);
      ctx.fillStyle = g2;
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `400 ${28}px Inter, sans-serif`;
      ctx.fillText(feat, itemX + xOff, itemY);
    });

  } else if (sceneIdx === 2) {
    // OUTRO: CTA
    const enter = easeOutCubic(Math.min(sceneTime / 0.6, 1));
    ctx.globalAlpha = enter;

    // Glow ring
    const glowR = ctx.createRadialGradient(lw / 2, lh / 2, 0, lw / 2, lh / 2, 300);
    const [r, g, b] = hexToRgb(g1);
    glowR.addColorStop(0, `rgba(${r},${g},${b},0.25)`);
    glowR.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowR;
    ctx.fillRect(0, 0, lw, lh);

    ctx.textAlign = "center";
    ctx.font = `400 italic ${72}px "Instrument Serif", Georgia, serif`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(255,255,255,0.3)";
    ctx.shadowBlur = 30;
    ctx.fillText(props.productName ?? "Spotlight", lw / 2, lh * 0.45);
    ctx.shadowBlur = 0;

    ctx.globalAlpha = enter * 0.7;
    ctx.font = `400 ${24}px Inter, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText(props.tagline ?? "Ship. Launch. Impress.", lw / 2, lh * 0.57);

    // CTA button shape
    const btnW = 240;
    const btnH = 52;
    const btnX = lw / 2 - btnW / 2;
    const btnY = lh * 0.66;
    const btnEnter = easeOutCubic(Math.max(0, Math.min((sceneTime - 0.4) / 0.4, 1)));

    ctx.globalAlpha = enter * btnEnter;
    roundRect(ctx, btnX, btnY, btnW, btnH, 14);
    const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY);
    btnGrad.addColorStop(0, g1);
    btnGrad.addColorStop(1, g2);
    ctx.fillStyle = btnGrad;
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = `600 ${20}px Inter, sans-serif`;
    ctx.fillText("Get Started →", lw / 2, btnY + 34);
  }

  ctx.restore();
}

// ── Main component ────────────────────────────────────────────────────────────

const SCENES = [
  { name: "Intro", duration: 3.5 },
  { name: "Features", duration: 4.0 },
  { name: "Outro", duration: 3.0 },
];
const TOTAL_DURATION = SCENES.reduce((s, sc) => s + sc.duration, 0);

export function PreviewCanvas({
  templateId,
  props,
  aspectRatio = "16:9",
  onAspectRatioChange,
  className,
}: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [dimensions, setDimensions] = useState({ w: 1280, h: 720 });

  const arConfig = ASPECT_RATIOS.find((a) => a.value === aspectRatio) ?? ASPECT_RATIOS[0];

  // Compute canvas display dimensions from container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const containerW = entry.contentRect.width;
      const containerH = entry.contentRect.height;
      const ratio = arConfig.w / arConfig.h;
      let w = containerW;
      let h = containerW / ratio;
      if (h > containerH) {
        h = containerH;
        w = containerH * ratio;
      }
      setDimensions({ w: Math.round(w), h: Math.round(h) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [arConfig]);

  // Determine current scene from time
  const getSceneAt = useCallback((t: number): { sceneIdx: number; sceneTime: number } => {
    let elapsed = 0;
    for (let i = 0; i < SCENES.length; i++) {
      if (t < elapsed + SCENES[i].duration) {
        return { sceneIdx: i, sceneTime: t - elapsed };
      }
      elapsed += SCENES[i].duration;
    }
    return { sceneIdx: SCENES.length - 1, sceneTime: SCENES[SCENES.length - 1].duration };
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = (now: number) => {
      if (isPlaying) {
        if (startTimeRef.current === null) {
          startTimeRef.current = now - pausedAtRef.current * 1000;
        }
        const elapsed = (now - startTimeRef.current) / 1000;
        const t = elapsed % TOTAL_DURATION;
        setCurrentTime(t);
        pausedAtRef.current = t;

        const { sceneIdx, sceneTime } = getSceneAt(t);
        drawScene(
          ctx,
          dimensions.w,
          dimensions.h,
          sceneTime,
          SCENES[sceneIdx].duration,
          props,
          sceneIdx,
          t
        );
      } else {
        // Paused — redraw static frame
        startTimeRef.current = null;
        const t = pausedAtRef.current;
        const { sceneIdx, sceneTime } = getSceneAt(t);
        drawScene(
          ctx,
          dimensions.w,
          dimensions.h,
          sceneTime,
          SCENES[sceneIdx].duration,
          props,
          sceneIdx,
          t
        );
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, dimensions, props, getSceneAt]);

  const handlePlayPause = () => {
    if (isPlaying) {
      startTimeRef.current = null;
    }
    setIsPlaying((v) => !v);
  };

  const handleRestart = () => {
    pausedAtRef.current = 0;
    startTimeRef.current = null;
    setCurrentTime(0);
    if (!isPlaying) setIsPlaying(true);
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 10);
    return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
  };

  const progressPct = (currentTime / TOTAL_DURATION) * 100;

  return (
    <div
      className={cn(
        "relative flex flex-col h-full bg-surface-0 rounded-xl overflow-hidden",
        className
      )}
    >
      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative flex-1 flex items-center justify-center bg-[#050508] overflow-hidden"
        style={{ backgroundImage: "radial-gradient(circle at 50% 50%, #0f0f18 0%, #050508 70%)" }}
      >
        {/* Checkerboard for transparency */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "repeating-conic-gradient(#fff 0% 25%, transparent 0% 50%)",
            backgroundSize: "20px 20px",
          }}
        />

        <canvas
          ref={canvasRef}
          width={dimensions.w}
          height={dimensions.h}
          className="relative z-10 rounded-lg shadow-[0_0_60px_rgba(0,0,0,0.8)]"
          style={{ imageRendering: "pixelated" }}
        />

        {/* Aspect ratio selector (top right) */}
        <div className="absolute top-3 right-3 flex items-center gap-1 z-20">
          {ASPECT_RATIOS.map((ar) => (
            <button
              key={ar.value}
              onClick={() => onAspectRatioChange?.(ar.value)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150",
                aspectRatio === ar.value
                  ? "bg-accent-500/20 text-accent-400 border border-accent-500/30"
                  : "bg-black/40 text-zinc-500 border border-white/[0.05] hover:text-zinc-300 hover:bg-white/[0.06]"
              )}
            >
              {ar.label}
            </button>
          ))}
        </div>
      </div>

      {/* Controls bar */}
      <div className="shrink-0 bg-surface-1 border-t border-white/[0.06] px-4 py-2.5">
        {/* Progress bar */}
        <div className="relative h-1 bg-surface-3 rounded-full mb-2.5 overflow-hidden cursor-pointer group">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-[width] duration-75"
            style={{ width: `${progressPct}%` }}
          />
          {/* Scene markers */}
          {SCENES.slice(0, -1).map((sc, i) => {
            const scenePct =
              (SCENES.slice(0, i + 1).reduce((s, s2) => s + s2.duration, 0) /
                TOTAL_DURATION) *
              100;
            return (
              <div
                key={i}
                className="absolute top-0 h-full w-px bg-white/20"
                style={{ left: `${scenePct}%` }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          {/* Left: play controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestart}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition-all"
              aria-label="Restart"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handlePlayPause}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent-500/15 text-accent-400 hover:bg-accent-500/25 transition-all border border-accent-500/20"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 translate-x-0.5" />
              )}
            </button>
          </div>

          {/* Center: time */}
          <span className="font-mono text-xs text-zinc-500">
            {formatTime(currentTime)}
            <span className="text-zinc-700 mx-1">/</span>
            {formatTime(TOTAL_DURATION)}
          </span>

          {/* Right: scene name */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 hidden sm:block">
              {SCENES[getSceneAt(currentTime).sceneIdx]?.name ?? ""}
            </span>
            <button
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition-all"
              aria-label="Fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
