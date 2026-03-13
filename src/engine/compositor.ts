/**
 * Compositor — multi-layer frame assembly for enhanced screen recordings.
 *
 * Layer order (bottom to top):
 *  1. Background (gradient / solid / blur)
 *  2. Device mockup frame
 *  3. Video content (with camera transform applied)
 *  4. Focus blur overlay
 *  5. Custom cursor + trail
 *  6. Click ripple effects
 *  7. Text overlays
 *  8. Film grain / noise overlay
 *
 * The compositor owns its own off-screen canvases and assembles the final
 * frame by compositing layers in order. It does NOT use the engine's
 * SceneElement system — it draws directly for maximum control.
 */

import type { Color } from "./scene";
import { colorToCSS, hexToColor, makeColor } from "./scene";
import type { CameraState } from "./camera-system";
import { CameraSystem, applyFocusBlur } from "./camera-system";
import { CursorEngine } from "./cursor-engine";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CompositorConfig {
  /** Output canvas dimensions */
  outputWidth: number;
  outputHeight: number;
  /** Source video dimensions */
  sourceWidth: number;
  sourceHeight: number;
  /** Output FPS */
  fps: number;
}

export interface BackgroundStyle {
  type: "solid" | "gradient" | "blur";
  /** Solid color */
  color?: Color;
  /** Gradient stops */
  gradientStops?: Array<{ offset: number; color: Color }>;
  /** Gradient angle in degrees (for linear gradient) */
  gradientAngle?: number;
  /** Gradient type */
  gradientType?: "linear" | "radial";
  /** Blur amount (for blur type — blurs the video content beneath) */
  blurAmount?: number;
  /** Background padding (fraction of output dimensions) */
  padding?: number;
}

export type DeviceFrame = "none" | "iphone" | "macbook" | "ipad" | "browser" | "minimal";

export interface DeviceFrameConfig {
  type: DeviceFrame;
  /** Device frame color scheme */
  colorScheme?: "silver" | "space-gray" | "midnight" | "starlight";
  /** Show device shadow */
  showShadow?: boolean;
  /** Perspective angle (0 = front-on) */
  perspective?: number;
  /** Glass reflection effect */
  showReflection?: boolean;
}

export interface TextOverlay {
  id: string;
  /** Text content */
  text: string;
  /** Position (normalised 0-1 within output canvas) */
  x: number;
  y: number;
  /** Font size in px */
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  /** Text color */
  color: Color;
  /** Text alignment */
  textAlign: CanvasTextAlign;
  /** Appear/disappear times (seconds) */
  startTime: number;
  endTime: number;
  /** Animation */
  animation?: "fade" | "slide-up" | "slide-down" | "typewriter";
  /** Animation duration (seconds) */
  animationDuration?: number;
  /** Background pill behind text */
  background?: Color;
  backgroundPadding?: number;
  backgroundRadius?: number;
}

export interface GrainConfig {
  /** Grain intensity (0-1). Default 0.03 */
  intensity?: number;
  /** Grain size multiplier. Default 1.0 */
  size?: number;
  /** Whether grain is enabled */
  enabled?: boolean;
}

export interface CompositorLayers {
  background?: BackgroundStyle;
  deviceFrame?: DeviceFrameConfig;
  textOverlays?: TextOverlay[];
  grain?: GrainConfig;
  focusBlur?: { enabled: boolean; blurRadius: number; focusSize: number };
}

// ─── Background presets ──────────────────────────────────────────────────────

export const BACKGROUND_PRESETS: Record<string, BackgroundStyle> = {
  "midnight-gradient": {
    type: "gradient",
    gradientType: "radial",
    gradientStops: [
      { offset: 0, color: makeColor(30, 27, 75) },
      { offset: 0.5, color: makeColor(15, 12, 41) },
      { offset: 1, color: makeColor(5, 3, 20) },
    ],
    padding: 0.08,
  },
  "aurora-gradient": {
    type: "gradient",
    gradientType: "linear",
    gradientAngle: 135,
    gradientStops: [
      { offset: 0, color: makeColor(5, 30, 25) },
      { offset: 0.5, color: makeColor(16, 185, 129) },
      { offset: 1, color: makeColor(5, 15, 30) },
    ],
    padding: 0.08,
  },
  "ember-gradient": {
    type: "gradient",
    gradientType: "linear",
    gradientAngle: 160,
    gradientStops: [
      { offset: 0, color: makeColor(40, 10, 0) },
      { offset: 0.5, color: makeColor(249, 115, 22) },
      { offset: 1, color: makeColor(20, 5, 0) },
    ],
    padding: 0.08,
  },
  "frost-gradient": {
    type: "gradient",
    gradientType: "linear",
    gradientAngle: 180,
    gradientStops: [
      { offset: 0, color: makeColor(15, 23, 42) },
      { offset: 0.5, color: makeColor(59, 130, 246) },
      { offset: 1, color: makeColor(10, 15, 30) },
    ],
    padding: 0.08,
  },
  "noir": {
    type: "solid",
    color: makeColor(10, 10, 10),
    padding: 0.06,
  },
  "clean-white": {
    type: "solid",
    color: makeColor(245, 245, 245),
    padding: 0.08,
  },
  "blurred": {
    type: "blur",
    blurAmount: 30,
    padding: 0.06,
  },
};

// ─── Compositor class ────────────────────────────────────────────────────────

export class Compositor {
  private _config: CompositorConfig;
  private _layers: CompositorLayers;
  private _cameraSystem: CameraSystem | null = null;
  private _cursorEngine: CursorEngine | null = null;

  /** Off-screen canvas for video content (with camera transform) */
  private _videoCanvas: HTMLCanvasElement;
  private _videoCtx: CanvasRenderingContext2D;

  /** Off-screen canvas for compositing layers */
  private _compCanvas: HTMLCanvasElement;
  private _compCtx: CanvasRenderingContext2D;

  constructor(config: CompositorConfig) {
    this._config = config;
    this._layers = {};

    // Create off-screen canvases
    this._videoCanvas = document.createElement("canvas");
    this._videoCanvas.width = config.sourceWidth;
    this._videoCanvas.height = config.sourceHeight;
    this._videoCtx = this._videoCanvas.getContext("2d")!;

    this._compCanvas = document.createElement("canvas");
    this._compCanvas.width = config.outputWidth;
    this._compCanvas.height = config.outputHeight;
    this._compCtx = this._compCanvas.getContext("2d")!;
  }

  // ── Configuration ──────────────────────────────────────────────────────────

  setLayers(layers: CompositorLayers): this {
    this._layers = { ...this._layers, ...layers };
    return this;
  }

  setCameraSystem(camera: CameraSystem): this {
    this._cameraSystem = camera;
    return this;
  }

  setCursorEngine(cursor: CursorEngine): this {
    this._cursorEngine = cursor;
    return this;
  }

  get outputCanvas(): HTMLCanvasElement {
    return this._compCanvas;
  }

  // ── Main compositing method ────────────────────────────────────────────────

  /**
   * Composite a single frame at the given time.
   *
   * @param sourceFrame  The source video frame (canvas or video element)
   * @param time         Current time in seconds
   * @param output       Target canvas to draw the composited frame onto
   */
  compositeFrame(
    sourceFrame: HTMLCanvasElement | HTMLVideoElement,
    time: number,
    output: HTMLCanvasElement
  ): void {
    const outCtx = output.getContext("2d")!;
    const { outputWidth: ow, outputHeight: oh, sourceWidth: sw, sourceHeight: sh } = this._config;

    // Get camera state
    const cameraState = this._cameraSystem?.getStateAtTime(time) ?? {
      x: 0.5, y: 0.5, zoom: 1.0, rotation: 0,
    };

    // ── Layer 1: Background ──────────────────────────────────────────────
    this._drawBackground(outCtx, ow, oh, sourceFrame);

    // ── Layer 2: Video content with camera transform ─────────────────────
    // Draw source to internal video canvas with camera transform
    this._videoCtx.clearRect(0, 0, sw, sh);
    this._videoCtx.save();

    // Apply camera transform
    this._applyCameraTransform(this._videoCtx, cameraState, sw, sh);
    this._videoCtx.drawImage(sourceFrame, 0, 0, sw, sh);
    this._videoCtx.restore();

    // ── Layer 3: Focus blur ──────────────────────────────────────────────
    if (this._layers.focusBlur?.enabled && this._cameraSystem) {
      applyFocusBlur(
        this._videoCtx,
        this._videoCanvas,
        { x: cameraState.x * sw, y: cameraState.y * sh },
        {
          blurRadius: this._layers.focusBlur.blurRadius,
          focusSize: this._layers.focusBlur.focusSize,
          enabled: true,
        }
      );
    }

    // ── Layer 4: Device frame + composited video ──────────────────────────
    const padding = this._layers.background?.padding ?? 0;
    const contentRect = this._computeContentRect(ow, oh, padding);

    if (this._layers.deviceFrame && this._layers.deviceFrame.type !== "none") {
      this._drawDeviceFrame(outCtx, contentRect, this._videoCanvas);
    } else {
      // Draw video content directly into content area
      outCtx.drawImage(
        this._videoCanvas,
        0, 0, sw, sh,
        contentRect.x, contentRect.y, contentRect.w, contentRect.h
      );
    }

    // ── Layer 5: Cursor + trail ──────────────────────────────────────────
    if (this._cursorEngine) {
      outCtx.save();
      // Transform cursor coordinates from source space to output space
      const scaleX = contentRect.w / sw;
      const scaleY = contentRect.h / sh;
      outCtx.translate(contentRect.x, contentRect.y);
      outCtx.scale(scaleX, scaleY);

      this._cursorEngine.renderAll(outCtx, time);

      outCtx.restore();
    }

    // ── Layer 6: Text overlays ───────────────────────────────────────────
    if (this._layers.textOverlays) {
      for (const overlay of this._layers.textOverlays) {
        if (time >= overlay.startTime && time <= overlay.endTime) {
          this._drawTextOverlay(outCtx, overlay, time, ow, oh);
        }
      }
    }

    // ── Layer 7: Film grain ──────────────────────────────────────────────
    if (this._layers.grain?.enabled) {
      this._drawGrain(outCtx, ow, oh, this._layers.grain);
    }
  }

  // ── Private rendering methods ──────────────────────────────────────────────

  private _drawBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sourceFrame?: HTMLCanvasElement | HTMLVideoElement
  ): void {
    const bg = this._layers.background;

    if (!bg) {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);
      return;
    }

    switch (bg.type) {
      case "solid":
        ctx.fillStyle = bg.color ? colorToCSS(bg.color) : "#0a0a0a";
        ctx.fillRect(0, 0, w, h);
        break;

      case "gradient":
        this._drawGradientBackground(ctx, w, h, bg);
        break;

      case "blur":
        if (sourceFrame) {
          ctx.save();
          ctx.filter = `blur(${bg.blurAmount ?? 30}px)`;
          // Draw scaled-up source as blurred background
          ctx.drawImage(sourceFrame, -20, -20, w + 40, h + 40);
          ctx.filter = "none";
          // Darken overlay
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
        break;
    }
  }

  private _drawGradientBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    bg: BackgroundStyle
  ): void {
    const stops = bg.gradientStops ?? [];
    if (stops.length === 0) return;

    let grad: CanvasGradient;

    if (bg.gradientType === "radial") {
      const cx = w / 2, cy = h / 2;
      const r = Math.max(w, h) * 0.7;
      grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    } else {
      const angle = ((bg.gradientAngle ?? 180) * Math.PI) / 180;
      const cx = w / 2, cy = h / 2;
      const dx = Math.sin(angle), dy = -Math.cos(angle);
      const len = (Math.abs(dx * w) + Math.abs(dy * h)) / 2;
      grad = ctx.createLinearGradient(
        cx - dx * len, cy - dy * len,
        cx + dx * len, cy + dy * len
      );
    }

    for (const stop of stops) {
      grad.addColorStop(
        Math.max(0, Math.min(1, stop.offset)),
        colorToCSS(stop.color)
      );
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  private _applyCameraTransform(
    ctx: CanvasRenderingContext2D,
    state: CameraState,
    sw: number,
    sh: number
  ): void {
    const centerX = sw / 2;
    const centerY = sh / 2;
    const camX = state.x * sw;
    const camY = state.y * sh;

    ctx.translate(centerX, centerY);
    ctx.scale(state.zoom, state.zoom);
    if (state.rotation !== 0) {
      ctx.rotate((state.rotation * Math.PI) / 180);
    }
    ctx.translate(-camX, -camY);
  }

  private _computeContentRect(
    ow: number,
    oh: number,
    padding: number
  ): { x: number; y: number; w: number; h: number } {
    const padX = ow * padding;
    const padY = oh * padding;
    const availW = ow - padX * 2;
    const availH = oh - padY * 2;

    // Fit source aspect ratio within available space
    const srcAspect = this._config.sourceWidth / this._config.sourceHeight;
    const availAspect = availW / availH;

    let w: number, h: number;
    if (srcAspect > availAspect) {
      w = availW;
      h = availW / srcAspect;
    } else {
      h = availH;
      w = availH * srcAspect;
    }

    return {
      x: (ow - w) / 2,
      y: (oh - h) / 2,
      w,
      h,
    };
  }

  private _drawDeviceFrame(
    ctx: CanvasRenderingContext2D,
    contentRect: { x: number; y: number; w: number; h: number },
    videoCanvas: HTMLCanvasElement
  ): void {
    const device = this._layers.deviceFrame!;
    const { x, y, w, h } = contentRect;

    switch (device.type) {
      case "browser":
        this._drawBrowserFrame(ctx, x, y, w, h, videoCanvas, device);
        break;
      case "minimal":
        this._drawMinimalFrame(ctx, x, y, w, h, videoCanvas, device);
        break;
      case "iphone":
      case "macbook":
      case "ipad":
        // For device mockups, shrink content to fit inside device chrome
        this._drawDeviceMockup(ctx, x, y, w, h, videoCanvas, device);
        break;
      default:
        ctx.drawImage(videoCanvas, 0, 0, videoCanvas.width, videoCanvas.height, x, y, w, h);
    }
  }

  private _drawBrowserFrame(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    videoCanvas: HTMLCanvasElement,
    device: DeviceFrameConfig
  ): void {
    const titleBarH = h * 0.04;
    const radius = w * 0.01;
    const frameColor = device.colorScheme === "midnight"
      ? makeColor(30, 30, 35)
      : makeColor(60, 60, 65);

    // Shadow
    if (device.showShadow !== false) {
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = w * 0.04;
      ctx.shadowOffsetY = h * 0.015;
    }

    // Title bar
    ctx.fillStyle = colorToCSS(frameColor);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.arcTo(x + w, y, x + w, y + titleBarH, radius);
    ctx.lineTo(x + w, y + titleBarH);
    ctx.lineTo(x, y + titleBarH);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Traffic lights
    const dotR = titleBarH * 0.18;
    const dotY = y + titleBarH / 2;
    const dotStartX = x + titleBarH * 0.5;
    const dotColors = ["#ff5f57", "#febd2e", "#28c940"];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = dotColors[i];
      ctx.beginPath();
      ctx.arc(dotStartX + i * (dotR * 3), dotY, dotR, 0, Math.PI * 2);
      ctx.fill();
    }

    // URL bar
    const urlBarW = w * 0.35;
    const urlBarH = titleBarH * 0.5;
    const urlBarX = x + (w - urlBarW) / 2;
    const urlBarY = y + (titleBarH - urlBarH) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    const urlBarR = urlBarH / 2;
    ctx.beginPath();
    ctx.moveTo(urlBarX + urlBarR, urlBarY);
    ctx.lineTo(urlBarX + urlBarW - urlBarR, urlBarY);
    ctx.arcTo(urlBarX + urlBarW, urlBarY, urlBarX + urlBarW, urlBarY + urlBarH, urlBarR);
    ctx.arcTo(urlBarX + urlBarW, urlBarY + urlBarH, urlBarX, urlBarY + urlBarH, urlBarR);
    ctx.arcTo(urlBarX, urlBarY + urlBarH, urlBarX, urlBarY, urlBarR);
    ctx.arcTo(urlBarX, urlBarY, urlBarX + urlBarW, urlBarY, urlBarR);
    ctx.closePath();
    ctx.fill();

    // Content area
    const contentY = y + titleBarH;
    const contentH = h - titleBarH;

    // Bottom rounded corners for content
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, contentY);
    ctx.lineTo(x + w, contentY);
    ctx.lineTo(x + w, y + h - radius);
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h);
    ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      videoCanvas,
      0, 0, videoCanvas.width, videoCanvas.height,
      x, contentY, w, contentH
    );
    ctx.restore();

    // Glass reflection
    if (device.showReflection) {
      const reflGrad = ctx.createLinearGradient(x, y, x + w * 0.5, y + h * 0.5);
      reflGrad.addColorStop(0, "rgba(255,255,255,0.06)");
      reflGrad.addColorStop(0.5, "rgba(255,255,255,0)");
      reflGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = reflGrad;
      ctx.fillRect(x, y, w, h);
    }
  }

  private _drawMinimalFrame(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    videoCanvas: HTMLCanvasElement,
    device: DeviceFrameConfig
  ): void {
    const radius = w * 0.015;
    const borderWidth = 2;

    // Shadow
    if (device.showShadow !== false) {
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = w * 0.035;
      ctx.shadowOffsetY = h * 0.012;
    }

    // Rounded clip
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.clip();

    ctx.drawImage(
      videoCanvas,
      0, 0, videoCanvas.width, videoCanvas.height,
      x, y, w, h
    );

    // Border
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = borderWidth;
    ctx.stroke();

    ctx.restore();
  }

  private _drawDeviceMockup(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    videoCanvas: HTMLCanvasElement,
    device: DeviceFrameConfig
  ): void {
    // For device mockups, we shrink the content area and add device chrome
    // The content rect already accounts for padding, so we render the device
    // filling the available space and put the video inside the screen area.

    const colorMap: Record<string, Color> = {
      "silver": makeColor(229, 229, 229),
      "space-gray": makeColor(72, 72, 74),
      "midnight": makeColor(28, 28, 40),
      "starlight": makeColor(235, 225, 210),
    };
    const frameColor = colorMap[device.colorScheme ?? "midnight"] ?? colorMap["midnight"];

    if (device.type === "macbook") {
      const lidH = h * 0.72;
      const baseH = h * 0.28;
      const r = w * 0.012;

      // Shadow
      if (device.showShadow !== false) {
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = w * 0.05;
        ctx.shadowOffsetY = h * 0.02;
      }

      // Lid
      ctx.fillStyle = colorToCSS(frameColor);
      this._roundRect(ctx, x, y, w, lidH, r);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Screen
      const bezel = w * 0.025;
      const scrX = x + bezel;
      const scrY = y + bezel;
      const scrW = w - bezel * 2;
      const scrH = lidH - bezel * 1.5;

      ctx.save();
      this._roundRect(ctx, scrX, scrY, scrW, scrH, r * 0.6);
      ctx.clip();
      ctx.drawImage(videoCanvas, 0, 0, videoCanvas.width, videoCanvas.height, scrX, scrY, scrW, scrH);
      ctx.restore();

      // Base
      const baseY = y + lidH;
      ctx.fillStyle = colorToCSS(this._lighten(frameColor, 0.05));
      this._roundRect(ctx, x, baseY, w, baseH, { tl: 0, tr: 0, br: w * 0.02, bl: w * 0.02 });
      ctx.fill();

      // Hinge
      ctx.strokeStyle = colorToCSS(this._darken(frameColor, 0.2));
      ctx.lineWidth = h * 0.004;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + w, baseY);
      ctx.stroke();

    } else if (device.type === "iphone") {
      const r = w * 0.12;
      const bezelH = h * 0.04;
      const bezelV = w * 0.05;

      if (device.showShadow !== false) {
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = w * 0.08;
        ctx.shadowOffsetY = h * 0.03;
      }

      ctx.fillStyle = colorToCSS(frameColor);
      this._roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Screen
      const sx = x + bezelV;
      const sy = y + bezelH;
      const sw = w - bezelV * 2;
      const sh = h - bezelH * 2;
      const sr = r * 0.8;

      ctx.save();
      this._roundRect(ctx, sx, sy, sw, sh, sr);
      ctx.clip();
      ctx.drawImage(videoCanvas, 0, 0, videoCanvas.width, videoCanvas.height, sx, sy, sw, sh);
      ctx.restore();

      // Dynamic Island
      const diW = w * 0.28, diH = h * 0.025;
      const diX = x + (w - diW) / 2;
      const diY = y + bezelH * 0.4;
      ctx.fillStyle = "#000";
      this._roundRect(ctx, diX, diY, diW, diH, diH / 2);
      ctx.fill();

    } else if (device.type === "ipad") {
      const r = w * 0.05;
      const bezelH = h * 0.05;
      const bezelV = w * 0.04;

      if (device.showShadow !== false) {
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = w * 0.06;
        ctx.shadowOffsetY = h * 0.02;
      }

      ctx.fillStyle = colorToCSS(frameColor);
      this._roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      const sx = x + bezelV;
      const sy = y + bezelH;
      const sw = w - bezelV * 2;
      const sh = h - bezelH * 2;
      const sr = r * 0.7;

      ctx.save();
      this._roundRect(ctx, sx, sy, sw, sh, sr);
      ctx.clip();
      ctx.drawImage(videoCanvas, 0, 0, videoCanvas.width, videoCanvas.height, sx, sy, sw, sh);
      ctx.restore();
    }
  }

  private _drawTextOverlay(
    ctx: CanvasRenderingContext2D,
    overlay: TextOverlay,
    time: number,
    ow: number,
    oh: number
  ): void {
    const elapsed = time - overlay.startTime;
    const remaining = overlay.endTime - time;
    const animDur = overlay.animationDuration ?? 0.3;

    // Compute opacity & offset based on animation
    let opacity = 1;
    let offsetY = 0;

    if (overlay.animation === "fade") {
      if (elapsed < animDur) opacity = elapsed / animDur;
      if (remaining < animDur) opacity = Math.min(opacity, remaining / animDur);
    } else if (overlay.animation === "slide-up") {
      if (elapsed < animDur) {
        const t = elapsed / animDur;
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        opacity = eased;
        offsetY = (1 - eased) * 30;
      }
      if (remaining < animDur) {
        opacity = Math.min(opacity, remaining / animDur);
      }
    } else if (overlay.animation === "slide-down") {
      if (elapsed < animDur) {
        const t = elapsed / animDur;
        const eased = 1 - Math.pow(1 - t, 3);
        opacity = eased;
        offsetY = -(1 - eased) * 30;
      }
      if (remaining < animDur) {
        opacity = Math.min(opacity, remaining / animDur);
      }
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

    const textX = overlay.x * ow;
    const textY = overlay.y * oh + offsetY;

    // Set font
    ctx.font = `${overlay.fontWeight} ${overlay.fontSize}px ${overlay.fontFamily}`;
    ctx.textAlign = overlay.textAlign;
    ctx.textBaseline = "top";

    // Typewriter effect
    let displayText = overlay.text;
    if (overlay.animation === "typewriter" && elapsed < animDur * 2) {
      const charCount = Math.floor(
        (elapsed / (animDur * 2)) * overlay.text.length
      );
      displayText = overlay.text.substring(0, charCount);
    }

    // Background pill
    if (overlay.background) {
      const pad = overlay.backgroundPadding ?? 12;
      const metrics = ctx.measureText(displayText);
      const bgW = metrics.width + pad * 2;
      const bgH = overlay.fontSize * 1.4 + pad * 2;
      const bgX = overlay.textAlign === "center"
        ? textX - bgW / 2
        : overlay.textAlign === "right"
          ? textX - bgW
          : textX;
      const bgY = textY - pad;
      const bgR = overlay.backgroundRadius ?? 8;

      ctx.fillStyle = colorToCSS(overlay.background);
      this._roundRect(ctx, bgX, bgY, bgW, bgH, bgR);
      ctx.fill();
    }

    // Text
    ctx.fillStyle = colorToCSS(overlay.color);
    ctx.fillText(displayText, textX, textY);

    ctx.restore();
  }

  private _drawGrain(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    config: GrainConfig
  ): void {
    const intensity = config.intensity ?? 0.03;
    const size = config.size ?? 1;

    // For performance, generate a small noise tile and tile it
    const tileSize = 128;
    const tileCanvas = document.createElement("canvas");
    tileCanvas.width = tileSize;
    tileCanvas.height = tileSize;
    const tileCtx = tileCanvas.getContext("2d")!;

    const imageData = tileCtx.createImageData(tileSize, tileSize);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 255 * intensity;
      data[i] = 128 + noise;
      data[i + 1] = 128 + noise;
      data[i + 2] = 128 + noise;
      data[i + 3] = 255 * intensity;
    }

    tileCtx.putImageData(imageData, 0, 0);

    // Tile across output
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    if (size !== 1) ctx.scale(size, size);

    const pattern = ctx.createPattern(tileCanvas, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      const tileW = size !== 1 ? w / size : w;
      const tileH = size !== 1 ? h / size : h;
      ctx.fillRect(0, 0, tileW, tileH);
    }

    ctx.restore();
  }

  // ── Canvas helpers ─────────────────────────────────────────────────────────

  private _roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    radius: number | { tl: number; tr: number; br: number; bl: number }
  ): void {
    let tl: number, tr: number, br: number, bl: number;
    if (typeof radius === "number") {
      tl = tr = br = bl = Math.min(radius, w / 2, h / 2);
    } else {
      tl = radius.tl; tr = radius.tr; br = radius.br; bl = radius.bl;
    }
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.arcTo(x + w, y, x + w, y + h, tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.arcTo(x + w, y + h, x, y + h, br);
    ctx.lineTo(x + bl, y + h);
    ctx.arcTo(x, y + h, x, y, bl);
    ctx.lineTo(x, y + tl);
    ctx.arcTo(x, y, x + w, y, tl);
    ctx.closePath();
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

// ─── Export format definitions ────────────────────────────────────────────────

export interface ExportFormat {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  description: string;
}

export const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: "1080p",
    name: "Full HD (1080p)",
    width: 1920,
    height: 1080,
    fps: 60,
    bitrate: 8_000_000,
    description: "Best for YouTube, website embeds, presentations",
  },
  {
    id: "720p",
    name: "HD (720p)",
    width: 1280,
    height: 720,
    fps: 30,
    bitrate: 5_000_000,
    description: "Good balance of quality and file size",
  },
  {
    id: "4k",
    name: "4K Ultra HD",
    width: 3840,
    height: 2160,
    fps: 30,
    bitrate: 20_000_000,
    description: "Maximum quality for large displays",
  },
  {
    id: "twitter",
    name: "Twitter / X",
    width: 1280,
    height: 720,
    fps: 30,
    bitrate: 5_000_000,
    description: "Optimised for Twitter video",
  },
  {
    id: "instagram",
    name: "Instagram",
    width: 1080,
    height: 1080,
    fps: 30,
    bitrate: 5_000_000,
    description: "Square format for Instagram feed",
  },
  {
    id: "tiktok",
    name: "TikTok / Reels",
    width: 1080,
    height: 1920,
    fps: 30,
    bitrate: 5_000_000,
    description: "Vertical format for short-form video",
  },
  {
    id: "gif-preview",
    name: "GIF Preview",
    width: 640,
    height: 360,
    fps: 15,
    bitrate: 2_000_000,
    description: "Low-res preview for sharing",
  },
];
