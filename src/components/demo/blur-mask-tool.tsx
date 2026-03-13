"use client";

/**
 * BlurMaskTool — interactive canvas overlay for drawing blur/mask/pixelate
 * regions on demo screenshots.
 *
 * The component renders as an absolutely-positioned layer on top of the
 * screenshot.  Users can:
 *   - Click-drag to draw a new region.
 *   - Click an existing region to select it.
 *   - Drag the centre of a selected region to move it.
 *   - Drag corner/edge handles to resize a selected region.
 *   - Press Delete (or click the × button) to remove a selected region.
 *
 * BlurRegion.bounds coordinates are stored in the original content's logical
 * pixel space (same coordinate system as the screenshot).  intensity is 0–1.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";
import type { BlurRegion, BlurMode } from "@/engine/demo-engine";

interface BlurMaskToolProps {
  regions: BlurRegion[];
  onChange: (regions: BlurRegion[]) => void;
  containerWidth: number;
  containerHeight: number;
  /** Natural width of the screenshot in pixels. */
  contentWidth: number;
  /** Natural height of the screenshot in pixels. */
  contentHeight: number;
  activeMode: BlurMode;
  selectedRegionId?: string | null;
  onSelectRegion?: (regionId: string | null) => void;
}

// ─── Coordinate helpers ───────────────────────────────────────────────────────

/** Uniform scale to fit content inside container (object-fit: contain). */
function fitScale(cw: number, ch: number, iw: number, ih: number): number {
  if (iw === 0 || ih === 0) return 1;
  return Math.min(cw / iw, ch / ih);
}

/**
 * Convert a container-pixel point to logical content coordinates.
 * Returns coordinates in the original screenshot's pixel space.
 */
function containerToLogical(
  cpx: number, cpy: number,
  containerWidth: number, containerHeight: number,
  contentWidth: number, contentHeight: number
): { lx: number; ly: number } {
  const scale = fitScale(containerWidth, containerHeight, contentWidth, contentHeight);
  const offsetX = (containerWidth - contentWidth * scale) / 2;
  const offsetY = (containerHeight - contentHeight * scale) / 2;
  return {
    lx: (cpx - offsetX) / scale,
    ly: (cpy - offsetY) / scale,
  };
}

/** Convert a BlurRegion's logical-pixel bounds to container pixel coords. */
function toPixelRect(
  region: BlurRegion,
  containerWidth: number, containerHeight: number,
  contentWidth: number, contentHeight: number
): { left: number; top: number; width: number; height: number } {
  const scale = fitScale(containerWidth, containerHeight, contentWidth, contentHeight);
  const offsetX = (containerWidth - contentWidth * scale) / 2;
  const offsetY = (containerHeight - contentHeight * scale) / 2;
  return {
    left:   region.bounds.x      * scale + offsetX,
    top:    region.bounds.y      * scale + offsetY,
    width:  region.bounds.width  * scale,
    height: region.bounds.height * scale,
  };
}

/** Clamp a logical coordinate to valid content bounds. */
function clampCoord(v: number, max: number): number {
  return Math.min(max, Math.max(0, v));
}

// ─── Handle definitions ───────────────────────────────────────────────────────

type HandlePosition = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLES: HandlePosition[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function handleOffset(
  pos: HandlePosition,
  px: { left: number; top: number; width: number; height: number }
): { x: number; y: number; cursor: string } {
  const { left: l, top: t, width: w, height: h } = px;
  const cx = l + w / 2;
  const cy = t + h / 2;
  switch (pos) {
    case "nw": return { x: l,     y: t,     cursor: "nw-resize" };
    case "n":  return { x: cx,    y: t,     cursor: "n-resize"  };
    case "ne": return { x: l + w, y: t,     cursor: "ne-resize" };
    case "e":  return { x: l + w, y: cy,    cursor: "e-resize"  };
    case "se": return { x: l + w, y: t + h, cursor: "se-resize" };
    case "s":  return { x: cx,    y: t + h, cursor: "s-resize"  };
    case "sw": return { x: l,     y: t + h, cursor: "sw-resize" };
    case "w":  return { x: l,     y: cy,    cursor: "w-resize"  };
  }
}

// ─── Region visual styles ─────────────────────────────────────────────────────

/** intensity: 0–1 */
function BlurOverlay({ intensity }: { intensity: number }) {
  const blur = intensity * 16; // 0 → 16px
  return (
    <div
      className="absolute inset-0 rounded-sm"
      style={{ backdropFilter: `blur(${blur}px)`, opacity: 0.9 }}
    />
  );
}

function MaskOverlay({ intensity }: { intensity: number }) {
  return (
    <div
      className="absolute inset-0 rounded-sm bg-zinc-900"
      style={{ opacity: Math.min(1, intensity * 0.7 + 0.3) }}
    />
  );
}

function PixelateOverlay({ intensity }: { intensity: number }) {
  const cellSize = Math.max(4, Math.round(intensity * 16));
  const svgPattern = `<svg xmlns='http://www.w3.org/2000/svg' width='${cellSize}' height='${cellSize}'><rect width='${cellSize}' height='${cellSize}' fill='rgba(0,0,0,0.35)'/><rect width='${cellSize - 1}' height='${cellSize - 1}' fill='rgba(80,80,80,0.35)'/></svg>`;
  const dataUrl = `data:image/svg+xml;base64,${btoa(svgPattern)}`;
  return (
    <div
      className="absolute inset-0 rounded-sm"
      style={{ backgroundImage: `url("${dataUrl}")`, opacity: 0.9 }}
    />
  );
}

function RegionVisual({ region }: { region: BlurRegion }) {
  if (region.mode === "mask")     return <MaskOverlay     intensity={region.intensity} />;
  if (region.mode === "pixelate") return <PixelateOverlay intensity={region.intensity} />;
  return <BlurOverlay intensity={region.intensity} />;
}

// ─── ID generator ─────────────────────────────────────────────────────────────

let _idCounter = 0;
function nextId(): string {
  return `blur_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`;
}

// ─── Drag state ───────────────────────────────────────────────────────────────

type DragMode =
  | { type: "draw"; startLx: number; startLy: number }
  | {
      type: "move";
      regionId: string;
      startLx: number;
      startLy: number;
      origBoundsX: number;
      origBoundsY: number;
    }
  | {
      type: "resize";
      regionId: string;
      handle: HandlePosition;
      origBounds: { x: number; y: number; width: number; height: number };
      startLx: number;
      startLy: number;
    };

// ─── Main component ───────────────────────────────────────────────────────────

export function BlurMaskTool({
  regions,
  onChange,
  containerWidth,
  containerHeight,
  contentWidth,
  contentHeight,
  activeMode,
  selectedRegionId = null,
  onSelectRegion,
}: BlurMaskToolProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode | null>(null);

  // Draw-preview rect in container pixels (shown during rubber-band draw)
  const [drawPreview, setDrawPreview] = useState<{
    left: number; top: number; width: number; height: number;
  } | null>(null);

  // ── Pointer helpers ──────────────────────────────────────────────────────

  /** Convert a pointer event to logical content pixel coordinates. */
  const pointerToLogical = useCallback(
    (e: { clientX: number; clientY: number }): { lx: number; ly: number } => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { lx: 0, ly: 0 };
      const cpx = e.clientX - rect.left;
      const cpy = e.clientY - rect.top;
      return containerToLogical(cpx, cpy, containerWidth, containerHeight, contentWidth, contentHeight);
    },
    [containerWidth, containerHeight, contentWidth, contentHeight]
  );

  /** Convert logical pixel coordinates back to container pixel coords. */
  const logicalToContainer = useCallback(
    (lx: number, ly: number): { cpx: number; cpy: number } => {
      const scale = fitScale(containerWidth, containerHeight, contentWidth, contentHeight);
      const offsetX = (containerWidth - contentWidth * scale) / 2;
      const offsetY = (containerHeight - contentHeight * scale) / 2;
      return { cpx: lx * scale + offsetX, cpy: ly * scale + offsetY };
    },
    [containerWidth, containerHeight, contentWidth, contentHeight]
  );

  // ── Draw mode events ──────────────────────────────────────────────────────

  const handleContainerPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.target !== containerRef.current) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      const { lx, ly } = pointerToLogical(e);
      dragRef.current = { type: "draw", startLx: lx, startLy: ly };
      onSelectRegion?.(null);
    },
    [pointerToLogical, onSelectRegion]
  );

  // ── Move mode events ──────────────────────────────────────────────────────

  const handleRegionPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, regionId: string) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      onSelectRegion?.(regionId);
      const { lx, ly } = pointerToLogical(e);
      const region = regions.find((r) => r.id === regionId);
      if (!region) return;
      dragRef.current = {
        type: "move",
        regionId,
        startLx: lx,
        startLy: ly,
        origBoundsX: region.bounds.x,
        origBoundsY: region.bounds.y,
      };
    },
    [onSelectRegion, pointerToLogical, regions]
  );

  // ── Resize mode events ────────────────────────────────────────────────────

  const handleHandlePointerDown = useCallback(
    (
      e: ReactPointerEvent<HTMLDivElement>,
      regionId: string,
      handle: HandlePosition
    ) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const { lx, ly } = pointerToLogical(e);
      const region = regions.find((r) => r.id === regionId);
      if (!region) return;
      dragRef.current = {
        type: "resize",
        regionId,
        handle,
        origBounds: { ...region.bounds },
        startLx: lx,
        startLy: ly,
      };
    },
    [pointerToLogical, regions]
  );

  // ── Pointer move ──────────────────────────────────────────────────────────

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;

      const { lx, ly } = pointerToLogical(e);

      if (drag.type === "draw") {
        const x = Math.min(drag.startLx, lx);
        const y = Math.min(drag.startLy, ly);
        const w = Math.abs(lx - drag.startLx);
        const h = Math.abs(ly - drag.startLy);
        const { cpx: cl, cpy: ct } = logicalToContainer(x, y);
        const scale = fitScale(containerWidth, containerHeight, contentWidth, contentHeight);
        setDrawPreview({ left: cl, top: ct, width: w * scale, height: h * scale });
        return;
      }

      if (drag.type === "move") {
        const dlx = lx - drag.startLx;
        const dly = ly - drag.startLy;
        onChange(
          regions.map((r) =>
            r.id === drag.regionId
              ? {
                  ...r,
                  bounds: {
                    ...r.bounds,
                    x: clampCoord(drag.origBoundsX + dlx, contentWidth  - r.bounds.width),
                    y: clampCoord(drag.origBoundsY + dly, contentHeight - r.bounds.height),
                  },
                }
              : r
          )
        );
        return;
      }

      if (drag.type === "resize") {
        const dlx = lx - drag.startLx;
        const dly = ly - drag.startLy;
        const orig = drag.origBounds;
        let { x, y, width, height } = orig;

        const handle = drag.handle;
        if (handle.includes("w")) {
          const newX = clampCoord(orig.x + dlx, orig.x + orig.width - 1);
          width  = orig.width - (newX - orig.x);
          x = newX;
        }
        if (handle.includes("e")) {
          width  = Math.max(1, orig.width  + dlx);
        }
        if (handle.includes("n")) {
          const newY = clampCoord(orig.y + dly, orig.y + orig.height - 1);
          height = orig.height - (newY - orig.y);
          y = newY;
        }
        if (handle.includes("s")) {
          height = Math.max(1, orig.height + dly);
        }

        onChange(
          regions.map((r) =>
            r.id === drag.regionId
              ? { ...r, bounds: { x, y, width, height } }
              : r
          )
        );
      }
    },
    [pointerToLogical, logicalToContainer, regions, onChange, containerWidth, containerHeight, contentWidth, contentHeight]
  );

  // ── Pointer up ────────────────────────────────────────────────────────────

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDrawPreview(null);

      if (drag?.type === "draw") {
        const { lx, ly } = pointerToLogical(e);
        const x = Math.min(drag.startLx, lx);
        const y = Math.min(drag.startLy, ly);
        const w = Math.abs(lx - drag.startLx);
        const h = Math.abs(ly - drag.startLy);
        // Minimum 5px in each dimension to avoid accidental regions
        if (w < 5 || h < 5) return;
        const newRegion: BlurRegion = {
          id: nextId(),
          bounds: { x, y, width: w, height: h },
          mode: activeMode,
          intensity: 0.6,
        };
        onChange([...regions, newRegion]);
        onSelectRegion?.(newRegion.id);
      }
    },
    [pointerToLogical, regions, onChange, activeMode, onSelectRegion]
  );

  // ── Keyboard delete ───────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedRegionId) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        onChange(regions.filter((r) => r.id !== selectedRegionId));
        onSelectRegion?.(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedRegionId, regions, onChange, onSelectRegion]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedRegionId) return;
    onChange(regions.filter((r) => r.id !== selectedRegionId));
    onSelectRegion?.(null);
  }, [selectedRegionId, regions, onChange, onSelectRegion]);

  // ─────────────────────────────────────────────────────────────────────────

  if (containerWidth === 0 || containerHeight === 0) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-crosshair"
      style={{ width: containerWidth, height: containerHeight }}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Existing regions */}
      {regions.map((region) => {
        const px = toPixelRect(region, containerWidth, containerHeight, contentWidth, contentHeight);
        const isSelected = selectedRegionId === region.id;

        return (
          <div
            key={region.id}
            className={cn(
              "absolute rounded-sm overflow-hidden cursor-move select-none",
              isSelected && "ring-2 ring-violet-400 ring-offset-0"
            )}
            style={{ left: px.left, top: px.top, width: px.width, height: px.height }}
            onPointerDown={(e) => handleRegionPointerDown(e, region.id)}
          >
            {/* Visual effect overlay */}
            <RegionVisual region={region} />

            {/* Mode + intensity badge */}
            <span className="absolute bottom-1 right-1 text-[10px] text-zinc-300 bg-zinc-900/70 px-1 py-0.5 rounded pointer-events-none select-none">
              {region.mode} {Math.round(region.intensity * 100)}%
            </span>

            {/* Delete button — only visible when selected */}
            {isSelected && (
              <button
                className={cn(
                  "absolute -top-3 -right-3 w-6 h-6 rounded-full z-10",
                  "flex items-center justify-center text-xs text-white",
                  "bg-rose-600 hover:bg-rose-500 shadow-sm transition-colors"
                )}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleDeleteSelected}
                aria-label="Delete region"
              >
                ×
              </button>
            )}

            {/* Resize handles — 8 positions, shown on selection */}
            {isSelected && HANDLES.map((pos) => {
              const { x, y, cursor } = handleOffset(pos, px);
              return (
                <div
                  key={pos}
                  className="absolute w-2.5 h-2.5 rounded-sm bg-white border border-violet-500 z-10"
                  style={{
                    left: x - px.left - 5,
                    top:  y - px.top  - 5,
                    cursor,
                  }}
                  onPointerDown={(e) => handleHandlePointerDown(e, region.id, pos)}
                />
              );
            })}
          </div>
        );
      })}

      {/* Rubber-band draw preview */}
      {drawPreview && (
        <div
          className="absolute pointer-events-none border-2 border-dashed border-violet-400 rounded-sm bg-violet-500/10"
          style={drawPreview}
        />
      )}
    </div>
  );
}
