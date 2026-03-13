import { cn } from "@/lib/utils";
import { TemplateCard, type TemplateData } from "./template-card";

interface TemplateGridProps {
  templates: TemplateData[];
  className?: string;
}

export function TemplateGrid({ templates, className }: TemplateGridProps) {
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-white/[0.06] flex items-center justify-center mb-4">
          <svg
            className="w-7 h-7 text-zinc-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
            />
          </svg>
        </div>
        <p className="text-zinc-400 text-sm">No templates found</p>
        <p className="text-zinc-600 text-xs mt-1">
          Try selecting a different category
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-5",
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {templates.map((template, idx) => (
        <div
          key={template.id}
          className="animate-in fade-in slide-in-from-bottom-2"
          style={{ animationDelay: `${idx * 60}ms`, animationFillMode: "both" }}
        >
          <TemplateCard template={template} />
        </div>
      ))}
    </div>
  );
}
