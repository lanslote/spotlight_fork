"use client";

import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, forwardRef } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = "Select…",
  disabled = false,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div className={cn("w-full", className)} ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        {/* Trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "w-full flex items-center justify-between gap-2",
            "px-3 py-2 rounded-lg text-sm text-left",
            "bg-surface-2 border border-white/[0.07]",
            "transition-all duration-150",
            "hover:border-white/[0.12]",
            "focus:outline-none focus:border-accent-500/60",
            open && "border-accent-500/50 bg-surface-3",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className={cn(selected ? "text-zinc-100" : "text-zinc-500")}>
            {selected ? (
              <span className="flex items-center gap-2">
                {selected.icon && <span className="shrink-0">{selected.icon}</span>}
                {selected.label}
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 text-zinc-500 shrink-0 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div
            className={cn(
              "absolute z-50 w-full mt-1 py-1 rounded-xl",
              "bg-surface-2 border border-white/[0.08]",
              "shadow-[0_8px_40px_rgba(0,0,0,0.5)]",
              "animate-in fade-in slide-in-from-top-1 duration-150"
            )}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange?.(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 text-sm",
                  "transition-colors duration-100",
                  "hover:bg-white/[0.05] text-left",
                  opt.value === value ? "text-accent-400" : "text-zinc-200"
                )}
              >
                <span className="flex items-center gap-2">
                  {opt.icon && <span className="shrink-0 text-zinc-400">{opt.icon}</span>}
                  <span>
                    <span className="block leading-tight">{opt.label}</span>
                    {opt.description && (
                      <span className="text-xs text-zinc-500">{opt.description}</span>
                    )}
                  </span>
                </span>
                {opt.value === value && (
                  <Check className="w-3.5 h-3.5 text-accent-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Native select fallback for SSR contexts ──────────────────────────────────

interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ label, className, children, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={cn(
              "w-full appearance-none px-3 py-2 pr-8 rounded-lg text-sm",
              "bg-surface-2 border border-white/[0.07]",
              "text-zinc-100",
              "focus:outline-none focus:border-accent-500/60",
              "hover:border-white/[0.12]",
              "cursor-pointer",
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        </div>
      </div>
    );
  }
);

NativeSelect.displayName = "NativeSelect";
