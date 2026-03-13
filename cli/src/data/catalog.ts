/**
 * Spotlight — template & theme catalog
 *
 * Single source of truth for all available templates and visual themes.
 * Imported by every command that needs to present user choices.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AspectRatioOption {
  ratio: string;
  width: number;
  height: number;
  label: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  minDuration: number;
  maxDuration: number;
  aspectRatios: AspectRatioOption[];
  tags: string[];
}

export interface Theme {
  id: string;
  name: string;
  primaryColor: string;   // hex
  accentColor: string;    // hex
  backgroundColor: string; // hex
  description: string;
}

// ─── Aspect ratio library ─────────────────────────────────────────────────────

const AR_16_9: AspectRatioOption = { ratio: '16:9', width: 1920, height: 1080, label: 'Widescreen / YouTube' };
const AR_9_16: AspectRatioOption = { ratio: '9:16', width: 1080, height: 1920, label: 'Portrait / Reels / Shorts' };
const AR_1_1:  AspectRatioOption = { ratio: '1:1',  width: 1080, height: 1080, label: 'Square / Instagram' };
const AR_4_5:  AspectRatioOption = { ratio: '4:5',  width: 1080, height: 1350, label: 'Portrait Feed' };
const AR_21_9: AspectRatioOption = { ratio: '21:9', width: 2560, height: 1080, label: 'Cinematic Ultra-wide' };

// ─── Templates ────────────────────────────────────────────────────────────────

export const TEMPLATES: Template[] = [
  // ── Launch ─────────────────────────────────────────────────────────────────
  {
    id: 'product-hunt-launch',
    name: 'Product Hunt Launch',
    category: 'Launch',
    description: 'Punchy opener built for maximum upvotes on PH',
    minDuration: 15,
    maxDuration: 60,
    aspectRatios: [AR_16_9, AR_1_1, AR_9_16],
    tags: ['product-hunt', 'launch', 'startup'],
  },
  {
    id: 'feature-announce',
    name: 'Feature Announce',
    category: 'Launch',
    description: 'Highlight a single new feature with sharp focus',
    minDuration: 15,
    maxDuration: 45,
    aspectRatios: [AR_16_9, AR_9_16, AR_1_1],
    tags: ['feature', 'update', 'announcement'],
  },
  {
    id: 'changelog-spotlight',
    name: 'Changelog Spotlight',
    category: 'Changelog',
    description: 'Turn your release notes into a visual changelog reel',
    minDuration: 30,
    maxDuration: 90,
    aspectRatios: [AR_16_9, AR_1_1],
    tags: ['changelog', 'release', 'updates'],
  },

  // ── Social ─────────────────────────────────────────────────────────────────
  {
    id: 'social-teaser',
    name: 'Social Teaser',
    category: 'Social',
    description: 'Short-form teaser optimised for Twitter / X and LinkedIn',
    minDuration: 15,
    maxDuration: 30,
    aspectRatios: [AR_16_9, AR_1_1, AR_9_16, AR_4_5],
    tags: ['social', 'teaser', 'short-form'],
  },
  {
    id: 'instagram-reel',
    name: 'Instagram Reel',
    category: 'Social',
    description: 'Vertical-first kinetic reel with trending motion style',
    minDuration: 15,
    maxDuration: 60,
    aspectRatios: [AR_9_16, AR_4_5],
    tags: ['instagram', 'reel', 'vertical'],
  },
  {
    id: 'twitter-loop',
    name: 'Twitter Loop',
    category: 'Social',
    description: 'Seamlessly looping GIF or MP4 for maximum engagement',
    minDuration: 15,
    maxDuration: 30,
    aspectRatios: [AR_16_9, AR_1_1],
    tags: ['twitter', 'loop', 'gif'],
  },

  // ── Product ─────────────────────────────────────────────────────────────────
  {
    id: 'landing-hero',
    name: 'Landing Page Hero',
    category: 'Product',
    description: 'Cinematic hero video for the top of your marketing page',
    minDuration: 30,
    maxDuration: 90,
    aspectRatios: [AR_16_9, AR_21_9],
    tags: ['landing', 'hero', 'marketing'],
  },
  {
    id: 'product-demo',
    name: 'Product Demo',
    category: 'Product',
    description: 'Walk through core flows with polished screen transitions',
    minDuration: 30,
    maxDuration: 90,
    aspectRatios: [AR_16_9, AR_9_16],
    tags: ['demo', 'walkthrough', 'product'],
  },
  {
    id: 'investor-pitch',
    name: 'Investor Pitch Reel',
    category: 'Product',
    description: 'Traction, vision, and momentum in under 60 seconds',
    minDuration: 45,
    maxDuration: 90,
    aspectRatios: [AR_16_9],
    tags: ['investor', 'pitch', 'fundraising'],
  },

  // ── App Store ──────────────────────────────────────────────────────────────
  {
    id: 'app-store-preview',
    name: 'App Store Preview',
    category: 'App Store',
    description: 'Apple App Store & Google Play compliant preview video',
    minDuration: 15,
    maxDuration: 30,
    aspectRatios: [AR_9_16, AR_16_9],
    tags: ['app-store', 'google-play', 'mobile'],
  },
  {
    id: 'app-launch-cinematic',
    name: 'App Launch Cinematic',
    category: 'App Store',
    description: 'Cinema-grade launch film with device mockups & depth-of-field',
    minDuration: 30,
    maxDuration: 60,
    aspectRatios: [AR_16_9, AR_9_16, AR_1_1],
    tags: ['cinematic', 'launch', 'app'],
  },
];

// ─── Themes ───────────────────────────────────────────────────────────────────

export const THEMES: Theme[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    primaryColor: '#A855F7',
    accentColor: '#7C3AED',
    backgroundColor: '#0A0A0F',
    description: 'Deep black with violet highlights — the signature Spotlight look',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    primaryColor: '#06B6D4',
    accentColor: '#0EA5E9',
    backgroundColor: '#020617',
    description: 'Electric cyan and sky blue on a near-black canvas',
  },
  {
    id: 'ember',
    name: 'Ember',
    primaryColor: '#F97316',
    accentColor: '#EF4444',
    backgroundColor: '#0C0605',
    description: 'Warm orange-to-red gradient with deep charcoal backgrounds',
  },
  {
    id: 'frost',
    name: 'Frost',
    primaryColor: '#BAE6FD',
    accentColor: '#E0F2FE',
    backgroundColor: '#F8FAFC',
    description: 'Clean light mode — crisp whites and icy blue accents',
  },
  {
    id: 'noir',
    name: 'Noir',
    primaryColor: '#E5E7EB',
    accentColor: '#9CA3AF',
    backgroundColor: '#000000',
    description: 'Pure monochrome — black, white, and shades of grey',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    primaryColor: '#FB7185',
    accentColor: '#F472B6',
    backgroundColor: '#0D0208',
    description: 'Rose-to-pink gradient with a rich dark background',
  },
];
