"use client";

import { cn } from "@/lib/utils";
import { useRef, useCallback } from "react";

interface SliderProps {
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  displayValue?: string | ((v: number) => string);
  disabled?: boolean;
  className?: string;
}

export function Slider({
  label,
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  displayValue,
  disabled = false,
  className,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  const display =
    typeof displayValue === "function"
      ? displayValue(value)
      : displayValue ?? String(value);

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            {label}
          </label>
          <span className="text-xs font-mono text-accent-400 bg-accent-500/10 px-1.5 py-0.5 rounded">
            {display}
          </span>
        </div>
      )}
      <div className="relative flex items-center h-5">
        {/* Track background */}
        <div className="relative w-full h-1.5 rounded-full bg-surface-4">
          {/* Filled portion */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-75"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Native input overlay (invisible but interactive) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "absolute inset-0 w-full opacity-0 cursor-pointer h-full",
            "disabled:cursor-not-allowed"
          )}
        />
        {/* Custom thumb */}
        <div
          className={cn(
            "absolute w-4 h-4 rounded-full -translate-x-1/2 pointer-events-none",
            "bg-white shadow-[0_0_0_2px_rgba(139,92,246,0.6),0_2px_8px_rgba(0,0,0,0.4)]",
            "transition-all duration-75",
            disabled && "opacity-50"
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
      {/* Min/max labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-zinc-600">{min}</span>
        <span className="text-[10px] text-zinc-600">{max}</span>
      </div>
    </div>
  );
}
