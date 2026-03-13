"use client";

/**
 * CalloutOverlay — renders annotation callouts on the demo canvas.
 *
 * Callout positions are stored as fractions (0–1) of the original content
 * dimensions and are converted to pixel coordinates at render time.  The
 * component supports four visual styles: tooltip speech bubbles, badge numbers,
 * numbered labels, and arrow annotations.
 *
 * Variable interpolation: tokens of the form {{varName}} in callout text are
 * replaced with values from the `variables` prop before rendering.
 */

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Callout, CalloutAnchor } from "@/engine/demo-engine";
// CalloutAnchor is re-exported from demo-engine as a backward-compatibility alias.

interface CalloutOverlayProps {
  callouts: Callout[];
  containerWidth: number;
  containerHeight: number;
  contentWidth: number;
  contentHeight: number;
  onCalloutClick?: (calloutId: string) => void;
  /** When true, clicking a callout makes its text editable inline. */
  editable?: boolean;
  onCalloutTextChange?: (calloutId: string, text: string) => void;
  selectedCalloutId?: string | null;
  /** Values for {{varName}} token replacement in callout text. */
  variables?: Record<string, string>;
}

// ─── Coordinate helpers ───────────────────────────────────────────────────────

function fitScale(cw: number, ch: number, iw: number, ih: number): number {
  if (iw === 0 || ih === 0) return 1;
  return Math.min(cw / iw, ch / ih);
}

interface PixelPoint {
  x: number;
  y: number;
  w: number;
  h: number;
}

function toPixelPoint(
  callout: Callout,
  containerWidth: number,
  containerHeight: number,
  contentWidth: number,
  contentHeight: number
): PixelPoint {
  const scale = fitScale(containerWidth, containerHeight, contentWidth, contentHeight);
  const offsetX = (containerWidth - contentWidth * scale) / 2;
  const offsetY = (containerHeight - contentHeight * scale) / 2;
  return {
    x: callout.position.x * scale + offsetX,
    y: callout.position.y * scale + offsetY,
    w: 200, // tooltip max-width in px; not used for layout, only reference
    h: 40,
  };
}

// ─── Variable interpolation ───────────────────────────────────────────────────

function interpolateVariables(
  text: string,
  variables: Record<string, string> | undefined
): string {
  if (!variables) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

// ─── Tooltip arrow direction ──────────────────────────────────────────────────

/**
 * Returns a CSS triangle snippet for the speech-bubble tail.
 * The anchor tells which side of the callout the tail protrudes from.
 */
function tooltipArrowClass(anchor: CalloutAnchor): string {
  switch (anchor) {
    case "top":
      return "top-0 left-1/2 -translate-x-1/2 -translate-y-full border-x-4 border-x-transparent border-b-[6px] border-b-zinc-800";
    case "bottom":
      return "bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-x-4 border-x-transparent border-t-[6px] border-t-zinc-800";
    case "left":
      return "left-0 top-1/2 -translate-y-1/2 -translate-x-full border-y-4 border-y-transparent border-r-[6px] border-r-zinc-800";
    case "right":
      return "right-0 top-1/2 -translate-y-1/2 translate-x-full border-y-4 border-y-transparent border-l-[6px] border-l-zinc-800";
    default:
      return "";
  }
}

// ─── Individual callout renderers ─────────────────────────────────────────────

interface CalloutItemProps {
  callout: Callout;
  pt: PixelPoint;
  displayText: string;
  isSelected: boolean;
  editable: boolean;
  onTextChange: (text: string) => void;
  onClick: () => void;
}

function TooltipCallout({
  callout,
  pt,
  displayText,
  isSelected,
  editable,
  onTextChange,
  onClick,
}: CalloutItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const anchor: CalloutAnchor = callout.anchor ?? "bottom";

  const handleClick = useCallback(() => {
    onClick();
    if (editable) setIsEditing(true);
  }, [editable, onClick]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (ref.current) onTextChange(ref.current.innerText);
  }, [onTextChange]);

  return (
    <div
      className="absolute"
      style={{ left: pt.x, top: pt.y, transform: "translate(-50%, -50%)" }}
    >
      <div
        className={cn(
          "relative rounded-lg px-3 py-2 text-xs text-zinc-100 bg-zinc-800",
          "shadow-[0_4px_16px_rgba(0,0,0,0.4)] border border-white/10",
          "max-w-[250px] break-words",
          isSelected && "ring-2 ring-violet-400",
          editable && "cursor-text"
        )}
        onClick={handleClick}
      >
        {/* Tail arrow */}
        <span className={cn("absolute w-0 h-0", tooltipArrowClass(anchor))} />

        {/* Text content — contentEditable when editing */}
        <div
          ref={ref}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={handleBlur}
          className={cn(
            "outline-none min-w-[40px]",
            isEditing && "bg-zinc-700/40 rounded px-0.5"
          )}
          dangerouslySetInnerHTML={isEditing ? undefined : { __html: displayText }}
        >
          {isEditing ? displayText : undefined}
        </div>
      </div>
    </div>
  );
}

function BadgeCallout({ callout, pt, isSelected, onClick }: CalloutItemProps) {
  return (
    <div
      className="absolute cursor-pointer"
      style={{
        left: pt.x,
        top: pt.y,
        transform: "translate(-50%, -50%)",
      }}
      onClick={onClick}
    >
      <div
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center",
          "bg-violet-600 text-white font-bold text-[11px] select-none",
          "shadow-[0_2px_8px_rgba(124,58,237,0.5)]",
          isSelected && "ring-2 ring-white ring-offset-1 ring-offset-transparent"
        )}
      >
        {callout.number ?? 1}
      </div>
    </div>
  );
}

function NumberedCallout({
  callout,
  pt,
  displayText,
  isSelected,
  editable,
  onTextChange,
  onClick,
}: CalloutItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(() => {
    onClick();
    if (editable) setIsEditing(true);
  }, [editable, onClick]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (ref.current) onTextChange(ref.current.innerText);
  }, [onTextChange]);

  return (
    <div
      className="absolute"
      style={{ left: pt.x, top: pt.y, transform: "translate(-50%, -50%)" }}
      onClick={handleClick}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          isSelected && "outline outline-2 outline-violet-400 rounded-full pr-2"
        )}
      >
        {/* Number circle */}
        <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-violet-600 text-white font-bold text-[11px] shadow-[0_2px_8px_rgba(124,58,237,0.4)]">
          {callout.number ?? 1}
        </div>
        {/* Label text */}
        <div
          ref={ref}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={handleBlur}
          className={cn(
            "text-xs text-zinc-100 font-medium whitespace-nowrap outline-none",
            isEditing && "bg-zinc-700/50 rounded px-0.5",
            editable && "cursor-text"
          )}
          dangerouslySetInnerHTML={isEditing ? undefined : { __html: displayText }}
        >
          {isEditing ? displayText : undefined}
        </div>
      </div>
    </div>
  );
}

function ArrowCallout({
  callout,
  pt,
  displayText,
  isSelected,
  editable,
  onTextChange,
  onClick,
}: CalloutItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Arrow points 60px to the right and 30px down from the label position
  const labelX = pt.x;
  const labelY = pt.y;
  const arrowEndX = pt.x + 60;
  const arrowEndY = pt.y + 30;

  const handleClick = useCallback(() => {
    onClick();
    if (editable) setIsEditing(true);
  }, [editable, onClick]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (ref.current) onTextChange(ref.current.innerText);
  }, [onTextChange]);

  return (
    <>
      {/* SVG arrow line — rendered as sibling in the overlay container */}
      <svg
        className="absolute inset-0 pointer-events-none overflow-visible"
        style={{ left: 0, top: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <marker
            id={`callout-arrow-${callout.id}`}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill="rgb(167 139 250)" />
          </marker>
        </defs>
        <line
          x1={labelX}
          y1={labelY}
          x2={arrowEndX}
          y2={arrowEndY}
          stroke="rgb(167 139 250)"
          strokeWidth="1.5"
          markerEnd={`url(#callout-arrow-${callout.id})`}
        />
      </svg>

      {/* Text label */}
      <div
        className="absolute"
        style={{ left: labelX, top: labelY - 10, transform: "translateX(-50%)" }}
        onClick={handleClick}
      >
        <div
          ref={ref}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onBlur={handleBlur}
          className={cn(
            "text-xs text-zinc-100 bg-zinc-800/90 rounded px-2 py-1",
            "shadow border border-white/10 outline-none whitespace-nowrap",
            isSelected && "ring-2 ring-violet-400",
            editable && "cursor-text"
          )}
          dangerouslySetInnerHTML={isEditing ? undefined : { __html: displayText }}
        >
          {isEditing ? displayText : undefined}
        </div>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CalloutOverlay({
  callouts,
  containerWidth,
  containerHeight,
  contentWidth,
  contentHeight,
  onCalloutClick,
  editable = false,
  onCalloutTextChange,
  selectedCalloutId = null,
  variables,
}: CalloutOverlayProps) {
  const handleClick = useCallback(
    (id: string) => onCalloutClick?.(id),
    [onCalloutClick]
  );

  const handleTextChange = useCallback(
    (id: string, text: string) => onCalloutTextChange?.(id, text),
    [onCalloutTextChange]
  );

  if (containerWidth === 0 || containerHeight === 0) return null;

  return (
    <div
      className="absolute inset-0"
      style={{ width: containerWidth, height: containerHeight }}
    >
      {callouts.map((callout) => {
        const pt = toPixelPoint(
          callout,
          containerWidth,
          containerHeight,
          contentWidth,
          contentHeight
        );
        const displayText = interpolateVariables(callout.text, variables);
        const isSelected = selectedCalloutId === callout.id;

        const itemProps: CalloutItemProps = {
          callout,
          pt,
          displayText,
          isSelected,
          editable,
          onTextChange: (text) => handleTextChange(callout.id, text),
          onClick: () => handleClick(callout.id),
        };

        if (callout.style === "badge") return <BadgeCallout key={callout.id} {...itemProps} />;
        if (callout.style === "numbered") return <NumberedCallout key={callout.id} {...itemProps} />;
        if (callout.style === "arrow") return <ArrowCallout key={callout.id} {...itemProps} />;
        // Default: "tooltip" speech bubble
        return <TooltipCallout key={callout.id} {...itemProps} />;
      })}
    </div>
  );
}
