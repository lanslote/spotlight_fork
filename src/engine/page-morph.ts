/**
 * PageMorph — canvas-based engine for replacing text and images in screenshots.
 *
 * This module is intentionally free of React/DOM dependencies beyond the
 * HTMLCanvasElement APIs that are available in any browser context.  It is used
 * by the demo editor to let creators swap out sensitive data (names, numbers,
 * UI labels) without re-taking screenshots.
 *
 * Usage:
 *   const morph = new PageMorph(sourceCanvas);
 *   morph.addTextRegion({ id: 't1', bounds: {x:100,y:50,width:200,height:28}, … });
 *   morph.render(outputCanvas);
 */

import type { Rect } from "./scene";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TextRegion {
  id: string;
  bounds: Rect;
  /** Original text (for display / undo purposes only — not used during render). */
  originalText?: string;
  /** The text to draw in place of the original. */
  replacementText: string;
  /** Font size in px.  Use estimateFontSize() if unknown. */
  fontSize: number;
  /** CSS font-family string. Default: "sans-serif". */
  fontFamily: string;
  /** CSS colour string for the text. */
  color: string;
  /** CSS colour string used to paint over the original pixels. */
  backgroundColor: string;
  fontWeight: "normal" | "bold";
  textAlign: "left" | "center" | "right";
}

export interface ImageRegion {
  id: string;
  bounds: Rect;
  /** Data URL of the replacement image. */
  replacementImageUrl?: string;
  /**
   * Blend radius in pixels applied at the region's edges so that the
   * replacement blends smoothly into surrounding pixels.  0 = hard edge.
   */
  featherRadius: number;
}

export interface MorphConfig {
  textRegions: TextRegion[];
  imageRegions: ImageRegion[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Round a font size to common pixel-level values. */
function snapFontSize(raw: number): number {
  const sizes = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72];
  let best = sizes[0];
  let bestDiff = Math.abs(raw - best);
  for (const s of sizes) {
    const d = Math.abs(raw - s);
    if (d < bestDiff) {
      bestDiff = d;
      best = s;
    }
  }
  return best;
}

/**
 * Wrap `text` into lines that fit within `maxWidth` given the current canvas
 * font setting.  Returns an array of line strings.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const probe = current ? `${current} ${word}` : word;
    if (ctx.measureText(probe).width <= maxWidth || !current) {
      current = probe;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Load an image from a URL/data-URI and resolve when ready. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ─── PageMorph class ──────────────────────────────────────────────────────────

export class PageMorph {
  private readonly source: HTMLCanvasElement;
  private textRegions: Map<string, TextRegion> = new Map();
  private imageRegions: Map<string, ImageRegion> = new Map();

  /**
   * @param sourceCanvas — the original screenshot canvas.  The PageMorph holds
   *   a reference (not a copy), so mutations to the source after construction
   *   will affect subsequent renders.
   */
  constructor(sourceCanvas: HTMLCanvasElement) {
    this.source = sourceCanvas;
  }

  // ── Region management ──────────────────────────────────────────────────────

  addTextRegion(region: TextRegion): this {
    this.textRegions.set(region.id, { ...region });
    return this;
  }

  updateTextRegion(region: TextRegion): this {
    if (this.textRegions.has(region.id)) {
      this.textRegions.set(region.id, { ...region });
    }
    return this;
  }

  removeTextRegion(id: string): this {
    this.textRegions.delete(id);
    return this;
  }

  addImageRegion(region: ImageRegion): this {
    this.imageRegions.set(region.id, { ...region });
    return this;
  }

  updateImageRegion(region: ImageRegion): this {
    if (this.imageRegions.has(region.id)) {
      this.imageRegions.set(region.id, { ...region });
    }
    return this;
  }

  removeImageRegion(id: string): this {
    this.imageRegions.delete(id);
    return this;
  }

  getTextRegions(): TextRegion[] {
    return Array.from(this.textRegions.values());
  }

  getImageRegions(): ImageRegion[] {
    return Array.from(this.imageRegions.values());
  }

  // ── Analysis helpers ───────────────────────────────────────────────────────

  /**
   * Sample the average colour of pixels within `radius` pixels of (x, y)
   * on the source canvas.  Useful for picking the backgroundColor when adding
   * a new text region.
   *
   * @returns A CSS `rgb(r, g, b)` string.
   */
  sampleBackgroundColor(x: number, y: number, radius: number): string {
    const ctx = this.source.getContext("2d");
    if (!ctx) return "#ffffff";

    const r = Math.max(1, Math.round(radius));
    const sx = Math.max(0, Math.round(x) - r);
    const sy = Math.max(0, Math.round(y) - r);
    const sw = Math.min(this.source.width - sx, r * 2);
    const sh = Math.min(this.source.height - sy, r * 2);

    if (sw <= 0 || sh <= 0) return "#ffffff";

    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(sx, sy, sw, sh);
    } catch {
      // getImageData throws with cross-origin canvases
      return "#ffffff";
    }

    const data = imageData.data;
    let sumR = 0, sumG = 0, sumB = 0;
    const pixelCount = sw * sh;

    for (let i = 0; i < data.length; i += 4) {
      sumR += data[i];
      sumG += data[i + 1];
      sumB += data[i + 2];
    }

    const avgR = Math.round(sumR / pixelCount);
    const avgG = Math.round(sumG / pixelCount);
    const avgB = Math.round(sumB / pixelCount);

    return `rgb(${avgR}, ${avgG}, ${avgB})`;
  }

  /**
   * Estimate a plausible font size for a region whose text likely fills most
   * of the bounds height.  The result is snapped to common pixel sizes.
   */
  estimateFontSize(bounds: Rect): number {
    const raw = bounds.height * 0.7;
    return snapFontSize(raw);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  /**
   * Composite all morph operations onto `outputCanvas`.
   *
   * Steps:
   * 1. Copy the source screenshot to the output canvas.
   * 2. Apply image region replacements (async loads happen in parallel).
   * 3. Apply text region replacements (synchronous).
   *
   * @returns A Promise that resolves when all async image loads complete.
   */
  async render(outputCanvas: HTMLCanvasElement): Promise<void> {
    const w = this.source.width;
    const h = this.source.height;

    outputCanvas.width = w;
    outputCanvas.height = h;

    const ctx = outputCanvas.getContext("2d");
    if (!ctx) throw new Error("PageMorph.render: could not get 2D context from outputCanvas");

    // Step 1 — draw source
    ctx.drawImage(this.source, 0, 0);

    // Step 2 — image regions (async, run in parallel)
    const imageOps = Array.from(this.imageRegions.values()).map((region) =>
      this.applyImageRegion(ctx, region)
    );
    await Promise.all(imageOps);

    // Step 3 — text regions (synchronous)
    for (const region of Array.from(this.textRegions.values())) {
      this.applyTextRegion(ctx, region);
    }
  }

  /**
   * Synchronous render — text regions only.  Skips image regions since loading
   * images is asynchronous.  Useful for quick editor previews.
   */
  renderSync(outputCanvas: HTMLCanvasElement): void {
    const w = this.source.width;
    const h = this.source.height;

    outputCanvas.width = w;
    outputCanvas.height = h;

    const ctx = outputCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(this.source, 0, 0);

    for (const region of Array.from(this.textRegions.values())) {
      this.applyTextRegion(ctx, region);
    }
  }

  // ── Private rendering helpers ─────────────────────────────────────────────

  private applyTextRegion(ctx: CanvasRenderingContext2D, region: TextRegion): void {
    const { bounds } = region;

    ctx.save();

    // 1. Paint background over the original text
    ctx.fillStyle = region.backgroundColor;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

    // 2. Set up text properties
    const weight = region.fontWeight === "bold" ? "bold " : "";
    ctx.font = `${weight}${region.fontSize}px ${region.fontFamily || "sans-serif"}`;
    ctx.fillStyle = region.color;
    ctx.textAlign = region.textAlign;
    ctx.textBaseline = "top";

    // 3. Determine horizontal anchor
    let anchorX: number;
    switch (region.textAlign) {
      case "center": anchorX = bounds.x + bounds.width / 2; break;
      case "right":  anchorX = bounds.x + bounds.width; break;
      default:       anchorX = bounds.x;
    }

    // 4. Word-wrap and draw lines
    const lines = wrapText(ctx, region.replacementText, bounds.width);
    const lineHeight = region.fontSize * 1.2;
    const totalHeight = lines.length * lineHeight;

    // Vertically centre the text block inside the bounds
    let currentY = bounds.y + Math.max(0, (bounds.height - totalHeight) / 2);

    ctx.beginPath();
    ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.clip();

    for (const line of lines) {
      ctx.fillText(line, anchorX, currentY);
      currentY += lineHeight;
    }

    ctx.restore();
  }

  private async applyImageRegion(
    ctx: CanvasRenderingContext2D,
    region: ImageRegion
  ): Promise<void> {
    if (!region.replacementImageUrl) return;

    let img: HTMLImageElement;
    try {
      img = await loadImage(region.replacementImageUrl);
    } catch {
      // If the image fails to load, leave the original pixels intact
      return;
    }

    const { bounds, featherRadius } = region;

    ctx.save();

    if (featherRadius > 0) {
      // Create a feathered clipping mask using a radial gradient composited
      // into an off-screen canvas, then use it as a mask.
      this.drawFeatheredImage(ctx, img, bounds, featherRadius);
    } else {
      // Hard-edge replacement — simply draw the image scaled to fit bounds
      ctx.drawImage(img, bounds.x, bounds.y, bounds.width, bounds.height);
    }

    ctx.restore();
  }

  /**
   * Draw `img` scaled to `bounds` with feathered edges.
   *
   * Strategy:
   *   1. Draw the image onto a temporary canvas.
   *   2. Apply a gradient mask (destination-in) that fades the edges to alpha-0.
   *   3. Composite the masked temporary canvas onto the main context.
   */
  private drawFeatheredImage(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    bounds: Rect,
    featherRadius: number
  ): void {
    // Temporary canvas sized to the replacement bounds
    const tmp = document.createElement("canvas");
    tmp.width = bounds.width;
    tmp.height = bounds.height;
    const tmpCtx = tmp.getContext("2d");
    if (!tmpCtx) return;

    // Draw the replacement image into the temp canvas
    tmpCtx.drawImage(img, 0, 0, bounds.width, bounds.height);

    // Apply a vignette mask via destination-in.
    // We draw four linear gradients — one per edge — each fading from opaque
    // (inside) to transparent (at the edge) within `featherRadius` pixels.
    tmpCtx.globalCompositeOperation = "destination-in";

    const r = Math.min(featherRadius, bounds.width / 2, bounds.height / 2);

    // Helper: draw a feather gradient along one edge
    const drawEdge = (
      x0: number, y0: number,
      x1: number, y1: number,
      clearX: number, clearY: number,
      clearW: number, clearH: number
    ) => {
      const grad = tmpCtx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,1)");
      tmpCtx.fillStyle = grad;
      tmpCtx.fillRect(clearX, clearY, clearW, clearH);
    };

    // Left edge
    drawEdge(0, 0, r, 0, 0, 0, r, bounds.height);
    // Right edge
    drawEdge(bounds.width, 0, bounds.width - r, 0, bounds.width - r, 0, r, bounds.height);
    // Top edge
    drawEdge(0, 0, 0, r, 0, 0, bounds.width, r);
    // Bottom edge
    drawEdge(0, bounds.height, 0, bounds.height - r, 0, bounds.height - r, bounds.width, r);

    // Composite the masked image onto the main canvas
    ctx.drawImage(tmp, bounds.x, bounds.y);
  }
}

// ─── Convenience factory ──────────────────────────────────────────────────────

/**
 * Create a PageMorph from a source canvas and an optional initial config.
 */
export function createPageMorph(
  sourceCanvas: HTMLCanvasElement,
  config?: Partial<MorphConfig>
): PageMorph {
  const morph = new PageMorph(sourceCanvas);
  if (config?.textRegions) {
    for (const r of config.textRegions) morph.addTextRegion(r);
  }
  if (config?.imageRegions) {
    for (const r of config.imageRegions) morph.addImageRegion(r);
  }
  return morph;
}
