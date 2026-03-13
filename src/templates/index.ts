/**
 * Spotlight Template System — root barrel export
 *
 * Import from "@/templates" to access the complete template system:
 *   - Types (Scene, SceneElement, etc.)
 *   - Design tokens (colors, typography, animation)
 *   - Animation primitives (text reveal, gradients, devices, particles)
 *   - Zod schemas and TypeScript types for all template props
 *   - Individual template generators
 *   - Template registry (getTemplate, getAllTemplates, etc.)
 */

// ── Core types ─────────────────────────────────────────────────────────────────
export type { Scene, SceneElement, AspectRatio, CanvasDimensions, TemplateMetadata } from "./types";
export { getCanvasDimensions } from "./types";

// ── Design tokens ──────────────────────────────────────────────────────────────
export * from "./tokens";

// ── Animation primitives ───────────────────────────────────────────────────────
export * from "./primitives";

// ── Zod schemas & TypeScript prop types ───────────────────────────────────────
export {
  AspectRatioSchema,
  ThemeSchema,
  BaseTemplatePropsSchema,
  ProductHuntPropsSchema,
  FeatureAnnouncePropsSchema,
  SocialTeaserPropsSchema,
  LandingHeroPropsSchema,
  ChangelogPropsSchema,
  AppStorePreviewPropsSchema,
  FeatureItemSchema,
  ChangeItemSchema,
  ChangeTypeSchema,
} from "./schemas";

export type {
  BaseTemplateProps,
  ProductHuntProps,
  FeatureAnnounceProps,
  SocialTeaserProps,
  LandingHeroProps,
  ChangelogProps,
  AppStorePreviewProps,
  FeatureItem,
  ChangeItem,
} from "./schemas";

// ── Template generators ────────────────────────────────────────────────────────
export { generateProductHunt } from "./product-hunt";
export { generateFeatureAnnounce } from "./feature-announce";
export { generateSocialTeaser } from "./social-teaser";
export { generateLandingHero } from "./landing-hero";
export { generateChangelog } from "./changelog";
export { generateAppStorePreview } from "./app-store-preview";

// ── Registry ───────────────────────────────────────────────────────────────────
export {
  getTemplate,
  getAllTemplates,
  getTemplatesByCategory,
  getAllTemplateMetadata,
} from "./registry";

export type { TemplateEntry } from "./registry";
