/**
 * Zod Schemas for Template Props
 *
 * Every public-facing template validates its input through these schemas before
 * generating scenes, catching bad data at the boundary rather than deep inside
 * animation logic where errors are harder to debug.
 */

import { z } from "zod";

// ─── Shared primitives ────────────────────────────────────────────────────────

export const AspectRatioSchema = z.enum(["16:9", "9:16", "1:1"]);
export const ThemeSchema = z.enum(["midnight", "aurora", "ember", "frost", "noir", "sunset"]);

// ─── BaseTemplateProps ────────────────────────────────────────────────────────

export const BaseTemplatePropsSchema = z.object({
  /** Main product / brand name rendered in hero text */
  productName: z.string().min(1).max(60),
  /** Short, punchy tagline displayed beneath the product name */
  tagline: z.string().min(1).max(120),
  /** Color theme for the entire video */
  theme: ThemeSchema.default("midnight"),
  /** Canvas aspect ratio */
  aspectRatio: AspectRatioSchema.default("16:9"),
  /** Total video duration in seconds */
  duration: z.number().positive().default(30),
});

export type BaseTemplateProps = z.infer<typeof BaseTemplatePropsSchema>;

// ─── ProductHuntProps ─────────────────────────────────────────────────────────

export const FeatureItemSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(200),
  /** Emoji or icon identifier (passed through to renderer as text) */
  icon: z.string().max(4).default("✦"),
});

export type FeatureItem = z.infer<typeof FeatureItemSchema>;

export const ProductHuntPropsSchema = BaseTemplatePropsSchema.extend({
  /** Short supporting subtitle shown in the opening scene */
  subtitle: z.string().max(160).default(""),
  /** Up to 3 feature cards showcased in dedicated scenes */
  features: z.array(FeatureItemSchema).min(1).max(3),
  websiteUrl: z.string().url().or(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}/i)),
  /** Optional hero product image asset reference */
  productImage: z.string().optional(),
  ctaText: z.string().max(50).default("Try it free"),
});

export type ProductHuntProps = z.infer<typeof ProductHuntPropsSchema>;

// ─── FeatureAnnounceProps ─────────────────────────────────────────────────────

export const FeatureAnnouncePropsSchema = BaseTemplatePropsSchema.extend({
  /** Semantic version string, e.g. "2.4.0" */
  version: z.string().regex(/^\d+\.\d+(\.\d+)?(-[a-z0-9.]+)?$/i),
  featureTitle: z.string().min(1).max(80),
  featureDescription: z.string().min(1).max(300),
  /**
   * Optional before/after state for the demo scene.
   * Strings are treated as display labels; if omitted the scene shows a
   * generic product screenshot placeholder.
   */
  beforeAfter: z
    .object({
      beforeLabel: z.string().max(60),
      afterLabel: z.string().max(60),
    })
    .optional(),
  /** Up to 4 short highlight bullets shown in the summary scene */
  highlights: z.array(z.string().max(80)).max(4).default([]),
});

export type FeatureAnnounceProps = z.infer<typeof FeatureAnnouncePropsSchema>;

// ─── SocialTeaserProps ────────────────────────────────────────────────────────

export const SocialTeaserPropsSchema = BaseTemplatePropsSchema.extend({
  /** Large attention-grabbing hook line shown at the top */
  hookText: z.string().min(1).max(80),
  /** Supporting body copy (kept intentionally short for social) */
  bodyText: z.string().max(160).default(""),
  ctaText: z.string().max(50).default("Learn more"),
});

export type SocialTeaserProps = z.infer<typeof SocialTeaserPropsSchema>;

// ─── LandingHeroProps ─────────────────────────────────────────────────────────

export const LandingHeroPropsSchema = BaseTemplatePropsSchema.extend({
  headline: z.string().min(1).max(80),
  subheadline: z.string().max(160).default(""),
  /** Short feature phrases that cycle in Scene 2 */
  features: z.array(z.string().max(60)).min(1).max(6),
  ctaText: z.string().max(50).default("Get started"),
});

export type LandingHeroProps = z.infer<typeof LandingHeroPropsSchema>;

// ─── ChangelogProps ───────────────────────────────────────────────────────────

export const ChangeTypeSchema = z.enum(["added", "improved", "fixed"]);

export const ChangeItemSchema = z.object({
  type: ChangeTypeSchema,
  text: z.string().min(1).max(120),
});

export type ChangeItem = z.infer<typeof ChangeItemSchema>;

export const ChangelogPropsSchema = BaseTemplatePropsSchema.extend({
  version: z.string().regex(/^\d+\.\d+(\.\d+)?(-[a-z0-9.]+)?$/i),
  /** ISO 8601 date string (YYYY-MM-DD) */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Up to 8 changelog entries; more would exceed comfortable video duration */
  changes: z.array(ChangeItemSchema).min(1).max(8),
});

export type ChangelogProps = z.infer<typeof ChangelogPropsSchema>;

// ─── AppStorePreviewProps ─────────────────────────────────────────────────────

export const AppStorePreviewPropsSchema = BaseTemplatePropsSchema.extend({
  /** Asset reference for the app icon (path / URL / color string fallback) */
  appIcon: z.string().min(1),
  /** Up to 3 screenshot asset references shown in phone mockups */
  screenshots: z.array(z.string()).min(1).max(3),
  appName: z.string().min(1).max(30),
  appDescription: z.string().max(200).default(""),
});

export type AppStorePreviewProps = z.infer<typeof AppStorePreviewPropsSchema>;

// ─── ScreenRecordingProps ───────────────────────────────────────────────────

export const DeviceFrameSchema = z.enum([
  "none", "browser", "minimal", "iphone", "macbook", "ipad",
]);

export const BackgroundPresetSchema = z.enum([
  "midnight-gradient", "aurora-gradient", "ember-gradient",
  "frost-gradient", "noir", "clean-white", "blurred",
]);

export const CursorStyleSchema = z.enum([
  "default", "pointer", "dot", "ring", "crosshair",
]);

export const ScreenRecordingPropsSchema = BaseTemplatePropsSchema.extend({
  /** The source video file (handled separately — not serialised) */
  videoUrl: z.string().optional(),
  /** Device frame to wrap the recording */
  deviceFrame: DeviceFrameSchema.default("browser"),
  /** Background preset */
  backgroundPreset: BackgroundPresetSchema.default("midnight-gradient"),
  /** Cursor replacement style */
  cursorStyle: CursorStyleSchema.default("dot"),
  /** Cursor size in px */
  cursorSize: z.number().min(8).max(64).default(20),
  /** Whether to show click ripple effects */
  showClickRipples: z.boolean().default(true),
  /** Whether to enable auto-zoom on clicks */
  autoZoom: z.boolean().default(true),
  /** Auto-zoom level (1.0 – 3.0) */
  zoomLevel: z.number().min(1).max(3).default(2.0),
  /** Whether to enable cursor trail */
  showCursorTrail: z.boolean().default(true),
  /** Whether to add film grain effect */
  filmGrain: z.boolean().default(false),
  /** Film grain intensity (0 – 1) */
  grainIntensity: z.number().min(0).max(1).default(0.03),
  /** Whether to enable focus blur (depth-of-field) */
  focusBlur: z.boolean().default(false),
  /** Text overlays (serialised as JSON) */
  textOverlays: z.array(z.object({
    text: z.string().max(200),
    startTime: z.number().min(0),
    endTime: z.number().min(0),
    position: z.enum(["top", "bottom", "center"]).default("bottom"),
    animation: z.enum(["fade", "slide-up", "slide-down", "typewriter"]).default("fade"),
  })).default([]),
  /** Background music track ID (from bundled library) */
  musicTrack: z.string().optional(),
  /** Music volume (0 – 1) */
  musicVolume: z.number().min(0).max(1).default(0.3),
  /** Whether to include click sound effects */
  clickSounds: z.boolean().default(false),
});

export type ScreenRecordingProps = z.infer<typeof ScreenRecordingPropsSchema>;
