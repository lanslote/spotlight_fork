"use client";

import { cn } from "@/lib/utils";
import { forwardRef, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: [
    "relative overflow-hidden text-white font-medium",
    "bg-gradient-to-br from-violet-600 to-indigo-600",
    "shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_4px_16px_rgba(124,58,237,0.35)]",
    "hover:from-violet-500 hover:to-indigo-500",
    "hover:shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_6px_24px_rgba(124,58,237,0.45)]",
    "hover:-translate-y-px",
    "active:translate-y-0 active:shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_2px_8px_rgba(124,58,237,0.3)]",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
  ].join(" "),

  secondary: [
    "bg-surface-3 text-zinc-200 font-medium",
    "border border-white/[0.08]",
    "shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]",
    "hover:bg-surface-4 hover:border-white/[0.12] hover:text-white",
    "hover:-translate-y-px",
    "active:translate-y-0",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" "),

  outline: [
    "bg-transparent text-zinc-300 font-medium",
    "border border-white/[0.12]",
    "hover:bg-white/[0.04] hover:border-white/[0.2] hover:text-white",
    "hover:-translate-y-px",
    "active:translate-y-0",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" "),

  ghost: [
    "bg-transparent text-zinc-400 font-medium",
    "hover:bg-white/[0.05] hover:text-zinc-200",
    "active:bg-white/[0.08]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" "),

  danger: [
    "bg-gradient-to-br from-rose-600 to-red-700 text-white font-medium",
    "shadow-[0_4px_16px_rgba(244,63,94,0.3)]",
    "hover:from-rose-500 hover:to-red-600",
    "hover:shadow-[0_6px_24px_rgba(244,63,94,0.4)]",
    "hover:-translate-y-px",
    "active:translate-y-0",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" "),
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3.5 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-5 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-7 py-3.5 text-base rounded-xl gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center",
          "transition-all duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0",
          "select-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-0.5 h-4 w-4 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
