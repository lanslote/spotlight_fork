"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock, Monitor, Smartphone, Square } from "lucide-react";

export interface TemplateData {
  id: string;
  name: string;
  category: string;
  description: string;
  durationRange: string;
  aspectRatios: string[];
  gradient: [string, string];
}

const categoryVariants: Record<string, "default" | "success" | "warning" | "info" | "danger" | "purple"> = {
  "Product Launch": "purple",
  Feature: "info",
  Social: "warning",
  Landing: "success",
  Changelog: "default",
  "App Store": "danger",
};

const aspectIcons: Record<string, React.ReactNode> = {
  "16:9": <Monitor className="w-3 h-3" />,
  "9:16": <Smartphone className="w-3 h-3" />,
  "1:1":  <Square className="w-3 h-3" />,
};

interface TemplateCardProps {
  template: TemplateData;
  className?: string;
}

export function TemplateCard({ template, className }: TemplateCardProps) {
  const badgeVariant = categoryVariants[template.category] ?? "default";

  return (
    <Link
      href={`/editor/${template.id}`}
      className={cn(
        "group relative flex flex-col rounded-2xl overflow-hidden",
        "bg-surface-1 border border-white/[0.06]",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:border-white/[0.12]",
        "hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)]",
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        {/* Gradient background */}
        <div
          className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
          style={{
            background: `linear-gradient(135deg, ${template.gradient[0]} 0%, ${template.gradient[1]} 100%)`,
          }}
        />

        {/* Animated overlay shimmer */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-20 mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Decorative play indicator / mockup lines */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-30 group-hover:opacity-60 transition-opacity duration-300">
          {/* Mock screen content */}
          <div className="w-2/3 space-y-2">
            <div className="h-3 rounded-full bg-white/40 w-full" />
            <div className="h-2 rounded-full bg-white/25 w-4/5" />
            <div className="h-2 rounded-full bg-white/25 w-3/5" />
          </div>
        </div>

        {/* "Use Template" hover overlay */}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
          <span className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium text-white">
            Use Template
            <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>

        {/* Glow border on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 0 1px ${template.gradient[0]}40`,
          }}
        />
      </div>

      {/* Card info */}
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100 leading-snug group-hover:text-white transition-colors">
            {template.name}
          </h3>
          <Badge variant={badgeVariant} className="shrink-0">
            {template.category}
          </Badge>
        </div>

        <p className="text-xs text-zinc-500 leading-relaxed">
          {template.description}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-3 pt-1">
          <span className="flex items-center gap-1 text-[11px] text-zinc-500">
            <Clock className="w-3 h-3" />
            {template.durationRange}
          </span>
          <div className="flex items-center gap-1">
            {template.aspectRatios.map((ratio) => (
              <span
                key={ratio}
                className="flex items-center gap-0.5 text-[11px] text-zinc-500 bg-surface-3 px-1.5 py-0.5 rounded"
              >
                {aspectIcons[ratio]}
                {ratio}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom accent line that grows on hover */}
      <div
        className="absolute bottom-0 inset-x-0 h-[2px] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"
        style={{
          background: `linear-gradient(90deg, ${template.gradient[0]}, ${template.gradient[1]})`,
        }}
      />
    </Link>
  );
}
