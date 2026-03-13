/**
 * CanvasRenderer — 2D Canvas rendering backend for Spotlight.
 *
 * Consumes a ResolvedScene produced by the Timeline and paints every element
 * onto a provided CanvasRenderingContext2D.
 *
 * Design:
 *  - High-DPI aware: all logical px values are multiplied by devicePixelRatio.
 *  - Element rendering is dispatched by type through a method map.
 *  - State (save/restore) is scoped tightly around each element.
 *  - Image assets are cached; first-render triggers an async load but the
 *    element is skipped until the image resolves (subsequent frames show it).
 */

import type {
  Color,
  GradientDef,
  LinearGradient,
  RadialGradient,
  AngularGradient,
  GradientStop,
  TextStyle,
  ShapeStyle,
  Scene,
} from "./scene";
import { colorToCSS } from "./scene";
import type { ResolvedScene, ResolvedElementBase } from "./timeline";

// ─── Renderer configuration ───────────────────────────────────────────────────

export interface RendererConfig {
  /**
   * The physical canvas element.  The renderer will resize it on init.
   */
  canvas: HTMLCanvasElement;
  /**
   * Logical width in CSS px.  The canvas bitmap is scaled up by DPR.
   */
  width: number;
  height: number;
  /**
   * Override devicePixelRatio (default: window.devicePixelRatio ?? 1).
   * Set to 1 for export to keep output at the target resolution.
   */
  dpr?: number;
  /**
   * Colour used when a scene doesn't specify a backgroundColor.
   */
  defaultBackground?: Color;
}

// ─── Image cache ──────────────────────────────────────────────────────────────

type ImageCacheEntry =
  | { status: "loading" }
  | { status: "ready"; img: HTMLImageElement }
  | { status: "error" };

const imageCache = new Map<string, ImageCacheEntry>();

function loadImage(src: string): HTMLImageElement | null {
  const cached = imageCache.get(src);
  if (cached?.status === "ready") return cached.img;
  if (cached?.status === "loading" || cached?.status === "error") return null;

  // Start async load.
  imageCache.set(src, { status: "loading" });
  const img = new Image();
  img.onload  = () => imageCache.set(src, { status: "ready", img });
  img.onerror = () => imageCache.set(src, { status: "error" });
  img.src = src;
  return null;
}

// ─── CanvasRenderer ───────────────────────────────────────────────────────────

export class CanvasRenderer {
  private _ctx: CanvasRenderingContext2D;
  private _config: Required<RendererConfig>;
  private _dpr: number;

  constructor(config: RendererConfig) {
    const ctx = config.canvas.getContext("2d");
    if (!ctx) throw new Error("CanvasRenderer: could not obtain 2D context");

    const dpr = config.dpr ?? (typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1);

    this._dpr = dpr;
    this._ctx = ctx;
    this._config = {
      canvas: config.canvas,
      width: config.width,
      height: config.height,
      dpr,
      defaultBackground: config.defaultBackground ?? { r: 0, g: 0, b: 0, a: 1 },
    };

    this._initCanvas();
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  get ctx(): CanvasRenderingContext2D { return this._ctx; }
  get dpr(): number { return this._dpr; }
  get logicalWidth(): number  { return this._config.width; }
  get logicalHeight(): number { return this._config.height; }

  /**
   * Resize the canvas (e.g. on window resize).
   * Call this instead of setting canvas dimensions directly.
   */
  resize(width: number, height: number): void {
    this._config.width  = width;
    this._config.height = height;
    this._initCanvas();
  }

  /**
   * Core method: given a resolved scene and current local time, clears the
   * canvas and draws all elements.
   *
   * @param resolvedScene  Output of Timeline.getStateAtTime()
   */
  renderFrame(resolvedScene: ResolvedScene): void {
    const { ctx } = this;
    const { scene, elements, transitionAlpha } = resolvedScene;

    ctx.save();

    // Scale all drawing operations by DPR so we work in logical px.
    ctx.scale(this._dpr, this._dpr);

    // Clear.
    ctx.clearRect(0, 0, this._config.width, this._config.height);

    // Background.
    const bg = scene.backgroundColor ?? this._config.defaultBackground;
    ctx.fillStyle = colorToCSS(bg);
    ctx.fillRect(0, 0, this._config.width, this._config.height);

    // Apply scene-level transition alpha (fade-in support).
    if (transitionAlpha < 1) {
      ctx.globalAlpha = transitionAlpha;
    }

    // If the scene has a bespoke render override, use it.
    if (scene.render) {
      scene.render(ctx, resolvedScene.localTime);
    } else {
      for (const el of elements) {
        this._renderElement(el);
      }
    }

    ctx.restore();
  }

  /**
   * Convenience: render two scenes with alpha compositing for a cross-fade.
   * The outgoing scene is drawn first, then the incoming one on top.
   */
  renderTransition(outgoing: ResolvedScene, incoming: ResolvedScene): void {
    const { ctx } = this;

    ctx.save();
    ctx.scale(this._dpr, this._dpr);

    // Outgoing — full opacity, fading out.
    ctx.globalAlpha = outgoing.transitionAlpha;
    this._drawSceneContents(outgoing);

    // Incoming — fading in.
    ctx.globalAlpha = incoming.transitionAlpha;
    this._drawSceneContents(incoming);

    ctx.restore();
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private _initCanvas(): void {
    const { canvas, width, height, dpr } = this._config;
    canvas.width  = Math.round(width  * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width  = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  private _drawSceneContents(resolved: ResolvedScene): void {
    const { ctx } = this;
    const { scene } = resolved;

    const bg = scene.backgroundColor ?? this._config.defaultBackground;
    ctx.fillStyle = colorToCSS(bg);
    ctx.fillRect(0, 0, this._config.width, this._config.height);

    if (scene.render) {
      scene.render(ctx, resolved.localTime);
    } else {
      for (const el of resolved.elements) {
        this._renderElement(el);
      }
    }
  }

  private _renderElement(el: ResolvedElementBase): void {
    const { ctx } = this;
    ctx.save();

    // Apply element transform.
    this._applyTransform(el);

    // Opacity & blend.
    ctx.globalAlpha          = Math.max(0, Math.min(1, el.opacity));
    ctx.globalCompositeOperation = el.blendMode;

    // CSS filter (blur, brightness, etc.).
    const filterStr = this._buildFilter(el);
    if (filterStr) ctx.filter = filterStr;

    // Dispatch by type.
    switch (el.type) {
      case "text":            this._drawText(el);         break;
      case "rect":            this._drawRect(el);         break;
      case "rounded-rect":    this._drawRoundedRect(el);  break;
      case "circle":          this._drawCircle(el);       break;
      case "gradient-bg":     this._drawGradientBg(el);   break;
      case "image":           this._drawImage(el);        break;
      case "device-iphone":   this._drawIPhone(el);       break;
      case "device-macbook":  this._drawMacBook(el);      break;
      case "device-ipad":     this._drawIPad(el);         break;
      case "group":           this._drawGroup(el);        break;
      case "video-playback":  this._drawVideoPlayback(el);  break;
      case "custom-cursor":   this._drawCustomCursor(el);   break;
      case "ripple-effect":   this._drawRippleEffect(el);   break;
      case "blur-region":     this._drawBlurRegion(el);     break;
    }

    ctx.restore();
  }

  // ── Transform ────────────────────────────────────────────────────────────────

  private _applyTransform(el: ResolvedElementBase): void {
    const { ctx } = this;
    const originX = el.x + el.width  * el.originX;
    const originY = el.y + el.height * el.originY;

    ctx.translate(originX, originY);
    if (el.rotation !== 0) ctx.rotate((el.rotation * Math.PI) / 180);
    if (el.scaleX !== 1 || el.scaleY !== 1) ctx.scale(el.scaleX, el.scaleY);
    ctx.translate(-originX, -originY);
  }

  private _buildFilter(el: ResolvedElementBase): string {
    const parts: string[] = [];
    if (el.blur > 0) parts.push(`blur(${el.blur}px)`);
    if (el.filter)   parts.push(el.filter);
    return parts.join(" ");
  }

  // ── Text ─────────────────────────────────────────────────────────────────────

  private _drawText(el: ResolvedElementBase): void {
    const raw = el.raw;
    if (raw.type !== "text") return;
    const { content, style, wrapWidth = 0 } = raw;
    const { ctx } = this;

    this._applyTextStyle(style);
    ctx.fillStyle = colorToCSS(style.color);

    if (style.textShadow) {
      const s = style.textShadow;
      ctx.shadowOffsetX = s.offsetX;
      ctx.shadowOffsetY = s.offsetY;
      ctx.shadowBlur    = s.blur;
      ctx.shadowColor   = colorToCSS(s.color);
    }

    const textAlign = style.textAlign ?? "left";
    ctx.textAlign   = textAlign;
    ctx.textBaseline = "top";

    const anchorX = textAlign === "center"
      ? el.x + el.width / 2
      : textAlign === "right"
        ? el.x + el.width
        : el.x;

    if (wrapWidth > 0) {
      this._drawWrappedText(content, anchorX, el.y, wrapWidth, style);
    } else {
      // Respect letter-spacing via character-by-character rendering.
      if (style.letterSpacing && style.letterSpacing !== 0) {
        this._drawTrackedText(content, anchorX, el.y, style);
      } else {
        ctx.fillText(content, anchorX, el.y);
      }
    }
  }

  private _applyTextStyle(style: TextStyle): void {
    const { ctx } = this;
    const weight = style.fontWeight ?? "normal";
    const slant  = style.fontStyle  ?? "normal";
    ctx.font = `${slant} ${weight} ${style.fontSize}px ${style.fontFamily}`;
  }

  private _drawTrackedText(text: string, x: number, y: number, style: TextStyle): void {
    const { ctx } = this;
    const spacing = style.letterSpacing ?? 0;
    let cursor = x;
    for (const char of text) {
      ctx.fillText(char, cursor, y);
      cursor += ctx.measureText(char).width + spacing;
    }
  }

  private _drawWrappedText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    style: TextStyle
  ): void {
    const { ctx } = this;
    const lineHeight = (style.lineHeight ?? 1.2) * style.fontSize;
    const words = text.split(" ");
    let line  = "";
    let lineY = y;

    for (let i = 0; i < words.length; i++) {
      const testLine  = line + words[i] + " ";
      const measured  = ctx.measureText(testLine).width;
      if (measured > maxWidth && i > 0) {
        ctx.fillText(line.trimEnd(), x, lineY);
        line  = words[i] + " ";
        lineY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trimEnd(), x, lineY);
  }

  // ── Shapes ───────────────────────────────────────────────────────────────────

  private _drawRect(el: ResolvedElementBase): void {
    const raw = el.raw;
    if (raw.type !== "rect") return;
    this._paintShape(el.x, el.y, el.width, el.height, 0, raw.style);
  }

  private _drawRoundedRect(el: ResolvedElementBase): void {
    const raw = el.raw;
    if (raw.type !== "rounded-rect") return;
    this._paintShape(el.x, el.y, el.width, el.height, raw.style.borderRadius ?? 8, raw.style);
  }

  private _drawCircle(el: ResolvedElementBase): void {
    const raw = el.raw;
    if (raw.type !== "circle") return;
    const { ctx } = this;
    const r  = Math.min(el.width, el.height) / 2;
    const cx = el.x + el.width  / 2;
    const cy = el.y + el.height / 2;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this._applyShapeStyle(raw.style, el.x, el.y, el.width, el.height);
  }

  private _paintShape(
    x: number, y: number, w: number, h: number,
    radius: number, style: ShapeStyle
  ): void {
    const { ctx } = this;
    ctx.beginPath();
    if (radius > 0) {
      const r = Math.min(radius, w / 2, h / 2);
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y,     x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x,     y + h, r);
      ctx.arcTo(x,     y + h, x,     y,     r);
      ctx.arcTo(x,     y,     x + w, y,     r);
      ctx.closePath();
    } else {
      ctx.rect(x, y, w, h);
    }
    this._applyShapeStyle(style, x, y, w, h);
  }

  private _applyShapeStyle(
    style: ShapeStyle,
    x: number, y: number, w: number, h: number
  ): void {
    const { ctx } = this;

    if (style.shadow) {
      const s = style.shadow;
      ctx.shadowOffsetX = s.offsetX;
      ctx.shadowOffsetY = s.offsetY;
      ctx.shadowBlur    = s.blur + s.spread;
      ctx.shadowColor   = colorToCSS(s.color);
    }

    if (style.fill) {
      ctx.fillStyle = this._resolvePaint(style.fill, x, y, w, h);
      ctx.fill();
    }

    if (style.stroke && (style.strokeWidth ?? 0) > 0) {
      ctx.shadowBlur    = 0;  // strokes don't carry shadow
      ctx.strokeStyle   = colorToCSS(style.stroke);
      ctx.lineWidth     = style.strokeWidth!;
      ctx.stroke();
    }
  }

  // ── Gradient background ───────────────────────────────────────────────────────

  private _drawGradientBg(el: ResolvedElementBase): void {
    const raw = el.raw;
    if (raw.type !== "gradient-bg") return;

    const { ctx } = this;
    const x = raw.fullCanvas ? 0 : el.x;
    const y = raw.fullCanvas ? 0 : el.y;
    const w = raw.fullCanvas ? this._config.width  : el.width;
    const h = raw.fullCanvas ? this._config.height : el.height;

    ctx.fillStyle = this._resolvePaint(raw.gradient, x, y, w, h);
    ctx.fillRect(x, y, w, h);
  }

  // ── Image ─────────────────────────────────────────────────────────────────────

  private _drawImage(el: ResolvedElementBase): void {
    const raw = el.raw;
    if (raw.type !== "image") return;
    const { ctx } = this;

    let img: HTMLImageElement | null;

    if (typeof raw.src === "string") {
      img = loadImage(raw.src);
    } else {
      img = raw.src as HTMLImageElement;
    }

    if (!img) return;  // still loading

    const br = raw.borderRadius ?? 0;
    if (br > 0) {
      ctx.save();
      this._clipRoundedRect(el.x, el.y, el.width, el.height, br);
      ctx.clip();
    }

    // object-fit logic.
    const { sx, sy, sw, sh, dx, dy, dw, dh } = this._computeObjectFit(
      img.naturalWidth, img.naturalHeight,
      el.x, el.y, el.width, el.height,
      raw.objectFit ?? "cover"
    );

    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

    if (raw.tint) {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = colorToCSS(raw.tint);
      ctx.fillRect(el.x, el.y, el.width, el.height);
      ctx.globalCompositeOperation = "source-over";
    }

    if (br > 0) ctx.restore();
  }

  private _computeObjectFit(
    nw: number, nh: number,
    dx: number, dy: number, dw: number, dh: number,
    fit: "fill" | "contain" | "cover"
  ) {
    if (fit === "fill") {
      return { sx: 0, sy: 0, sw: nw, sh: nh, dx, dy, dw, dh };
    }
    const srcRatio = nw / nh;
    const dstRatio = dw / dh;
    let sw: number, sh: number, sx: number, sy: number;

    if (fit === "contain") {
      if (srcRatio > dstRatio) { sw = nw; sh = nw / dstRatio; }
      else                     { sh = nh; sw = nh * dstRatio; }
      sx = (nw - sw) / 2; sy = (nh - sh) / 2;
    } else {
      // cover
      if (srcRatio > dstRatio) { sh = nh; sw = nh * dstRatio; }
      else                     { sw = nw; sh = nw / dstRatio; }
      sx = (nw - sw) / 2; sy = (nh - sh) / 2;
    }

    return { sx, sy, sw, sh, dx, dy, dw, dh };
  }

  private _clipRoundedRect(x: number, y: number, w: number, h: number, r: number): void {
    const { ctx } = this;
    const cr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + cr, y);
    ctx.arcTo(x + w, y,     x + w, y + h, cr);
    ctx.arcTo(x + w, y + h, x,     y + h, cr);
    ctx.arcTo(x,     y + h, x,     y,     cr);
    ctx.arcTo(x,     y,     x + w, y,     cr);
    ctx.closePath();
  }

  // ── Device mockups ────────────────────────────────────────────────────────────

  private _drawIPhone(el: ResolvedElementBase): void {
    const raw = el.raw;
    if (raw.type !== "device-iphone") return;

    const { ctx } = this;
    const { x, y, width: w, height: h } = el;

    const scheme = raw.colorScheme ?? "midnight";
    const frameColor = this._deviceColor(scheme);
    const screenColor: Color = { r: 0, g: 0, b: 0, a: 1 };

    const r = w * 0.12;       // corner radius
    const bezelH = h * 0.04;  // top/bottom bezel
    const bezelV = w * 0.05;  // side bezel

    // ── Outer shell ──────────────────────────────────────────────────────────
    if (raw.showShadow !== false) {
      ctx.shadowColor   = "rgba(0,0,0,0.4)";
      ctx.shadowBlur    = w * 0.08;
      ctx.shadowOffsetY = h * 0.03;
    }
    ctx.fillStyle = colorToCSS(frameColor);
    this._roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // ── Screen ────────────────────────────────────────────────────────────────
    const sx = x + bezelV;
    const sy = y + bezelH;
    const sw = w - bezelV * 2;
    const sh = h - bezelH * 2;
    const sr = r * 0.8;

    if (raw.screenContent) {
      ctx.save();
      this._clipRoundedRect(sx, sy, sw, sh, sr);
      ctx.clip();
      if (raw.screenContent instanceof HTMLCanvasElement) {
        ctx.drawImage(raw.screenContent, sx, sy, sw, sh);
      } else if (typeof raw.screenContent === "string") {
        const img = loadImage(raw.screenContent);
        if (img) ctx.drawImage(img, sx, sy, sw, sh);
        else { ctx.fillStyle = colorToCSS(screenColor); ctx.fillRect(sx, sy, sw, sh); }
      }
      ctx.restore();
    } else {
      ctx.fillStyle = colorToCSS(screenColor);
      this._roundRect(sx, sy, sw, sh, sr);
      ctx.fill();
    }

    // ── Dynamic Island ────────────────────────────────────────────────────────
    const diW = w * 0.28, diH = h * 0.025;
    const diX = x + (w - diW) / 2;
    const diY = y + bezelH * 0.4;
    ctx.fillStyle = "#000";
    this._roundRect(diX, diY, diW, diH, diH / 2);
    ctx.fill();

    // ── Side button ───────────────────────────────────────────────────────────
    const btnW = w * 0.025, btnH = h * 0.1;
    ctx.fillStyle = colorToCSS(this._darken(frameColor, 0.15));
    ctx.fillRect(x + w - btnW * 0.3, y + h * 0.25, btnW, btnH);
  }

  private _drawMacBook(el: ResolvedElementBase): void {
    const raw = el.raw;
    if (raw.type !== "device-macbook") return;

    const { ctx } = this;
    const { x, y, width: w, height: h } = el;

    const scheme = raw.colorScheme ?? "silver";
    const frameColor = this._deviceColor(scheme);

    // Proportions: lid = 65% of total height, base = 35%.
    const lidH  = h * 0.65;
    const baseH = h * 0.35;
    const lidR  = w * 0.012;

    // ── Shadow ────────────────────────────────────────────────────────────────
    if (raw.showShadow !== false) {
      ctx.shadowColor   = "rgba(0,0,0,0.35)";
      ctx.shadowBlur    = w * 0.05;
      ctx.shadowOffsetY = h * 0.02;
    }

    // ── Lid ───────────────────────────────────────────────────────────────────
    ctx.fillStyle = colorToCSS(frameColor);
    this._roundRect(x, y, w, lidH, lidR);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // Screen bezel.
    const bezel = w * 0.025;
    const scrX = x + bezel;
    const scrY = y + bezel;
    const scrW = w - bezel * 2;
    const scrH = lidH - bezel * 1.5;
    const scrR = lidR * 0.6;

    if (raw.screenContent) {
      ctx.save();
      this._clipRoundedRect(scrX, scrY, scrW, scrH, scrR);
      ctx.clip();
      if (raw.screenContent instanceof HTMLCanvasElement) {
        ctx.drawImage(raw.screenContent, scrX, scrY, scrW, scrH);
      } else if (typeof raw.screenContent === "string") {
        const img = loadImage(raw.screenContent);
        if (img) ctx.drawImage(img, scrX, scrY, scrW, scrH);
        else { ctx.fillStyle = "#000"; ctx.fillRect(scrX, scrY, scrW, scrH); }
      }
      ctx.restore();
    } else {
      ctx.fillStyle = "#0a0a0a";
      this._roundRect(scrX, scrY, scrW, scrH, scrR);
      ctx.fill();
    }

    // Notch.
    const notchW = w * 0.08, notchH = bezel * 0.9;
    ctx.fillStyle = colorToCSS(frameColor);
    ctx.fillRect(x + (w - notchW) / 2, y, notchW, notchH);

    // ── Base ──────────────────────────────────────────────────────────────────
    const baseY = y + lidH;
    ctx.fillStyle = colorToCSS(this._lighten(frameColor, 0.05));
    this._roundRect(x, baseY, w, baseH, { tl: 0, tr: 0, br: w * 0.02, bl: w * 0.02 });
    ctx.fill();

    // Hinge line.
    ctx.strokeStyle = colorToCSS(this._darken(frameColor, 0.2));
    ctx.lineWidth = h * 0.006;
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + w, baseY);
    ctx.stroke();

    // Trackpad.
    const tpW = w * 0.25, tpH = baseH * 0.45;
    const tpX = x + (w - tpW) / 2;
    const tpY = baseY + (baseH - tpH) / 2;
    ctx.fillStyle = colorToCSS(this._darken(frameColor, 0.08));
    this._roundRect(tpX, tpY, tpW, tpH, tpH * 0.15);
    ctx.fill();

    // Keyboard hint — just a subtle gradient.
    const kbGrad = ctx.createLinearGradient(x + w * 0.1, baseY + 5, x + w * 0.1, baseY + baseH * 0.5);
    kbGrad.addColorStop(0, "rgba(0,0,0,0.08)");
    kbGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = kbGrad;
    ctx.fillRect(x + w * 0.1, baseY + 5, w * 0.8, baseH * 0.5);
  }

  private _drawIPad(el: ResolvedElementBase): void {
    const raw = el.raw;
    if (raw.type !== "device-ipad") return;

    const { ctx } = this;
    const { x, y, width: w, height: h } = el;

    const scheme = raw.colorScheme ?? "silver";
    const frameColor = this._deviceColor(scheme);
    const r = w * 0.05;
    const bezelH = h * 0.05;
    const bezelV = w * 0.04;

    if (raw.showShadow !== false) {
      ctx.shadowColor   = "rgba(0,0,0,0.35)";
      ctx.shadowBlur    = w * 0.06;
      ctx.shadowOffsetY = h * 0.02;
    }
    ctx.fillStyle = colorToCSS(frameColor);
    this._roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    const sx = x + bezelV, sy = y + bezelH;
    const sw = w - bezelV * 2, sh = h - bezelH * 2;
    const sr = r * 0.7;

    if (raw.screenContent) {
      ctx.save();
      this._clipRoundedRect(sx, sy, sw, sh, sr);
      ctx.clip();
      if (raw.screenContent instanceof HTMLCanvasElement) {
        ctx.drawImage(raw.screenContent, sx, sy, sw, sh);
      } else if (typeof raw.screenContent === "string") {
        const img = loadImage(raw.screenContent);
        if (img) ctx.drawImage(img, sx, sy, sw, sh);
        else { ctx.fillStyle = "#000"; ctx.fillRect(sx, sy, sw, sh); }
      }
      ctx.restore();
    } else {
      ctx.fillStyle = "#0a0a0a";
      this._roundRect(sx, sy, sw, sh, sr);
      ctx.fill();
    }

    // Home button indicator (Face ID iPad — just a subtle pill).
    const btnW = w * 0.015, btnH = h * 0.06;
    ctx.fillStyle = colorToCSS(this._darken(frameColor, 0.15));
    this._roundRect(x + w * 0.99, y + (h - btnH) / 2, btnW, btnH, btnW / 2);
    ctx.fill();
  }

  // ── Group ─────────────────────────────────────────────────────────────────────

  private _drawGroup(el: ResolvedElementBase): void {
    const raw = el.raw;
    if (raw.type !== "group") return;

    const { ctx } = this;

    if (raw.clipToBounds) {
      ctx.save();
      ctx.rect(el.x, el.y, el.width, el.height);
      ctx.clip();
    }

    // Groups children are already in the flat resolved list (handled by
    // Timeline), so we just need to clip.  In a future version the group
    // could have its own off-screen canvas for opacity/blend isolation.
    if (raw.clipToBounds) ctx.restore();
  }

  // ── Video playback ──────────────────────────────────────────────────────────

  private _drawVideoPlayback(el: ResolvedElementBase): void {
    const raw = el.raw;
    if (raw.type !== "video-playback") return;
    const { ctx } = this;

    let videoSource: HTMLVideoElement | null = null;
    if (typeof raw.src === "string") {
      // For string sources, we'd need a cached video element.
      // Skip rendering if source isn't loaded yet.
      return;
    } else {
      videoSource = raw.src as HTMLVideoElement;
    }

    if (!videoSource || videoSource.readyState < 2) return;

    // Set video playback time if specified.
    if (raw.currentTime !== undefined && Math.abs(videoSource.currentTime - raw.currentTime) > 0.05) {
      videoSource.currentTime = raw.currentTime;
    }

    const br = raw.borderRadius ?? 0;
    if (br > 0) {
      ctx.save();
      this._clipRoundedRect(el.x, el.y, el.width, el.height, br);
      ctx.clip();
    }

    // Object fit.
    const vw = videoSource.videoWidth || el.width;
    const vh = videoSource.videoHeight || el.height;
    const fit = raw.objectFit ?? "cover";
    const { sx, sy, sw, sh, dx, dy, dw, dh } = this._computeObjectFit(
      vw, vh, el.x, el.y, el.width, el.height, fit
    );

    ctx.drawImage(videoSource, sx, sy, sw, sh, dx, dy, dw, dh);

    if (br > 0) ctx.restore();
  }

  // ── Custom cursor ──────────────────────────────────────────────────────────

  private _drawCustomCursor(el: ResolvedElementBase): void {
    const raw = el.raw;
    if (raw.type !== "custom-cursor") return;
    const { ctx } = this;
    const { cursorStyle } = raw;
    const cx = el.x;
    const cy = el.y;
    const size = cursorStyle.size;
    const color = colorToCSS(cursorStyle.color);

    // Click scale animation.
    const clickScale = raw.isClicking
      ? 0.85 + 0.15 * (1 - (raw.clickProgress ?? 0))
      : 1.0;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(clickScale, clickScale);

    switch (cursorStyle.type) {
      case "dot": {
        const r = size / 2;
        // Glow
        ctx.shadowColor = color;
        ctx.shadowBlur = size * 0.4;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case "ring": {
        const r = size / 2;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        // Center dot.
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "crosshair": {
        const armLen = size / 2;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-armLen, 0); ctx.lineTo(armLen, 0);
        ctx.moveTo(0, -armLen); ctx.lineTo(0, armLen);
        ctx.stroke();
        break;
      }
      case "pointer":
      case "default":
      default: {
        // Arrow cursor path
        ctx.fillStyle = color;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const s = size / 24; // normalise to 24px design
        ctx.moveTo(0, 0);
        ctx.lineTo(0, s * 20);
        ctx.lineTo(s * 5.5, s * 15.5);
        ctx.lineTo(s * 9, s * 22);
        ctx.lineTo(s * 12, s * 20.5);
        ctx.lineTo(s * 8, s * 14);
        ctx.lineTo(s * 14, s * 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
    }

    ctx.restore();
  }

  // ── Ripple effect ──────────────────────────────────────────────────────────

  private _drawRippleEffect(el: ResolvedElementBase): void {
    const raw = el.raw;
    if (raw.type !== "ripple-effect") return;
    const { ctx } = this;
    const cx = el.x;
    const cy = el.y;
    const { rippleColor, progress, maxRadius, rings = 2, strokeWidth = 2 } = raw;

    if (progress <= 0 || progress >= 1) return;

    const alpha = 1 - progress; // fade out as ripple expands

    ctx.save();

    for (let i = 0; i < rings; i++) {
      const ringProgress = Math.max(0, progress - i * 0.15);
      if (ringProgress <= 0) continue;

      const radius = ringProgress * maxRadius;
      const ringAlpha = alpha * (1 - i * 0.3);
      const sw = strokeWidth * (1 - ringProgress * 0.5);

      ctx.strokeStyle = colorToCSS({
        ...rippleColor,
        a: rippleColor.a * ringAlpha,
      });
      ctx.lineWidth = Math.max(0.5, sw);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ── Blur region ────────────────────────────────────────────────────────────

  private _drawBlurRegion(el: ResolvedElementBase): void {
    const raw = el.raw;
    if (raw.type !== "blur-region") return;
    const { ctx } = this;

    if (raw.invert) {
      // Invert mode: blur everything EXCEPT this region.
      // This is the "focus blur" / depth-of-field effect.
      // We draw the current canvas content blurred, then clip-redraw the focus area.

      // Capture current canvas content.
      const canvas = ctx.canvas;
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(canvas, 0, 0);

      // Draw blurred version over everything.
      ctx.save();
      ctx.filter = `blur(${raw.blurAmount}px)`;
      ctx.drawImage(canvas, 0, 0, canvas.width / this._dpr, canvas.height / this._dpr);
      ctx.filter = "none";

      // Clip the focus region and redraw unblurred content.
      ctx.save();
      if (raw.shape === "circle") {
        const r = Math.min(el.width, el.height) / 2;
        ctx.beginPath();
        ctx.arc(el.x + el.width / 2, el.y + el.height / 2, r, 0, Math.PI * 2);
        ctx.clip();
      } else if (raw.shape === "rounded-rect") {
        this._clipRoundedRect(el.x, el.y, el.width, el.height, raw.borderRadius ?? 8);
        ctx.clip();
      } else {
        ctx.beginPath();
        ctx.rect(el.x, el.y, el.width, el.height);
        ctx.clip();
      }

      // Redraw the unblurred content in the focus region.
      ctx.drawImage(tempCanvas, 0, 0, canvas.width / this._dpr, canvas.height / this._dpr);
      ctx.restore();
      ctx.restore();

    } else {
      // Normal mode: blur just this region.
      ctx.save();

      if (raw.shape === "circle") {
        const r = Math.min(el.width, el.height) / 2;
        ctx.beginPath();
        ctx.arc(el.x + el.width / 2, el.y + el.height / 2, r, 0, Math.PI * 2);
        ctx.clip();
      } else if (raw.shape === "rounded-rect") {
        this._clipRoundedRect(el.x, el.y, el.width, el.height, raw.borderRadius ?? 8);
        ctx.clip();
      } else {
        ctx.beginPath();
        ctx.rect(el.x, el.y, el.width, el.height);
        ctx.clip();
      }

      ctx.filter = `blur(${raw.blurAmount}px)`;
      ctx.drawImage(ctx.canvas, 0, 0, ctx.canvas.width / this._dpr, ctx.canvas.height / this._dpr);
      ctx.filter = "none";

      // Tint overlay.
      if (raw.tintColor) {
        ctx.fillStyle = colorToCSS(raw.tintColor);
        ctx.fillRect(el.x, el.y, el.width, el.height);
      }

      ctx.restore();
    }
  }

  // ── Gradient resolution ───────────────────────────────────────────────────────

  private _resolvePaint(
    paint: Color | GradientDef,
    x: number, y: number, w: number, h: number
  ): string | CanvasGradient {
    if ("r" in paint) return colorToCSS(paint);

    switch ((paint as GradientDef).type) {
      case "linear":  return this._buildLinearGradient(paint as LinearGradient, x, y, w, h);
      case "radial":  return this._buildRadialGradient(paint as RadialGradient, x, y, w, h);
      case "angular": return this._buildAngularGradient(paint as AngularGradient, x, y, w, h);
    }
  }

  private _buildLinearGradient(g: LinearGradient, x: number, y: number, w: number, h: number): CanvasGradient {
    const { ctx } = this;
    const rad = (g.angle * Math.PI) / 180;
    const cx = x + w / 2, cy = y + h / 2;
    const dx = Math.sin(rad), dy = -Math.cos(rad);
    // Project half-diagonal onto the gradient vector.
    const halfLen = (Math.abs(dx * w) + Math.abs(dy * h)) / 2;
    const grad = ctx.createLinearGradient(
      cx - dx * halfLen, cy - dy * halfLen,
      cx + dx * halfLen, cy + dy * halfLen
    );
    this._addStops(grad, g.stops);
    return grad;
  }

  private _buildRadialGradient(g: RadialGradient, x: number, y: number, w: number, h: number): CanvasGradient {
    const { ctx } = this;
    const cx = x + w * g.centerX;
    const cy = y + h * g.centerY;
    const r  = Math.min(w, h) * g.radius;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    this._addStops(grad, g.stops);
    return grad;
  }

  /** Angular (conic) gradients are approximated with multiple linear segments. */
  private _buildAngularGradient(g: AngularGradient, x: number, y: number, w: number, h: number): CanvasGradient {
    // Fall back to a simple linear gradient using the first and last stop.
    const { ctx } = this;
    const cx = x + w * g.centerX;
    const cy = y + h * g.centerY;
    const rad = (g.startAngle * Math.PI) / 180;
    const len = Math.max(w, h);
    const grad = ctx.createLinearGradient(
      cx, cy,
      cx + Math.cos(rad) * len, cy + Math.sin(rad) * len
    );
    this._addStops(grad, g.stops);
    return grad;
  }

  private _addStops(grad: CanvasGradient, stops: GradientStop[]): void {
    for (const s of stops) {
      grad.addColorStop(Math.max(0, Math.min(1, s.offset)), colorToCSS(s.color));
    }
  }

  // ── Canvas path helpers ───────────────────────────────────────────────────────

  /** Draw a rounded-rect path.  Accepts uniform or per-corner radius. */
  private _roundRect(
    x: number, y: number, w: number, h: number,
    radius: number | { tl: number; tr: number; br: number; bl: number }
  ): void {
    const { ctx } = this;
    let tl: number, tr: number, br: number, bl: number;
    if (typeof radius === "number") {
      tl = tr = br = bl = Math.min(radius, w / 2, h / 2);
    } else {
      tl = radius.tl; tr = radius.tr; br = radius.br; bl = radius.bl;
    }
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.arcTo(x + w, y,     x + w, y + h, tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.arcTo(x + w, y + h, x,     y + h, br);
    ctx.lineTo(x + bl, y + h);
    ctx.arcTo(x,     y + h, x,     y,     bl);
    ctx.lineTo(x, y + tl);
    ctx.arcTo(x,     y,     x + w, y,     tl);
    ctx.closePath();
  }

  // ── Device colour helpers ─────────────────────────────────────────────────────

  private _deviceColor(scheme: string): Color {
    const map: Record<string, Color> = {
      "silver":     { r: 229, g: 229, b: 229, a: 1 },
      "space-gray": { r: 72,  g: 72,  b: 74,  a: 1 },
      "gold":       { r: 230, g: 185, b: 150, a: 1 },
      "midnight":   { r: 28,  g: 28,  b: 40,  a: 1 },
      "starlight":  { r: 235, g: 225, b: 210, a: 1 },
    };
    return map[scheme] ?? map["midnight"]!;
  }

  private _darken(c: Color, amount: number): Color {
    return {
      r: Math.max(0, Math.round(c.r * (1 - amount))),
      g: Math.max(0, Math.round(c.g * (1 - amount))),
      b: Math.max(0, Math.round(c.b * (1 - amount))),
      a: c.a,
    };
  }

  private _lighten(c: Color, amount: number): Color {
    return {
      r: Math.min(255, Math.round(c.r + (255 - c.r) * amount)),
      g: Math.min(255, Math.round(c.g + (255 - c.g) * amount)),
      b: Math.min(255, Math.round(c.b + (255 - c.b) * amount)),
      a: c.a,
    };
  }
}

// ─── Standalone renderFrame helper ───────────────────────────────────────────
// Useful for one-shot renders (thumbnails, first-frame previews, etc.).

export function createRenderer(config: RendererConfig): CanvasRenderer {
  return new CanvasRenderer(config);
}

// Re-export Scene type for convenience.
export type { Scene, ResolvedScene };
