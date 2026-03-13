import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { TemplateCard } from "@/components/gallery/template-card";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Code2,
  Layers,
  Palette,
  Terminal,
  Unlock,
  ArrowRight,
  CheckCircle,
  Star,
  MousePointerClick,
  Video,
  Sparkles,
  MessageSquare,
  Eye,
  EyeOff,
  Mic,
  BarChart3,
  Share2,
  GitBranch,
  Type,
  Play,
} from "lucide-react";

// ── Shared template data ──────────────────────────────────────────────────────

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

// ── Product pillars ──────────────────────────────────────────────────────────

const PILLARS = [
  {
    icon: <Video className="w-6 h-6" />,
    title: "Launch Videos",
    description:
      "Apple-quality product videos from 6 cinematic templates. 60fps canvas rendering, one-click MP4 export up to 4K.",
    href: "/templates",
    cta: "Browse Templates",
    color: "violet",
  },
  {
    icon: <MousePointerClick className="w-6 h-6" />,
    title: "Interactive Demos",
    description:
      "Click-through product tours with hotspots, callouts, chapters, and branching. Like Arcade — but open-source.",
    href: "/demo",
    cta: "Build a Demo",
    color: "blue",
  },
  {
    icon: <Sparkles className="w-6 h-6" />,
    title: "Enhance Recordings",
    description:
      "Upload any screen recording and get cinematic zoom, smooth cursor, device frames, and background music — automatically.",
    href: "/enhance",
    cta: "Enhance a Recording",
    color: "emerald",
  },
];

const pillarGlowMap: Record<string, string> = {
  violet:
    "hover:border-violet-500/25 hover:shadow-[0_0_40px_rgba(139,92,246,0.12)]",
  blue: "hover:border-blue-500/25 hover:shadow-[0_0_40px_rgba(59,130,246,0.12)]",
  emerald:
    "hover:border-emerald-500/25 hover:shadow-[0_0_40px_rgba(16,185,129,0.12)]",
};

const pillarIconBgMap: Record<string, string> = {
  violet: "bg-violet-500/10 text-violet-400",
  blue: "bg-blue-500/10 text-blue-400",
  emerald: "bg-emerald-500/10 text-emerald-400",
};

// ── Demo features ────────────────────────────────────────────────────────────

const DEMO_FEATURES = [
  {
    icon: <MousePointerClick className="w-5 h-5" />,
    title: "Click-Through Steps",
    description:
      "Auto-detect steps from screen recordings or build manually. Viewers click through at their own pace.",
    color: "blue",
  },
  {
    icon: <Play className="w-5 h-5" />,
    title: "Hotspots & Tooltips",
    description:
      "Pulse, highlight, outline, or arrow styles. Hover for tooltips, click to advance or branch.",
    color: "violet",
  },
  {
    icon: <MessageSquare className="w-5 h-5" />,
    title: "Callouts & Annotations",
    description:
      "Tooltip, badge, numbered, and arrow callouts. Support {{variables}} for personalization.",
    color: "rose",
  },
  {
    icon: <GitBranch className="w-5 h-5" />,
    title: "Chapters & Branching",
    description:
      "Group steps into chapters. Hotspot clicks can branch to any step for non-linear flows.",
    color: "emerald",
  },
  {
    icon: <Type className="w-5 h-5" />,
    title: "Page Morph",
    description:
      "Edit text and swap images directly in screenshots. Perfect for personalizing demos on the fly.",
    color: "amber",
  },
  {
    icon: <EyeOff className="w-5 h-5" />,
    title: "Blur & Mask",
    description:
      "Hide sensitive content with blur, solid mask, or pixelate. Draw regions, resize, reposition.",
    color: "teal",
  },
  {
    icon: <Mic className="w-5 h-5" />,
    title: "Voiceover",
    description:
      "Auto-generate speech per step via Web Speech API. Pick voice, rate, pitch — mix with background music.",
    color: "rose",
  },
  {
    icon: <Share2 className="w-5 h-5" />,
    title: "Embed Anywhere",
    description:
      "Export as self-contained HTML, iframe embed, or React component. Responsive, interactive, lightweight.",
    color: "blue",
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: "Analytics",
    description:
      "Track step views, hotspot clicks, completion rate, drop-off points, and branch paths. Export CSV/JSON.",
    color: "violet",
  },
];

// ── Tech features ────────────────────────────────────────────────────────────

const TECH_FEATURES = [
  {
    icon: <Zap className="w-5 h-5" />,
    title: "60fps Canvas Rendering",
    description:
      "Hardware-accelerated, butter-smooth animations. Every frame rendered with precision using the Canvas 2D API.",
    color: "violet",
  },
  {
    icon: <Code2 className="w-5 h-5" />,
    title: "WebCodecs Export",
    description:
      "Client-side H.264 encoding via the WebCodecs API. No server needed, no upload, complete privacy.",
    color: "blue",
  },
  {
    icon: <Eye className="w-5 h-5" />,
    title: "Smart Video Analysis",
    description:
      "Auto-detect scenes, clicks, and cursor movement from screen recordings using frame differencing.",
    color: "emerald",
  },
  {
    icon: <Palette className="w-5 h-5" />,
    title: "Design Token System",
    description:
      "One-click theme switching across 6 cinematic palettes. Pixel-perfect color and typography.",
    color: "rose",
  },
  {
    icon: <Terminal className="w-5 h-5" />,
    title: "CLI + Web",
    description:
      "Run `npx create-spotlight-video` for programmatic workflows or use the visual webapp editor.",
    color: "amber",
  },
  {
    icon: <Unlock className="w-5 h-5" />,
    title: "Open Source",
    description:
      "AGPL core, MIT templates, free forever. Inspect, fork, and contribute on GitHub.",
    color: "teal",
  },
];

const featureGlowMap: Record<string, string> = {
  violet:
    "hover:border-violet-500/25 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)]",
  blue: "hover:border-blue-500/25 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]",
  emerald:
    "hover:border-emerald-500/25 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]",
  rose: "hover:border-rose-500/25 hover:shadow-[0_0_30px_rgba(244,63,94,0.1)]",
  amber:
    "hover:border-amber-500/25 hover:shadow-[0_0_30px_rgba(245,158,11,0.1)]",
  teal: "hover:border-teal-500/25 hover:shadow-[0_0_30px_rgba(20,184,166,0.1)]",
};

const featureIconBgMap: Record<string, string> = {
  violet: "bg-violet-500/10 text-violet-400",
  blue: "bg-blue-500/10 text-blue-400",
  emerald: "bg-emerald-500/10 text-emerald-400",
  rose: "bg-rose-500/10 text-rose-400",
  amber: "bg-amber-500/10 text-amber-400",
  teal: "bg-teal-500/10 text-teal-400",
};

// ── Comparison ───────────────────────────────────────────────────────────────

const COMPARISON = [
  { feature: "Interactive click-through demos", spotlight: true, arcade: true },
  { feature: "Hotspots & callouts", spotlight: true, arcade: true },
  { feature: "Chapters & branching", spotlight: true, arcade: true },
  { feature: "Page morph (edit screenshots)", spotlight: true, arcade: true },
  { feature: "Blur & mask sensitive data", spotlight: true, arcade: true },
  { feature: "Embeddable player widget", spotlight: true, arcade: true },
  { feature: "Voiceover narration", spotlight: true, arcade: true },
  { feature: "Analytics & tracking", spotlight: true, arcade: true },
  { feature: "Cinematic launch videos", spotlight: true, arcade: false },
  { feature: "Screen recording enhancement", spotlight: true, arcade: false },
  { feature: "6 video templates", spotlight: true, arcade: false },
  { feature: "4K 60fps export", spotlight: true, arcade: false },
  { feature: "Open-source (AGPL)", spotlight: true, arcade: false },
  { feature: "No watermark", spotlight: true, arcade: false },
  { feature: "Runs entirely in-browser", spotlight: true, arcade: false },
  { feature: "Free forever", spotlight: true, arcade: false },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <Navbar />

      <main>
        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-14">
          {/* Background orbs */}
          <div
            className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] opacity-40"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(124,58,237,0.35) 0%, rgba(99,102,241,0.15) 40%, transparent 70%)",
              filter: "blur(60px)",
              animation: "orbFloat 12s ease-in-out infinite",
            }}
          />
          <div
            className="absolute top-1/3 left-1/4 w-[400px] h-[400px] opacity-20"
            style={{
              background:
                "radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)",
              filter: "blur(80px)",
              animation: "orbFloat 16s ease-in-out infinite reverse",
            }}
          />
          <div
            className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] opacity-20"
            style={{
              background:
                "radial-gradient(circle, rgba(244,63,94,0.3) 0%, transparent 70%)",
              filter: "blur(70px)",
              animation: "orbFloat 10s ease-in-out infinite",
            }}
          />

          {/* Dot grid */}
          <div className="absolute inset-0 dot-grid opacity-40" />

          {/* Radial fade mask */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 0%, #09090b 80%)",
            }}
          />

          {/* Hero content */}
          <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-500/10 border border-accent-500/20 text-accent-400 text-sm mb-8 animate-fade-in">
              <Star className="w-3.5 h-3.5 fill-current" />
              Open-source Arcade alternative · Free forever
            </div>

            {/* Headline */}
            <h1
              className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white leading-[1.05] tracking-tight mb-6"
              style={{ animationDelay: "0.1s" }}
            >
              Launch videos &amp;
              <br />
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #a78bfa 0%, #818cf8 45%, #60a5fa 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                interactive demos
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10">
              Cinematic product videos, click-through demos, screen recording
              enhancement — all open-source, all in your browser. The Arcade
              alternative that does more.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/demo">
                <Button variant="primary" size="lg">
                  Build a Demo
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/enhance">
                <button className="group flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/[0.1] bg-white/[0.03] text-zinc-300 text-sm hover:border-white/[0.2] hover:bg-white/[0.06] hover:text-white transition-all duration-200">
                  <Sparkles className="w-4 h-4 text-accent-400" />
                  Enhance a Recording
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity -ml-1" />
                </button>
              </Link>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs text-zinc-500">
              {[
                "No watermark",
                "No account needed",
                "Runs in your browser",
                "4K export",
                "Arcade-complete",
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30 animate-bounce">
            <div className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center pt-1.5">
              <div className="w-1 h-2 rounded-full bg-white/60" />
            </div>
          </div>
        </section>

        {/* ── SOCIAL PROOF STRIP ───────────────────────────────────────────── */}
        <section className="border-y border-white/[0.05] py-10 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <p className="text-center text-sm text-zinc-500 mb-6">
              Trusted by teams shipping on
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
              {[
                "Product Hunt",
                "Y Combinator",
                "Indie Hackers",
                "Hacker News",
                "Ship It",
              ].map((brand) => (
                <span
                  key={brand}
                  className="text-zinc-600 font-semibold text-sm tracking-wide hover:text-zinc-400 transition-colors cursor-default"
                >
                  {brand}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── THREE PILLARS ──────────────────────────────────────────────── */}
        <section className="py-24 sm:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-accent-400 uppercase tracking-widest mb-3">
                One platform, three superpowers
              </p>
              <h2 className="font-display text-4xl sm:text-5xl text-white mb-4">
                Everything your launch needs
              </h2>
              <p className="text-zinc-400 max-w-xl mx-auto">
                Videos, interactive demos, and screen recording enhancement —
                all in one open-source toolkit.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {PILLARS.map((pillar) => (
                <Link
                  key={pillar.href}
                  href={pillar.href}
                  className={`group p-8 rounded-2xl bg-surface-1 border border-white/[0.06] transition-all duration-300 hover:-translate-y-1 ${pillarGlowMap[pillar.color]}`}
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${pillarIconBgMap[pillar.color]}`}
                  >
                    {pillar.icon}
                  </div>
                  <h3 className="font-semibold text-zinc-100 text-xl mb-3">
                    {pillar.title}
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                    {pillar.description}
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-sm text-accent-400 group-hover:gap-2.5 transition-all">
                    {pillar.cta}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── INTERACTIVE DEMOS DEEP DIVE ────────────────────────────────── */}
        <section className="py-24 sm:py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface-1/50 to-transparent" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-accent-400 uppercase tracking-widest mb-3">
                Interactive Demos
              </p>
              <h2 className="font-display text-4xl sm:text-5xl text-white mb-4">
                The open-source{" "}
                <span
                  style={{
                    background:
                      "linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Arcade alternative
                </span>
              </h2>
              <p className="text-zinc-400 max-w-2xl mx-auto">
                Build click-through product tours from screen recordings.
                Hotspots, callouts, chapters, branching, voiceover, analytics —
                everything Arcade has, plus cinematic video export.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {DEMO_FEATURES.map((feature, idx) => (
                <div
                  key={idx}
                  className={`group p-6 rounded-2xl bg-surface-1 border border-white/[0.06] transition-all duration-300 hover:-translate-y-0.5 ${featureGlowMap[feature.color]}`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${featureIconBgMap[feature.color]}`}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold text-zinc-100 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link href="/demo">
                <Button variant="primary" size="md">
                  Build Your First Demo
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── TEMPLATES PREVIEW ────────────────────────────────────────────── */}
        <section className="py-24 sm:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-accent-400 uppercase tracking-widest mb-3">
                Video Templates
              </p>
              <h2 className="font-display text-4xl sm:text-5xl text-white mb-4">
                Every template, a masterpiece
              </h2>
              <p className="text-zinc-400 max-w-xl mx-auto">
                Six production-ready templates designed for every moment of your
                launch journey — from teasers to App Store previews.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {TEMPLATES.map((template, idx) => (
                <div
                  key={template.id}
                  style={{
                    animationDelay: `${idx * 60}ms`,
                    animationFillMode: "both",
                  }}
                >
                  <TemplateCard template={template} />
                </div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link href="/templates">
                <Button variant="outline" size="md">
                  View All Templates
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── ENHANCE RECORDING ──────────────────────────────────────────── */}
        <section className="py-24 sm:py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface-1/50 to-transparent" />

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs font-semibold text-accent-400 uppercase tracking-widest mb-3">
              Screen Recording Enhancement
            </p>
            <h2 className="font-display text-4xl sm:text-5xl text-white mb-4">
              Turn raw recordings into{" "}
              <span
                style={{
                  background:
                    "linear-gradient(135deg, #34d399 0%, #06b6d4 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                cinematic demos
              </span>
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto mb-12">
              Upload any screen recording. Spotlight auto-detects clicks and
              scenes, adds cinematic camera zoom, smooth cursor animation,
              device frames, background music, and exports a polished MP4 — all
              client-side.
            </p>

            <div className="grid sm:grid-cols-3 gap-6 text-left mb-10">
              {[
                {
                  title: "Auto-Analysis",
                  description:
                    "Detects scenes, clicks, and cursor paths from your raw recording using frame differencing.",
                },
                {
                  title: "Cinematic Polish",
                  description:
                    "Spring-physics camera zoom, smooth cursor trails, device frames, and 6 background music tracks.",
                },
                {
                  title: "One-Click Export",
                  description:
                    "H.264 encoding via WebCodecs. MP4 with audio, up to 4K 60fps, entirely in your browser.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-6 rounded-2xl bg-surface-1 border border-white/[0.06]"
                >
                  <h3 className="font-semibold text-zinc-100 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <Link href="/enhance">
              <Button variant="primary" size="md">
                Enhance a Recording
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* ── COMPARISON TABLE ────────────────────────────────────────────── */}
        <section className="py-24 sm:py-32">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold text-accent-400 uppercase tracking-widest mb-3">
                Spotlight vs Arcade
              </p>
              <h2 className="font-display text-4xl sm:text-5xl text-white mb-4">
                All the features.{" "}
                <span
                  style={{
                    background:
                      "linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  None of the price.
                </span>
              </h2>
            </div>

            <div className="rounded-2xl bg-surface-1 border border-white/[0.06] overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_80px_80px] gap-4 px-6 py-4 border-b border-white/[0.06] text-sm font-semibold">
                <span className="text-zinc-400">Feature</span>
                <span className="text-center text-accent-400">Spotlight</span>
                <span className="text-center text-zinc-500">Arcade</span>
              </div>

              {/* Rows */}
              {COMPARISON.map((row, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-[1fr_80px_80px] gap-4 px-6 py-3 text-sm ${
                    idx % 2 === 0 ? "bg-white/[0.01]" : ""
                  } ${!row.arcade ? "bg-emerald-500/[0.03]" : ""}`}
                >
                  <span className="text-zinc-300">{row.feature}</span>
                  <span className="text-center">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                  </span>
                  <span className="text-center">
                    {row.arcade ? (
                      <CheckCircle className="w-4 h-4 text-zinc-600 mx-auto" />
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </span>
                </div>
              ))}

              {/* Footer */}
              <div className="grid grid-cols-[1fr_80px_80px] gap-4 px-6 py-4 border-t border-white/[0.06] text-sm font-semibold">
                <span className="text-zinc-400">Price</span>
                <span className="text-center text-emerald-400">Free</span>
                <span className="text-center text-zinc-500">$32/mo+</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── TECH FEATURES GRID ─────────────────────────────────────────── */}
        <section className="py-24 sm:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-semibold text-accent-400 uppercase tracking-widest mb-3">
                Under the hood
              </p>
              <h2 className="font-display text-4xl sm:text-5xl text-white mb-4">
                Built different
              </h2>
              <p className="text-zinc-400 max-w-xl mx-auto">
                Modern browser APIs, zero server dependencies, obsessive
                attention to detail.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {TECH_FEATURES.map((feature, idx) => (
                <div
                  key={idx}
                  className={`group p-6 rounded-2xl bg-surface-1 border border-white/[0.06] transition-all duration-300 hover:-translate-y-0.5 ${featureGlowMap[feature.color]}`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${featureIconBgMap[feature.color]}`}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold text-zinc-100 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA SECTION ──────────────────────────────────────────────────── */}
        <section className="py-24 sm:py-32 relative overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(124,58,237,0.08) 0%, transparent 70%)",
            }}
          />
          <div className="absolute inset-0 border-y border-white/[0.04]" />

          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="font-display text-4xl sm:text-5xl md:text-6xl text-white mb-6 leading-tight">
              Your next launch deserves
              <br />
              more than a screen recording.
            </h2>
            <p className="text-zinc-400 text-lg mb-10">
              Free forever. No watermark. No account.
              <br />
              Videos, interactive demos, and enhanced recordings — start in
              seconds.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/demo">
                <Button variant="primary" size="lg">
                  Build a Demo
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="/templates">
                <Button variant="outline" size="lg">
                  Browse Templates
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
