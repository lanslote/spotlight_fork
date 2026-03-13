/**
 * Template Registry
 *
 * Central catalogue of all Spotlight templates. Each entry provides:
 *  - Static metadata for the UI (name, description, thumbnail, etc.)
 *  - Default props the editor pre-populates on template selection
 *  - A `generate` function that validates input with Zod then produces scenes
 *
 * Usage:
 *   const template = getTemplate("product-hunt");
 *   const scenes = template.generate(myProps);
 */

import type { Scene, TemplateMetadata } from "./types";

import { ProductHuntPropsSchema, type ProductHuntProps } from "./schemas";
import { FeatureAnnouncePropsSchema, type FeatureAnnounceProps } from "./schemas";
import { SocialTeaserPropsSchema, type SocialTeaserProps } from "./schemas";
import { LandingHeroPropsSchema, type LandingHeroProps } from "./schemas";
import { ChangelogPropsSchema, type ChangelogProps } from "./schemas";
import { AppStorePreviewPropsSchema, type AppStorePreviewProps } from "./schemas";
import { ScreenRecordingPropsSchema, type ScreenRecordingProps } from "./schemas";

import { generateProductHunt } from "./product-hunt";
import { generateFeatureAnnounce } from "./feature-announce";
import { generateSocialTeaser } from "./social-teaser";
import { generateLandingHero } from "./landing-hero";
import { generateChangelog } from "./changelog";
import { generateAppStorePreview } from "./app-store-preview";

// ─── Registry entry shape ─────────────────────────────────────────────────────

export interface TemplateRegistryEntry<TProps = unknown> {
  metadata: TemplateMetadata;
  /** Props the editor shows on first load */
  defaultProps: TProps;
  /**
   * Validates `rawProps` with the template's Zod schema, then generates the
   * scene array. Throws a ZodError if validation fails.
   */
  generate: (rawProps: unknown) => Scene[];
}

// ─── Default props ────────────────────────────────────────────────────────────

const defaultBase = {
  productName: "Spotlight",
  tagline: "Apple-quality product videos. In minutes.",
  theme: "midnight" as const,
  aspectRatio: "16:9" as const,
};

const defaultProductHunt: ProductHuntProps = {
  ...defaultBase,
  duration: 40,
  subtitle: "The open-source product video tool",
  features: [
    {
      title: "Beautiful Templates",
      description:
        "Six professionally designed templates inspired by Apple, Linear, and Stripe. Every frame is cinematic.",
      icon: "✦",
    },
    {
      title: "Canvas Renderer",
      description:
        "60fps canvas-based rendering engine exports broadcast-quality MP4 videos directly in the browser.",
      icon: "◈",
    },
    {
      title: "One-Click Export",
      description:
        "Export to any format or aspect ratio with a single click. No external tools, no subscriptions.",
      icon: "→",
    },
  ],
  websiteUrl: "spotlight.dev",
  ctaText: "Try it free",
};

const defaultFeatureAnnounce: FeatureAnnounceProps = {
  ...defaultBase,
  duration: 28,
  version: "2.0.0",
  featureTitle: "One-Click Export",
  featureDescription:
    "Export broadcast-quality MP4 videos at 60fps directly from the browser. No plugins, no installs — just click and download.",
  beforeAfter: {
    beforeLabel: "Manual video editing",
    afterLabel: "Spotlight export",
  },
  highlights: [
    "Up to 4K resolution",
    "60fps smooth playback",
    "Instant browser export",
    "No external tools",
  ],
};

const defaultSocialTeaser: SocialTeaserProps = {
  ...defaultBase,
  aspectRatio: "9:16",
  duration: 25,
  hookText: "Stop making boring product videos.",
  bodyText: "Spotlight turns your product into a cinematic story — in minutes.",
  ctaText: "Start for free →",
};

const defaultLandingHero: LandingHeroProps = {
  ...defaultBase,
  duration: 22,
  headline: "Product videos that actually sell.",
  subheadline:
    "Spotlight is the open-source tool for creating Apple-quality launch videos — right in the browser.",
  features: [
    "Six cinematic templates",
    "60fps canvas renderer",
    "One-click MP4 export",
    "Fully open-source",
    "Works in the browser",
    "No design skills needed",
  ],
  ctaText: "Get started free",
};

const defaultChangelog: ChangelogProps = {
  ...defaultBase,
  duration: 35,
  version: "2.1.0",
  date: "2026-03-12",
  changes: [
    { type: "added", text: "Six new cinematic video templates" },
    { type: "added", text: "Canvas-based 60fps rendering engine" },
    { type: "improved", text: "Export pipeline is now 3× faster" },
    { type: "improved", text: "Template editor UI redesigned from scratch" },
    { type: "fixed", text: "Animation keyframes now interpolate correctly at scene boundaries" },
    { type: "fixed", text: "Gradient stops render accurately in all browsers" },
  ],
};

const defaultAppStorePreview: AppStorePreviewProps = {
  ...defaultBase,
  aspectRatio: "9:16",
  duration: 32,
  appIcon: "#6366f1",
  screenshots: ["#6366f1", "#10b981", "#f43f5e"],
  appName: "Spotlight",
  appDescription: "Create Apple-quality product launch videos in minutes.",
};

const defaultScreenRecording: ScreenRecordingProps = {
  ...defaultBase,
  duration: 30,
  deviceFrame: "browser",
  backgroundPreset: "midnight-gradient",
  cursorStyle: "dot",
  cursorSize: 20,
  showClickRipples: true,
  autoZoom: true,
  zoomLevel: 2.0,
  showCursorTrail: true,
  filmGrain: false,
  grainIntensity: 0.03,
  focusBlur: false,
  textOverlays: [],
  musicVolume: 0.3,
  clickSounds: false,
};

// ─── Registry ─────────────────────────────────────────────────────────────────

const registryMap: Record<string, TemplateRegistryEntry> = {
  "product-hunt": {
    metadata: {
      id: "product-hunt",
      name: "Product Hunt Launch",
      description:
        "A dramatic 6-act launch video for Product Hunt. Features problem statement, feature showcases in device mockups, and a memorable CTA.",
      category: "launch",
      defaultDuration: 40,
      durationRange: [30, 60],
      supportedAspectRatios: ["16:9"],
      thumbnailGradient: ["#050818", "#6366f1", "#a78bfa"],
    },
    defaultProps: defaultProductHunt,
    generate: (rawProps) => {
      const props = ProductHuntPropsSchema.parse(rawProps);
      return generateProductHunt(props);
    },
  },

  "feature-announce": {
    metadata: {
      id: "feature-announce",
      name: "Feature Announcement",
      description:
        "A focused, high-impact video for announcing a single feature. Includes version badge, description, before/after demo, and summary.",
      category: "feature",
      defaultDuration: 28,
      durationRange: [15, 45],
      supportedAspectRatios: ["16:9"],
      thumbnailGradient: ["#010d0a", "#10b981", "#2dd4bf"],
    },
    defaultProps: defaultFeatureAnnounce,
    generate: (rawProps) => {
      const props = FeatureAnnouncePropsSchema.parse(rawProps);
      return generateFeatureAnnounce(props);
    },
  },

  "social-teaser": {
    metadata: {
      id: "social-teaser",
      name: "Social Media Teaser",
      description:
        "A short, punchy vertical video for TikTok, Instagram Reels, and Twitter. Bold hook → showcase → benefit → CTA.",
      category: "social",
      defaultDuration: 25,
      durationRange: [15, 30],
      supportedAspectRatios: ["9:16", "1:1"],
      thumbnailGradient: ["#0d0005", "#f43f5e", "#fb923c"],
    },
    defaultProps: defaultSocialTeaser,
    generate: (rawProps) => {
      const props = SocialTeaserPropsSchema.parse(rawProps);
      return generateSocialTeaser(props);
    },
  },

  "landing-hero": {
    metadata: {
      id: "landing-hero",
      name: "Landing Page Hero",
      description:
        "A seamlessly looping hero video for website headers. Headline reveal → cycling features → smooth loop back.",
      category: "hero",
      defaultDuration: 22,
      durationRange: [10, 30],
      supportedAspectRatios: ["16:9"],
      thumbnailGradient: ["#f0f4ff", "#3b82f6", "#0ea5e9"],
    },
    defaultProps: defaultLandingHero,
    generate: (rawProps) => {
      const props = LandingHeroPropsSchema.parse(rawProps);
      return generateLandingHero(props);
    },
  },

  changelog: {
    metadata: {
      id: "changelog",
      name: "Changelog / Release Notes",
      description:
        "An editorial changelog video. Each change item gets its own animated scene with a type badge (Added / Improved / Fixed).",
      category: "changelog",
      defaultDuration: 35,
      durationRange: [15, 45],
      supportedAspectRatios: ["16:9"],
      thumbnailGradient: ["#000000", "#ffffff", "#a1a1aa"],
    },
    defaultProps: defaultChangelog,
    generate: (rawProps) => {
      const props = ChangelogPropsSchema.parse(rawProps);
      return generateChangelog(props);
    },
  },

  "app-store-preview": {
    metadata: {
      id: "app-store-preview",
      name: "App Store Preview",
      description:
        "A vertical App Store preview video. App icon reveal → screenshot showcases in phone mockups → download CTA.",
      category: "app-store",
      defaultDuration: 32,
      durationRange: [15, 30],
      supportedAspectRatios: ["9:16"],
      thumbnailGradient: ["#0d0005", "#f43f5e", "#6366f1"],
    },
    defaultProps: defaultAppStorePreview,
    generate: (rawProps) => {
      const props = AppStorePreviewPropsSchema.parse(rawProps);
      return generateAppStorePreview(props);
    },
  },
  "screen-recording": {
    metadata: {
      id: "screen-recording",
      name: "Screen Recording Enhancer",
      description:
        "Transform raw screen recordings into cinematic product videos. Auto-zoom on clicks, cursor smoothing, device mockups, gradient backgrounds, and text overlays — all client-side.",
      category: "enhance",
      defaultDuration: 30,
      durationRange: [5, 300],
      supportedAspectRatios: ["16:9", "9:16", "1:1"],
      thumbnailGradient: ["#1e1b4b", "#6366f1", "#a78bfa", "#c4b5fd"],
    },
    defaultProps: defaultScreenRecording,
    generate: (rawProps) => {
      // Screen recording doesn't generate template scenes — it enhances
      // uploaded video via the Compositor pipeline. Return an empty scene
      // array; the enhance page handles rendering directly.
      const props = ScreenRecordingPropsSchema.parse(rawProps);
      return [];
    },
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve a single template entry by ID.
 * Returns `undefined` if the ID is not registered.
 */
export function getTemplate(id: string): TemplateRegistryEntry | undefined {
  return registryMap[id];
}

/**
 * Retrieve all registered template entries in insertion order.
 */
export function getAllTemplates(): TemplateRegistryEntry[] {
  return Object.values(registryMap);
}

/**
 * Retrieve all templates belonging to a specific category.
 */
export function getTemplatesByCategory(
  category: TemplateMetadata["category"]
): TemplateRegistryEntry[] {
  return getAllTemplates().filter((t) => t.metadata.category === category);
}

/**
 * Returns just the metadata array — useful for rendering the template picker
 * grid without loading the heavy generate functions.
 */
export function getAllTemplateMetadata(): TemplateMetadata[] {
  return getAllTemplates().map((t) => t.metadata);
}

// Re-export the entry type for consumers
export type { TemplateRegistryEntry as TemplateEntry };
