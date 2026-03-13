"use client";

/**
 * HotspotOverlay — renders interactive hotspot indicators on the demo canvas.
 *
 * Hotspots are stored as fractions (0–1) of the original content dimensions.
 * This component converts those to pixel coordinates within the container
 * and renders style-appropriate indicators as absolutely-positioned DOM nodes.
 */

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import type { Hotspot } from "@/engine/demo-engine";

interface HotspotOverlayProps {
  hotspots: Hotspot[];
  containerWidth: number;
  containerHeight: number;
  contentWidth: number;
  contentHeight: number;
  onHotspotClick?: (hotspotId: string) => void;
  onHotspotHover?: (hotspotId: string | null) => void;
  /** false = display only, no pointer events (used in editor preview). */
  interactive?: boolean;
  /** Highlights the given hotspot with a selection ring (editor mode). */
  selectedHotspotId?: string | null;
}

// ─── Coordinate helper ────────────────────────────────────────────────────────

/** Uniform scale to fit content inside container (object-fit: contain). */
function fitScale(cw: number, ch: number, iw: number, ih: number): number {
  if (iw === 0 || ih === 0) return 1;
  return Math.min(cw / iw, ch / ih);
}

interface PixelBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

function toPixelBounds(
  hotspot: Hotspot,
  containerWidth: number,
  containerHeight: number,
  contentWidth: number,
  contentHeight: number
): PixelBounds {
  const scale = fitScale(containerWidth, containerHeight, contentWidth, contentHeight);
  const offsetX = (containerWidth - contentWidth * scale) / 2;
  const offsetY = (containerHeight - contentHeight * scale) / 2;

  return {
    left:   hotspot.bounds.x      * scale + offsetX,
    top:    hotspot.bounds.y      * scale + offsetY,
    width:  hotspot.bounds.width  * scale,
    height: hotspot.bounds.height * scale,
  };
}

// ─── Sub-renderers ────────────────────────────────────────────────────────────

interface HotspotItemProps {
  hotspot: Hotspot;
  bounds: PixelBounds;
  isSelected: boolean;
  isHovered: boolean;
  interactive: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

function PulseHotspot({ hotspot, bounds, isSelected, isHovered, interactive, onMouseEnter, onMouseLeave, onClick }: HotspotItemProps) {
  const cx = bounds.width / 2;
  const cy = bounds.height / 2;
  const r = Math.min(bounds.width, bounds.height) / 2;

  return (
    <div
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
      className={cn(
        "absolute",
        interactive ? "cursor-pointer" : "pointer-events-none"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={interactive ? onClick : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={hotspot.tooltip || "Hotspot"}
    >
      {/* Ripple ring */}
      <span
        className="absolute rounded-full border-2 border-violet-400/70 animate-ping"
        style={{
          left: cx - r,
          top: cy - r,
          width: r * 2,
          height: r * 2,
          animationDuration: "2s",
        }}
      />
      {/* Core dot */}
      <span
        className={cn(
          "absolute rounded-full bg-violet-500/60 transition-colors",
          isHovered && "bg-violet-400/80",
          isSelected && "ring-2 ring-white ring-offset-1 ring-offset-transparent"
        )}
        style={{
          left: cx - r * 0.45,
          top: cy - r * 0.45,
          width: r * 0.9,
          height: r * 0.9,
        }}
      />
    </div>
  );
}

function HighlightHotspot({ hotspot, bounds, isSelected, isHovered, interactive, onMouseEnter, onMouseLeave, onClick }: HotspotItemProps) {
  return (
    <div
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
      className={cn(
        "absolute rounded-sm transition-opacity duration-150",
        "bg-violet-500/20",
        isHovered && "bg-violet-500/35",
        isSelected && "outline outline-2 outline-violet-400",
        interactive ? "cursor-pointer" : "pointer-events-none"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={interactive ? onClick : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={hotspot.tooltip || "Hotspot"}
    />
  );
}

function OutlineHotspot({ hotspot, bounds, isSelected, isHovered, interactive, onMouseEnter, onMouseLeave, onClick }: HotspotItemProps) {
  const handles = [
    { left: -4, top: -4 },
    { left: bounds.width / 2 - 4, top: -4 },
    { left: bounds.width - 4, top: -4 },
    { left: bounds.width - 4, top: bounds.height / 2 - 4 },
    { left: bounds.width - 4, top: bounds.height - 4 },
    { left: bounds.width / 2 - 4, top: bounds.height - 4 },
    { left: -4, top: bounds.height - 4 },
    { left: -4, top: bounds.height / 2 - 4 },
  ];

  return (
    <div
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
      className={cn(
        "absolute",
        interactive ? "cursor-pointer" : "pointer-events-none"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={interactive ? onClick : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={hotspot.tooltip || "Hotspot"}
    >
      {/* Dashed animated border */}
      <div
        className={cn(
          "absolute inset-0 rounded-sm",
          "border-2 border-dashed border-violet-500",
          isHovered && "border-violet-400",
          isSelected && "border-violet-300"
        )}
        style={{
          animation: "dash-march 1.5s linear infinite",
        }}
      />
      {/* Corner/edge handles shown only when selected (editor mode) */}
      {isSelected && handles.map((h, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-sm bg-white border border-violet-500 pointer-events-none"
          style={{ left: h.left, top: h.top }}
        />
      ))}
      <style>{`
        @keyframes dash-march {
          to { stroke-dashoffset: -20; }
        }
      `}</style>
    </div>
  );
}

function ArrowHotspot({ hotspot, bounds, isSelected, isHovered, interactive, onMouseEnter, onMouseLeave, onClick }: HotspotItemProps) {
  const cx = bounds.left + bounds.width / 2;
  const cy = bounds.top + bounds.height / 2;
  // Arrow comes from above-left
  const arrowLen = Math.min(bounds.width, bounds.height) * 0.9;
  const sx = -arrowLen * 0.7;
  const sy = -arrowLen * 0.7;

  return (
    <>
      {/* Arrow SVG — rendered relative to container, not the hotspot box */}
      <svg
        className={cn(
          "absolute inset-0 overflow-visible pointer-events-none",
          "w-full h-full"
        )}
        style={{ left: 0, top: 0, width: bounds.left + bounds.width, height: bounds.top + bounds.height }}
      >
        <defs>
          <marker id={`arrow-${hotspot.id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" className="fill-violet-400" />
          </marker>
        </defs>
        <line
          x1={cx + sx}
          y1={cy + sy}
          x2={cx - 2}
          y2={cy - 2}
          className={cn("stroke-violet-400", isHovered && "stroke-violet-300")}
          strokeWidth="2"
          markerEnd={`url(#arrow-${hotspot.id})`}
          style={{ animation: "bounce-arrow 1.2s ease-in-out infinite" }}
        />
      </svg>
      {/* Click target zone */}
      <div
        style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
        className={cn(
          "absolute rounded-full",
          isSelected && "ring-2 ring-violet-400",
          interactive ? "cursor-pointer" : "pointer-events-none"
        )}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={interactive ? onClick : undefined}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={hotspot.tooltip || "Hotspot"}
      />
      <style>{`
        @keyframes bounce-arrow {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-3px, -3px); }
        }
      `}</style>
    </>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function HotspotTooltip({ text, bounds }: { text: string; bounds: PixelBounds }) {
  return (
    <div
      className={cn(
        "absolute z-50 pointer-events-none",
        "px-2 py-1 rounded-md text-xs text-zinc-100 bg-zinc-800/95",
        "shadow-lg border border-white/10 whitespace-nowrap",
        "translate-x-[-50%]"
      )}
      style={{
        left: bounds.left + bounds.width / 2,
        top: bounds.top - 30,
        maxWidth: 200,
      }}
    >
      {text}
      {/* Arrow */}
      <span
        className="absolute left-1/2 -translate-x-1/2 bottom-[-5px] border-4 border-transparent border-t-zinc-800/95"
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HotspotOverlay({
  hotspots,
  containerWidth,
  containerHeight,
  contentWidth,
  contentHeight,
  onHotspotClick,
  onHotspotHover,
  interactive = true,
  selectedHotspotId = null,
}: HotspotOverlayProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleMouseEnter = useCallback(
    (id: string) => {
      setHoveredId(id);
      onHotspotHover?.(id);
    },
    [onHotspotHover]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredId(null);
    onHotspotHover?.(null);
  }, [onHotspotHover]);

  const handleClick = useCallback(
    (id: string) => {
      onHotspotClick?.(id);
    },
    [onHotspotClick]
  );

  if (containerWidth === 0 || containerHeight === 0) return null;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ width: containerWidth, height: containerHeight }}
      aria-hidden={!interactive}
    >
      {hotspots.map((hotspot) => {
        const bounds = toPixelBounds(
          hotspot,
          containerWidth,
          containerHeight,
          contentWidth,
          contentHeight
        );
        const isSelected = selectedHotspotId === hotspot.id;
        const isHovered = hoveredId === hotspot.id;
        const itemProps: HotspotItemProps = {
          hotspot,
          bounds,
          isSelected,
          isHovered,
          interactive,
          onMouseEnter: () => handleMouseEnter(hotspot.id),
          onMouseLeave: handleMouseLeave,
          onClick: () => handleClick(hotspot.id),
        };

        return (
          <div key={hotspot.id} className="contents">
            {hotspot.style === "pulse" && <PulseHotspot {...itemProps} />}
            {hotspot.style === "highlight" && <HighlightHotspot {...itemProps} />}
            {hotspot.style === "outline" && <OutlineHotspot {...itemProps} />}
            {hotspot.style === "arrow" && <ArrowHotspot {...itemProps} />}

            {/* Tooltip */}
            {isHovered && hotspot.tooltip && (
              <HotspotTooltip text={hotspot.tooltip} bounds={bounds} />
            )}
          </div>
        );
      })}
    </div>
  );
}
