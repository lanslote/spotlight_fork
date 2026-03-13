/**
 * Color Design Tokens
 *
 * Premium color palettes inspired by Apple, Linear, and Stripe aesthetics.
 * Each palette is carefully tuned for cinematic video output — rich contrast,
 * vibrant accents, and depth through layered gradients.
 */

export interface GradientStop {
  offset: number; // 0–1
  color: string;
}

export interface ColorPalette {
  /** Canvas / outermost background fill */
  background: string;
  /** Multi-stop gradient that replaces a flat background */
  backgroundGradient: GradientStop[];
  /** Primary text / icon color */
  foreground: string;
  /** Brand primary — buttons, highlights, key UI */
  primary: string;
  /** Secondary accent — supporting UI chrome */
  secondary: string;
  /** Muted / de-emphasised surfaces and text */
  muted: string;
  /** Accent pop — used sparingly for maximum impact */
  accent: string;
  /** Glow color for soft luminance effects */
  glow: string;
}

// ─── Palettes ─────────────────────────────────────────────────────────────────

const midnight: ColorPalette = {
  background: "#050818",
  backgroundGradient: [
    { offset: 0, color: "#050818" },
    { offset: 0.45, color: "#0a1040" },
    { offset: 1, color: "#160035" },
  ],
  foreground: "#e8eeff",
  primary: "#6366f1",   // indigo-500
  secondary: "#818cf8", // indigo-400
  muted: "#334155",
  accent: "#a78bfa",    // violet-400
  glow: "rgba(99,102,241,0.55)",
};

const aurora: ColorPalette = {
  background: "#010d0a",
  backgroundGradient: [
    { offset: 0, color: "#010d0a" },
    { offset: 0.5, color: "#023325" },
    { offset: 1, color: "#00160e" },
  ],
  foreground: "#d1fae5",
  primary: "#10b981",   // emerald-500
  secondary: "#34d399", // emerald-400
  muted: "#1e3a2f",
  accent: "#2dd4bf",    // teal-400
  glow: "rgba(16,185,129,0.5)",
};

const ember: ColorPalette = {
  background: "#0f0500",
  backgroundGradient: [
    { offset: 0, color: "#0f0500" },
    { offset: 0.5, color: "#2d0a00" },
    { offset: 1, color: "#1a0800" },
  ],
  foreground: "#fff1e6",
  primary: "#f97316",   // orange-500
  secondary: "#fb923c", // orange-400
  muted: "#3d1a0a",
  accent: "#ef4444",    // red-500
  glow: "rgba(249,115,22,0.55)",
};

const frost: ColorPalette = {
  background: "#f0f4ff",
  backgroundGradient: [
    { offset: 0, color: "#f0f4ff" },
    { offset: 0.5, color: "#e0e8ff" },
    { offset: 1, color: "#f5f7ff" },
  ],
  foreground: "#0f172a",
  primary: "#3b82f6",   // blue-500
  secondary: "#60a5fa", // blue-400
  muted: "#cbd5e1",
  accent: "#0ea5e9",    // sky-500
  glow: "rgba(59,130,246,0.35)",
};

const noir: ColorPalette = {
  background: "#000000",
  backgroundGradient: [
    { offset: 0, color: "#000000" },
    { offset: 0.5, color: "#0a0a0a" },
    { offset: 1, color: "#050505" },
  ],
  foreground: "#ffffff",
  primary: "#ffffff",
  secondary: "#a1a1aa", // zinc-400
  muted: "#27272a",
  accent: "#71717a",    // zinc-500
  glow: "rgba(255,255,255,0.2)",
};

const sunset: ColorPalette = {
  background: "#0d0005",
  backgroundGradient: [
    { offset: 0, color: "#0d0005" },
    { offset: 0.35, color: "#350020" },
    { offset: 0.7, color: "#5c1a00" },
    { offset: 1, color: "#2a0010" },
  ],
  foreground: "#fff0f7",
  primary: "#f43f5e",   // rose-500
  secondary: "#fb7185", // rose-400
  muted: "#4a0e25",
  accent: "#fb923c",    // orange-400
  glow: "rgba(244,63,94,0.55)",
};

// ─── Theme registry ───────────────────────────────────────────────────────────

export type ThemeName =
  | "midnight"
  | "aurora"
  | "ember"
  | "frost"
  | "noir"
  | "sunset";

export const themes: Record<ThemeName, ColorPalette> = {
  midnight,
  aurora,
  ember,
  frost,
  noir,
  sunset,
};

/**
 * Retrieve a color palette by name.
 * Defaults to "midnight" when an unknown name is provided so the engine
 * always gets a valid palette rather than an undefined crash.
 */
export function getTheme(name: string): ColorPalette {
  return themes[name as ThemeName] ?? themes.midnight;
}

/** Utility: convert a hex color to rgba with a given alpha (0–1). */
export function hexToRgba(hex: string, alpha: number): string {
  const sanitised = hex.replace("#", "");
  const fullHex =
    sanitised.length === 3
      ? sanitised
          .split("")
          .map((c) => c + c)
          .join("")
      : sanitised;
  const r = parseInt(fullHex.slice(0, 2), 16);
  const g = parseInt(fullHex.slice(2, 4), 16);
  const b = parseInt(fullHex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Utility: lighten a hex color by a fraction (0–1). */
export function lighten(hex: string, amount: number): string {
  const sanitised = hex.replace("#", "");
  const fullHex =
    sanitised.length === 3
      ? sanitised
          .split("")
          .map((c) => c + c)
          .join("")
      : sanitised;
  const r = Math.min(255, Math.round(parseInt(fullHex.slice(0, 2), 16) + 255 * amount));
  const g = Math.min(255, Math.round(parseInt(fullHex.slice(2, 4), 16) + 255 * amount));
  const b = Math.min(255, Math.round(parseInt(fullHex.slice(4, 6), 16) + 255 * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
