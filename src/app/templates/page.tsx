"use client";

import { useState, useMemo } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { TemplateGrid } from "@/components/gallery/template-grid";
import { cn } from "@/lib/utils";
import { Search, Sparkles } from "lucide-react";

// ── Template data ─────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: "product-hunt",
    name: "Product Hunt Launch",
    category: "Product Launch",
    description: "Dramatic reveal for your PH launch day",
    durationRange: "30-60s",
    aspectRatios: ["16:9", "1:1"],
    gradient: ["#7c3aed", "#2563eb"] as [string, string],
  },
  {
    id: "feature-announce",
    name: "Feature Announcement",
    category: "Feature",
    description: "Showcase new features with style",
    durationRange: "15-45s",
    aspectRatios: ["16:9", "1:1"],
    gradient: ["#059669", "#06b6d4"] as [string, string],
  },
  {
    id: "social-teaser",
    name: "Social Teaser",
    category: "Social",
    description: "Scroll-stopping social media clips",
    durationRange: "15-30s",
    aspectRatios: ["9:16", "1:1"],
    gradient: ["#e11d48", "#f59e0b"] as [string, string],
  },
  {
    id: "landing-hero",
    name: "Landing Hero",
    category: "Landing",
    description: "Looping hero video for your site",
    durationRange: "10-30s",
    aspectRatios: ["16:9"],
    gradient: ["#8b5cf6", "#ec4899"] as [string, string],
  },
  {
    id: "changelog",
    name: "Changelog Update",
    category: "Changelog",
    description: "Beautiful version release videos",
    durationRange: "15-45s",
    aspectRatios: ["16:9", "1:1"],
    gradient: ["#3b82f6", "#6366f1"] as [string, string],
  },
  {
    id: "app-store",
    name: "App Store Preview",
    category: "App Store",
    description: "Vertical preview for iOS/Android stores",
    durationRange: "15-30s",
    aspectRatios: ["9:16"],
    gradient: ["#f43f5e", "#8b5cf6"] as [string, string],
  },
];

const CATEGORIES = ["All", "Product Launch", "Feature", "Social", "Landing", "Changelog", "App Store"];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return TEMPLATES.filter((t) => {
      const matchesCategory =
        activeCategory === "All" || t.category === activeCategory;
      const matchesSearch =
        !search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  return (
    <>
      <Navbar />

      <main className="min-h-screen pt-14">
        {/* Page header */}
        <section className="relative py-20 sm:py-28 overflow-hidden border-b border-white/[0.05]">
          {/* Background gradient */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background:
                "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(124,58,237,0.25) 0%, transparent 70%)",
            }}
          />
          <div className="absolute inset-0 dot-grid opacity-30" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/20 text-accent-400 text-xs font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              {TEMPLATES.length} premium templates
            </div>
            <h1 className="font-display text-5xl sm:text-6xl text-white mb-4">
              Templates
            </h1>
            <p className="text-zinc-400 text-lg max-w-xl mx-auto">
              Choose your starting point. Every template is fully customizable
              — edit content, colors, and timing in the live editor.
            </p>
          </div>
        </section>

        {/* Filter + search bar */}
        <div className="sticky top-14 z-40 bg-surface-0/90 backdrop-blur-xl border-b border-white/[0.05]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Category filter pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap",
                      activeCategory === cat
                        ? "bg-accent-500/20 text-accent-400 border border-accent-500/30"
                        : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] border border-transparent"
                    )}
                  >
                    {cat}
                    {cat !== "All" && (
                      <span className="ml-1.5 text-[10px] opacity-60">
                        {TEMPLATES.filter((t) => t.category === cat).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative sm:ml-auto w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search templates…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(
                    "w-full pl-8 pr-3 py-2 rounded-lg text-xs",
                    "bg-surface-2 border border-white/[0.06]",
                    "text-zinc-200 placeholder-zinc-600",
                    "focus:outline-none focus:border-accent-500/50",
                    "transition-colors"
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          {/* Result count */}
          <p className="text-xs text-zinc-600 mb-6">
            Showing{" "}
            <span className="text-zinc-400 font-medium">{filtered.length}</span>{" "}
            {filtered.length === 1 ? "template" : "templates"}
            {activeCategory !== "All" && (
              <>
                {" "}
                in{" "}
                <span className="text-zinc-400 font-medium">{activeCategory}</span>
              </>
            )}
          </p>

          <TemplateGrid templates={filtered} />
        </div>

        {/* Bottom CTA */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
          <div className="rounded-2xl bg-surface-1 border border-white/[0.06] p-10 text-center relative overflow-hidden">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background:
                  "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(124,58,237,0.3) 0%, transparent 70%)",
              }}
            />
            <div className="relative">
              <h3 className="font-display text-3xl text-white mb-3">
                Can&apos;t find what you need?
              </h3>
              <p className="text-zinc-400 mb-6 text-sm max-w-md mx-auto">
                More templates are on the way. Star the repo on GitHub and we&apos;ll
                notify you when new ones ship.
              </p>
              <a
                href="https://github.com/lanslote/spotlight_fork"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-zinc-200 text-sm hover:bg-white/[0.08] hover:border-white/[0.16] transition-all"
              >
                ⭐ Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
