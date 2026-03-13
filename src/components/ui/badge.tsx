import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "info" | "danger" | "purple" | "outline";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:  "bg-zinc-800/80 text-zinc-300 border-zinc-700/60",
  success:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  info:     "bg-sky-500/10 text-sky-400 border-sky-500/20",
  danger:   "bg-rose-500/10 text-rose-400 border-rose-500/20",
  purple:   "bg-violet-500/10 text-violet-400 border-violet-500/20",
  outline:  "bg-transparent text-zinc-300 border-white/10",
};

const dotVariantClasses: Record<BadgeVariant, string> = {
  default:  "bg-zinc-400",
  success:  "bg-emerald-400",
  warning:  "bg-amber-400",
  info:     "bg-sky-400",
  danger:   "bg-rose-400",
  purple:   "bg-violet-400",
  outline:  "bg-zinc-400",
};

export function Badge({
  children,
  variant = "default",
  className,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border",
        "whitespace-nowrap",
        variantClasses[variant],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            dotVariantClasses[variant]
          )}
        />
      )}
      {children}
    </span>
  );
}
