import { cn } from "@/lib/utils";
import { forwardRef, HTMLAttributes } from "react";

type PaddingVariant = "none" | "sm" | "md" | "lg";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: PaddingVariant;
  glow?: boolean;
  glowColor?: "violet" | "blue" | "rose" | "emerald";
  hoverable?: boolean;
  bordered?: boolean;
}

const paddingClasses: Record<PaddingVariant, string> = {
  none: "",
  sm:   "p-3",
  md:   "p-5",
  lg:   "p-8",
};

const glowClasses: Record<NonNullable<CardProps["glowColor"]>, string> = {
  violet:  "hover:shadow-[0_0_40px_rgba(139,92,246,0.12)] hover:border-violet-500/20",
  blue:    "hover:shadow-[0_0_40px_rgba(59,130,246,0.12)] hover:border-blue-500/20",
  rose:    "hover:shadow-[0_0_40px_rgba(244,63,94,0.12)] hover:border-rose-500/20",
  emerald: "hover:shadow-[0_0_40px_rgba(16,185,129,0.12)] hover:border-emerald-500/20",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      padding = "md",
      glow = false,
      glowColor = "violet",
      hoverable = false,
      bordered = true,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl bg-surface-1",
          bordered && "border border-white/[0.06]",
          paddingClasses[padding],
          hoverable && "transition-all duration-300 cursor-pointer",
          hoverable && "hover:-translate-y-0.5",
          glow && glowClasses[glowColor],
          glow && "transition-shadow duration-300",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

// ── Card sub-components ───────────────────────────────────────────────────────

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 mb-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-semibold text-zinc-100 leading-snug", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-zinc-400 leading-relaxed", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 mt-4 pt-4 border-t border-white/[0.05]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
