/**
 * @module demo-exporter
 *
 * Pure TypeScript module (no React) for exporting demos to various formats.
 *
 * Export formats
 * ──────────────
 *  • HTML Bundle  — self-contained single-file HTML with inlined assets
 *  • MP4 Video    — frame-by-frame WebCodecs encode via SpotlightEncoder
 *  • GIF          — sequential frame capture with LZW encoding
 *  • JSON         — full demo round-trip serialisation
 *  • Shareable link — base64-compressed URL hash or localStorage-backed URL
 */

import type { Demo, DemoStep } from "./demo-engine";
import { SpotlightEncoder } from "./encoder";

// ─── Download helper ──────────────────────────────────────────────────────────

/**
 * Trigger a browser download for any Blob.
 * @param blob      The Blob to download.
 * @param filename  Suggested file name (e.g. "demo.html").
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 5000);
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Load an HTMLImageElement from a data URL, resolving once decoded. */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Draw one demo step onto an offscreen canvas and return the canvas. */
async function renderStepOffscreen(
  step: DemoStep,
  width: number,
  height: number
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  if (step.screenshotDataUrl) {
    const img = await loadImage(step.screenshotDataUrl);
    ctx.drawImage(img, 0, 0, width, height);
  } else {
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, width, height);
  }

  return canvas;
}

/** Escape special HTML characters for safe inlining into HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert a string to a URL-friendly slug. */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "demo";
}

// ─── 1. HTML Bundle ───────────────────────────────────────────────────────────

/** Options for the HTML bundle export. */
export interface HTMLExportOptions {
  /** Title shown in the browser tab (defaults to demo.title). */
  title?: string;
  /** Primary accent color used in the mini-player UI. */
  accentColor?: string;
}

/**
 * Export the demo as a self-contained HTML file.
 *
 * The file embeds all screenshots as data-URIs and includes a minimal
 * (~50 KB) inline JavaScript player that handles rendering, transitions,
 * hotspot clicks, and chapter navigation — without any external dependencies.
 *
 * @param demo     The demo to export.
 * @param options  Optional configuration for the HTML output.
 * @returns        A Blob with MIME type "text/html".
 */
export async function exportAsHTML(
  demo: Demo,
  options: HTMLExportOptions = {}
): Promise<Blob> {
  const title  = options.title ?? demo.title;
  const accent = options.accentColor ?? "#8b5cf6";

  // Serialize only what the inline player needs.
  const demoData = JSON.stringify({
    id:       demo.id,
    title:    demo.title,
    steps:    demo.steps.map((s) => ({
      id:                s.id,
      title:             s.title,
      screenshotDataUrl: s.screenshotDataUrl ?? null,
      hotspots:          s.hotspots ?? [],
      callouts:          s.callouts ?? [],
      duration:          s.duration ?? 3000,
      chapter:           s.chapter,
    })),
    chapters: demo.chapters ?? [],
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#09090b;color:#f4f4f5;font-family:system-ui,sans-serif;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
#player{position:relative;width:min(90vw,1280px);background:#000;border-radius:12px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.7)}
#canvas-container{position:relative;width:100%;aspect-ratio:16/9}
canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
#canvas-b{opacity:0}
.overlay{position:absolute;inset:0;pointer-events:none}
.hotspot{position:absolute;cursor:pointer;pointer-events:auto}
.hotspot-pulse .ring{position:absolute;inset:0;border-radius:9999px;background:${accent}33;animation:ping 1.4s cubic-bezier(0,0,.2,1) infinite}
.hotspot-pulse .dot{position:absolute;inset:30%;border-radius:9999px;background:${accent};box-shadow:0 0 12px ${accent}cc}
.hotspot-highlight{border-radius:4px}
.hotspot-outline{border:2px dashed ${accent}cc;border-radius:4px}
.callout{position:absolute;transform:translate(-50%,-50%);pointer-events:none;z-index:20}
.callout-tooltip{background:#18181b;border:1px solid #3f3f46;border-radius:8px;padding:6px 10px;font-size:12px;color:#e4e4e7;max-width:220px;text-align:center}
.callout-badge{width:28px;height:28px;border-radius:9999px;background:${accent};border:2px solid #fff;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.5)}
.callout-numbered{display:flex;align-items:flex-start;gap:8px;background:#18181b;border:1px solid #3f3f46;border-radius:12px;padding:8px 12px;max-width:240px}
.callout-numbered .num{width:20px;height:20px;border-radius:9999px;background:${accent};color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px}
.callout-numbered .txt{font-size:12px;color:#d4d4d8;line-height:1.5}
#controls{background:rgba(24,24,27,.9);border-top:1px solid rgba(255,255,255,.06);padding:10px 16px 12px;display:flex;flex-direction:column;gap:8px}
#progress-bar{display:flex;align-items:center;gap:4px}
.step-indicator{flex:1;height:4px;border-radius:9999px;background:#3f3f46;cursor:pointer;transition:background .2s}
.step-indicator.passed{background:${accent}}
.step-indicator.current{background:${accent};transform:scaleY(1.5)}
#btn-row{display:flex;align-items:center;gap:8px}
button{background:none;border:none;color:#a1a1aa;cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:color .15s,background .15s;font-size:12px}
button:hover{color:#fff;background:rgba(255,255,255,.06)}
button:disabled{opacity:.3;cursor:not-allowed}
#btn-play{color:#fff}
#btn-play:hover{color:${accent}}
#step-counter{font-size:12px;font-family:monospace;color:#71717a;margin-left:4px;user-select:none}
#step-title{font-size:12px;color:#a1a1aa;margin-left:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px}
.spacer{flex:1}
#sidebar{position:absolute;right:0;top:0;bottom:0;width:240px;background:rgba(9,9,11,.95);border-left:1px solid #27272a;overflow-y:auto;z-index:30;display:none;flex-direction:column}
#sidebar.open{display:flex}
.chapter-label{padding:6px 16px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#71717a;user-select:none}
.sidebar-step{display:flex;align-items:center;gap:10px;padding:8px 16px;cursor:pointer;color:#a1a1aa;font-size:12px;transition:background .15s,color .15s;border:none;width:100%;text-align:left;background:none}
.sidebar-step:hover{background:rgba(255,255,255,.04);color:#e4e4e7}
.sidebar-step.active{background:rgba(139,92,246,.12);color:#c4b5fd}
.step-num{width:20px;height:20px;border-radius:9999px;background:#27272a;color:#a1a1aa;font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.sidebar-step.active .step-num{background:${accent};color:#fff}
@keyframes ping{75%,100%{transform:scale(2);opacity:0}}
</style>
</head>
<body>
<div id="player">
  <div id="canvas-container">
    <canvas id="canvas-b"></canvas>
    <canvas id="canvas-a"></canvas>
    <div class="overlay" id="overlay"></div>
    <div id="sidebar"></div>
  </div>
  <div id="controls">
    <div id="progress-bar"></div>
    <div id="btn-row">
      <button id="btn-prev" aria-label="Previous step">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12.5 5l-5 5 5 5"/></svg>
      </button>
      <button id="btn-play" aria-label="Play">
        <svg id="icon-play" width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 4.25a.75.75 0 0 0-1.05.68v10.14a.75.75 0 0 0 1.05.68l9-5.07a.75.75 0 0 0 0-1.36l-9-5.07Z"/></svg>
        <svg id="icon-pause" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="display:none"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.75 4a.75.75 0 0 0-.75.75v10.5a.75.75 0 0 0 1.5 0V4.75A.75.75 0 0 0 5.75 4Zm8.5 0a.75.75 0 0 0-.75.75v10.5a.75.75 0 0 0 1.5 0V4.75A.75.75 0 0 0 14.25 4Z"/></svg>
      </button>
      <button id="btn-next" aria-label="Next step">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 5l5 5-5 5"/></svg>
      </button>
      <span id="step-counter"></span>
      <span id="step-title"></span>
      <div class="spacer"></div>
      <button id="btn-chapters" aria-label="Toggle chapters">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 5h14M3 10h14M3 15h14"/></svg>
      </button>
    </div>
  </div>
</div>
<script>
(function(){
var DEMO=${demoData};
var currentIdx=0;
var isPlaying=false;
var autoTimer=null;
var canvasA=document.getElementById("canvas-a");
var canvasB=document.getElementById("canvas-b");
var ctxA=canvasA.getContext("2d");
var ctxB=canvasB.getContext("2d");
var overlay=document.getElementById("overlay");
var sidebar=document.getElementById("sidebar");
var imgCache={};

function loadImg(url){
  return new Promise(function(resolve,reject){
    if(imgCache[url]){resolve(imgCache[url]);return;}
    var img=new Image();
    img.onload=function(){imgCache[url]=img;resolve(img);};
    img.onerror=reject;
    img.src=url;
  });
}

function setSize(){
  var w=canvasA.parentElement.offsetWidth;
  var h=Math.round(w*9/16);
  [canvasA,canvasB].forEach(function(c){c.width=w;c.height=h;});
}

function drawStep(canvas,ctx,step){
  if(!step.screenshotDataUrl){
    ctx.fillStyle="#09090b";ctx.fillRect(0,0,canvas.width,canvas.height);
    return Promise.resolve();
  }
  return loadImg(step.screenshotDataUrl).then(function(img){
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
  });
}

function crossfade(newIdx,done){
  var step=DEMO.steps[newIdx];
  drawStep(canvasB,ctxB,step).then(function(){
    var start=performance.now(),dur=350;
    function animate(now){
      var t=Math.min((now-start)/dur,1),e=1-Math.pow(1-t,3);
      canvasA.style.opacity=1-e;canvasB.style.opacity=e;
      if(t<1){requestAnimationFrame(animate);}
      else{drawStep(canvasA,ctxA,step).then(function(){canvasA.style.opacity=1;canvasB.style.opacity=0;if(done)done();});}
    }
    requestAnimationFrame(animate);
  });
}

function escHtml(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}

function renderOverlay(){
  overlay.innerHTML="";
  var step=DEMO.steps[currentIdx];if(!step)return;
  (step.hotspots||[]).forEach(function(h){
    var el=document.createElement("div");
    el.className="hotspot";
    el.style.left=(h.bounds.x*100)+"%";el.style.top=(h.bounds.y*100)+"%";
    el.style.width=(h.bounds.width*100)+"%";el.style.height=(h.bounds.height*100)+"%";
    if(h.type==="pulse"){el.classList.add("hotspot-pulse");el.innerHTML='<span class="ring"></span><span class="dot"></span>';}
    else if(h.type==="highlight"){el.classList.add("hotspot-highlight");el.style.background=(h.style&&h.style.color)||"rgba(139,92,246,.22)";}
    else if(h.type==="outline"){el.classList.add("hotspot-outline");}
    el.addEventListener("click",function(){goToIdx(currentIdx+1);});
    overlay.appendChild(el);
  });
  (step.callouts||[]).forEach(function(c){
    var el=document.createElement("div");el.className="callout";
    el.style.left=(c.position.x*100)+"%";el.style.top=(c.position.y*100)+"%";
    var inner;
    if(c.style==="badge"){inner='<div class="callout-badge">'+(c.number||"!")+'</div>';}
    else if(c.style==="numbered"){inner='<div class="callout-numbered"><div class="num">'+(c.number||1)+'</div><div class="txt">'+escHtml(c.text)+'</div></div>';}
    else{inner='<div class="callout-tooltip">'+escHtml(c.text)+'</div>';}
    el.innerHTML=inner;overlay.appendChild(el);
  });
}

function renderProgress(){
  var bar=document.getElementById("progress-bar");bar.innerHTML="";
  DEMO.steps.forEach(function(s,i){
    var el=document.createElement("div");
    el.className="step-indicator"+(i<currentIdx?" passed":i===currentIdx?" current":"");
    el.title=s.title||("Step "+(i+1));
    (function(idx){el.addEventListener("click",function(){goToIdx(idx);});})(i);
    bar.appendChild(el);
  });
}

function renderCounter(){
  document.getElementById("step-counter").textContent=(currentIdx+1)+"/"+DEMO.steps.length;
  var step=DEMO.steps[currentIdx];
  document.getElementById("step-title").textContent=step&&step.title?step.title:"";
}

function renderSidebar(){
  sidebar.innerHTML="";
  (DEMO.chapters||[]).forEach(function(ch){
    var chSteps=DEMO.steps.filter(function(s){return s.chapter===ch.id;});
    var label=document.createElement("div");label.className="chapter-label";label.textContent=ch.title;sidebar.appendChild(label);
    chSteps.forEach(function(s){
      var idx=DEMO.steps.indexOf(s);
      var btn=document.createElement("button");btn.className="sidebar-step"+(idx===currentIdx?" active":"");
      btn.innerHTML='<span class="step-num">'+(idx+1)+'</span><span>'+escHtml(s.title||"Step "+(idx+1))+'</span>';
      (function(i){btn.addEventListener("click",function(){goToIdx(i);sidebar.classList.remove("open");});})(idx);
      sidebar.appendChild(btn);
    });
  });
}

function goToIdx(idx){
  if(idx<0||idx>=DEMO.steps.length)return;
  clearTimeout(autoTimer);currentIdx=idx;
  renderProgress();renderCounter();
  crossfade(idx,function(){renderOverlay();renderSidebar();});
  if(isPlaying)scheduleAutoAdvance();
}

function scheduleAutoAdvance(){
  clearTimeout(autoTimer);
  var step=DEMO.steps[currentIdx];var dur=(step&&step.duration)||3000;
  autoTimer=setTimeout(function(){
    if(currentIdx<DEMO.steps.length-1){goToIdx(currentIdx+1);}else{setPlaying(false);}
  },dur);
}

function setPlaying(val){
  isPlaying=val;
  document.getElementById("icon-play").style.display=val?"none":"";
  document.getElementById("icon-pause").style.display=val?"":"none";
  document.getElementById("btn-play").setAttribute("aria-label",val?"Pause":"Play");
  if(val){scheduleAutoAdvance();}else{clearTimeout(autoTimer);}
}

document.getElementById("btn-play").addEventListener("click",function(){setPlaying(!isPlaying);});
document.getElementById("btn-prev").addEventListener("click",function(){goToIdx(currentIdx-1);});
document.getElementById("btn-next").addEventListener("click",function(){goToIdx(currentIdx+1);});
document.getElementById("btn-chapters").addEventListener("click",function(){sidebar.classList.toggle("open");renderSidebar();});

document.addEventListener("keydown",function(e){
  if(e.code==="Space"){e.preventDefault();setPlaying(!isPlaying);}
  if(e.code==="ArrowLeft"){e.preventDefault();goToIdx(currentIdx-1);}
  if(e.code==="ArrowRight"){e.preventDefault();goToIdx(currentIdx+1);}
});

window.addEventListener("resize",function(){setSize();drawStep(canvasA,ctxA,DEMO.steps[currentIdx]);});
setSize();goToIdx(0);
})();
</script>
</body>
</html>`;

  return new Blob([html], { type: "text/html;charset=utf-8" });
}

// ─── 2. MP4 Video ─────────────────────────────────────────────────────────────

/** Options for video export. */
export interface VideoExportOptions {
  /** Output width in pixels (default 1280). */
  width?: number;
  /** Output height in pixels (default 720). */
  height?: number;
  /** Frames per second (default 30). */
  fps?: number;
  /** Duration per step in milliseconds when step.duration is not set (default 3000). */
  defaultStepDuration?: number;
  /** Crossfade transition duration in milliseconds (default 350). */
  transitionDuration?: number;
  /** Progress callback (0–1). */
  onProgress?: (progress: number) => void;
}

/**
 * Export the demo as an MP4 video.
 *
 * Each step is rendered as a sequence of still frames at the configured fps,
 * with a short crossfade between steps. Requires WebCodecs support (Chrome 94+).
 *
 * @param demo     The demo to export.
 * @param options  Optional video configuration.
 * @returns        A Blob with MIME type "video/mp4".
 * @throws         If WebCodecs is not available in the current environment.
 */
export async function exportAsVideo(
  demo: Demo,
  options: VideoExportOptions = {}
): Promise<Blob> {
  const {
    width  = 1280,
    height = 720,
    fps    = 30,
    defaultStepDuration = 3000,
    transitionDuration  = 350,
    onProgress,
  } = options;

  // Pre-render all step canvases upfront to avoid per-frame async loading.
  const stepCanvases: HTMLCanvasElement[] = await Promise.all(
    demo.steps.map((s) => renderStepOffscreen(s, width, height))
  );

  const transFrames = Math.round((transitionDuration / 1000) * fps);

  let totalFrames = 0;
  const framesPerStep: number[] = demo.steps.map((s) => {
    const frames = Math.max(1, Math.round(((s.duration ?? defaultStepDuration) / 1000) * fps));
    totalFrames += frames;
    return frames;
  });

  const encoder = new SpotlightEncoder({ width, height, fps });
  encoder.onProgress((p) => onProgress?.(p.progress));
  await encoder.init(totalFrames);

  // Offscreen blend canvas for crossfade frames.
  const blendCanvas = document.createElement("canvas");
  blendCanvas.width  = width;
  blendCanvas.height = height;
  const blendCtx = blendCanvas.getContext("2d")!;

  let globalFrame = 0;

  for (let i = 0; i < demo.steps.length; i++) {
    const stepFrames  = framesPerStep[i];
    const currCanvas  = stepCanvases[i];
    const nextCanvas  = i + 1 < stepCanvases.length ? stepCanvases[i + 1] : null;

    for (let f = 0; f < stepFrames; f++) {
      const framesFromEnd = stepFrames - f;
      const isCrossfading = nextCanvas !== null && framesFromEnd <= transFrames;

      if (isCrossfading) {
        // Linear alpha blend: 0 at start of transition, 1 at end.
        const alpha = 1 - framesFromEnd / transFrames;
        blendCtx.clearRect(0, 0, width, height);
        blendCtx.drawImage(currCanvas, 0, 0);
        blendCtx.globalAlpha = alpha;
        blendCtx.drawImage(nextCanvas, 0, 0);
        blendCtx.globalAlpha = 1;
        await encoder.addFrame(blendCanvas, globalFrame);
      } else {
        await encoder.addFrame(currCanvas, globalFrame);
      }

      globalFrame++;
    }
  }

  return encoder.finalize();
}

// ─── 3. GIF ───────────────────────────────────────────────────────────────────

/** Options for GIF export. */
export interface GIFExportOptions {
  /** Output width in pixels (default 800). */
  width?: number;
  /** Output height in pixels (default 450). */
  height?: number;
  /** Frames per second for the GIF (default 10). */
  fps?: number;
  /** Duration per step in milliseconds when step.duration is not set (default 3000). */
  defaultStepDuration?: number;
  /** Progress callback (0–1). */
  onProgress?: (progress: number) => void;
}

/**
 * Export the demo as an animated GIF.
 *
 * Uses a minimal LZW-based GIF89a encoder implemented inline.
 * Keep fps low (10–15) to balance quality and file size.
 *
 * @param demo     The demo to export.
 * @param options  Optional GIF configuration.
 * @returns        A Blob with MIME type "image/gif".
 */
export async function exportAsGIF(
  demo: Demo,
  options: GIFExportOptions = {}
): Promise<Blob> {
  const {
    width  = 800,
    height = 450,
    fps    = 10,
    defaultStepDuration = 3000,
    onProgress,
  } = options;

  const frames: { imageData: ImageData; delayCs: number }[] = [];
  const offscreen = document.createElement("canvas");
  offscreen.width  = width;
  offscreen.height = height;
  const ctx = offscreen.getContext("2d")!;

  for (let i = 0; i < demo.steps.length; i++) {
    const step = demo.steps[i];
    const durMs = step.duration ?? defaultStepDuration;
    // GIF delay unit is centiseconds (100ths of a second).
    const delayCs = Math.max(1, Math.round(durMs / 10));

    if (step.screenshotDataUrl) {
      const img = await loadImage(step.screenshotDataUrl);
      ctx.drawImage(img, 0, 0, width, height);
    } else {
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, width, height);
    }

    frames.push({ imageData: ctx.getImageData(0, 0, width, height), delayCs });
    onProgress?.((i + 1) / demo.steps.length * 0.9);
  }

  const gifBytes = encodeGIF89a(frames, width, height);
  onProgress?.(1);

  return new Blob([gifBytes.buffer as ArrayBuffer], { type: "image/gif" });
}

// ─── Minimal GIF89a encoder ───────────────────────────────────────────────────

/**
 * Encode a sequence of ImageData frames as GIF89a bytes.
 *
 * Each frame is quantized to a local palette of up to 256 colors (6-bit per
 * channel) and compressed with LZW using a minimum code size of 8.
 * A Netscape 2.0 looping extension causes the GIF to loop infinitely.
 */
function encodeGIF89a(
  frames: { imageData: ImageData; delayCs: number }[],
  width: number,
  height: number
): Uint8Array {
  const bytes: number[] = [];

  const writeBytes = (...vals: number[]) => bytes.push(...vals);
  const writeStr   = (s: string) => { for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i)); };
  const writeU16LE = (v: number) => { bytes.push(v & 0xff, (v >> 8) & 0xff); };

  // GIF89a header + Logical Screen Descriptor (no global color table).
  writeStr("GIF89a");
  writeU16LE(width);
  writeU16LE(height);
  writeBytes(0x00, 0x00, 0x00);

  // Netscape 2.0 loop extension: loop count 0 = infinite.
  writeBytes(0x21, 0xff, 0x0b);
  writeStr("NETSCAPE2.0");
  writeBytes(0x03, 0x01, 0x00, 0x00, 0x00);

  for (const { imageData, delayCs } of frames) {
    const { palette, indexedPixels } = quantizeFrame(imageData);
    const paddedPalette = padPaletteTo256(palette);

    // Graphic Control Extension.
    writeBytes(0x21, 0xf9, 0x04);
    writeBytes(0x00);
    writeU16LE(delayCs);
    writeBytes(0x00, 0x00);

    // Image Descriptor with local color table (256 colors → size field = 7).
    writeBytes(0x2c);
    writeU16LE(0); writeU16LE(0);
    writeU16LE(width);
    writeU16LE(height);
    writeBytes(0x87); // local color table present, size = 7

    // Local color table: 256 × 3 bytes RGB.
    for (const [r, g, b] of paddedPalette) {
      writeBytes(r, g, b);
    }

    // LZW-encoded image data.
    const minCodeSize = 8;
    writeBytes(minCodeSize);
    const lzwData = lzwEncode(indexedPixels, minCodeSize);
    for (let offset = 0; offset < lzwData.length; offset += 255) {
      const chunk = lzwData.slice(offset, offset + 255);
      writeBytes(chunk.length, ...chunk);
    }
    writeBytes(0x00); // sub-block terminator
  }

  writeBytes(0x3b); // GIF trailer
  return new Uint8Array(bytes);
}

/**
 * Reduce an ImageData frame to a palette of up to 256 colors (6-bit/channel
 * quantization) and an array mapping each pixel to a palette index.
 */
function quantizeFrame(imageData: ImageData): {
  palette: [number, number, number][];
  indexedPixels: Uint8Array;
} {
  const { data, width, height } = imageData;
  const numPixels = width * height;
  const palette: [number, number, number][] = [];
  const colorMap = new Map<number, number>();
  const indexedPixels = new Uint8Array(numPixels);

  for (let i = 0; i < numPixels; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    // Quantize to 6 bits per channel to reduce palette pressure.
    const rq = r >> 2;
    const gq = g >> 2;
    const bq = b >> 2;
    const key = (rq << 12) | (gq << 6) | bq;
    let idx = colorMap.get(key);
    if (idx === undefined) {
      if (palette.length < 256) {
        idx = palette.length;
        palette.push([rq << 2, gq << 2, bq << 2]);
        colorMap.set(key, idx);
      } else {
        idx = findNearestColor(palette, rq << 2, gq << 2, bq << 2);
      }
    }
    indexedPixels[i] = idx;
  }

  return { palette, indexedPixels };
}

function findNearestColor(
  palette: [number, number, number][],
  r: number,
  g: number,
  b: number
): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const dr = palette[i][0] - r;
    const dg = palette[i][1] - g;
    const db = palette[i][2] - b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) { bestDist = dist; best = i; }
  }
  return best;
}

function padPaletteTo256(
  palette: [number, number, number][]
): [number, number, number][] {
  const padded: [number, number, number][] = [...palette];
  while (padded.length < 256) padded.push([0, 0, 0]);
  return padded;
}

/**
 * Minimal GIF LZW encoder.
 *
 * Produces a flat array of packed bit-stream bytes suitable for GIF sub-blocks.
 * `minCodeSize` should be 8 for 256-color images.
 */
function lzwEncode(indexedPixels: Uint8Array, minCodeSize: number): number[] {
  const clearCode = 1 << minCodeSize;
  const eofCode   = clearCode + 1;

  let codeSize = minCodeSize + 1;
  let maxCode   = 1 << codeSize;

  const table = new Map<number, number>();
  let nextCode = eofCode + 1;

  const output: number[] = [];
  let bitBuf   = 0;
  let bitCount = 0;

  const emitCode = (code: number) => {
    bitBuf   |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(bitBuf & 0xff);
      bitBuf   >>= 8;
      bitCount  -= 8;
    }
  };

  const resetTable = () => {
    table.clear();
    nextCode = eofCode + 1;
    codeSize = minCodeSize + 1;
    maxCode  = 1 << codeSize;
  };

  emitCode(clearCode);
  resetTable();

  let prefix = indexedPixels[0];

  for (let i = 1; i < indexedPixels.length; i++) {
    const pixel    = indexedPixels[i];
    const key      = prefix * 256 + pixel;
    const existing = table.get(key);

    if (existing !== undefined) {
      prefix = existing;
    } else {
      emitCode(prefix);
      if (nextCode < 4096) {
        table.set(key, nextCode++);
        if (nextCode > maxCode && codeSize < 12) {
          codeSize++;
          maxCode = 1 << codeSize;
        }
      } else {
        emitCode(clearCode);
        resetTable();
      }
      prefix = pixel;
    }
  }

  emitCode(prefix);
  emitCode(eofCode);

  if (bitCount > 0) output.push(bitBuf & 0xff);

  return output;
}

// ─── 4. JSON ──────────────────────────────────────────────────────────────────

/**
 * Serialize the full demo to a JSON string.
 *
 * The resulting string can be passed to `importFromJSON()` or stored anywhere
 * and fed back into a DemoEngine.
 *
 * @param demo  The demo to serialize.
 * @returns     A pretty-printed JSON string.
 */
export function exportAsJSON(demo: Demo): string {
  return JSON.stringify(demo, null, 2);
}

/**
 * Parse a JSON string previously produced by `exportAsJSON()`.
 *
 * @param json  The JSON string.
 * @returns     The reconstructed Demo object.
 * @throws      On invalid JSON.
 */
export function importFromJSON(json: string): Demo {
  return JSON.parse(json) as Demo;
}

// ─── 5. Shareable link ────────────────────────────────────────────────────────

/**
 * Generate a shareable URL that encodes the full demo in the URL hash.
 *
 * The demo JSON is base64url-encoded after UTF-8 serialisation. For very large
 * demos (many screenshots) prefer `storeAndGetLocalLink` which avoids URL
 * length limits by keeping the payload in localStorage.
 *
 * @param demo  The demo to encode.
 * @returns     A URL string with the demo payload in the hash.
 */
export function generateShareableLink(demo: Demo): string {
  const json = JSON.stringify(demo);

  // UTF-8-safe base64url encoding.
  const encoded = btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_match, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const base =
    typeof window !== "undefined"
      ? `${window.location.origin}/demo/view`
      : "/demo/view";

  return `${base}#d=${encoded}`;
}

/**
 * Decode a demo from a shareable URL hash produced by `generateShareableLink`.
 *
 * @param hash  The URL hash string (with or without the leading "#").
 * @returns     The reconstructed Demo, or `null` if the hash is not a valid demo.
 */
export function decodeDemoFromHash(hash: string): Demo | null {
  try {
    const cleaned = hash.replace(/^#/, "");
    const match   = cleaned.match(/d=([A-Za-z0-9_-]+)/);
    if (!match) return null;

    const base64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
    return JSON.parse(json) as Demo;
  } catch {
    return null;
  }
}

/**
 * Store a demo in localStorage and return a local URL with a retrieval key.
 *
 * Useful when the demo payload is too large for a URL hash (typically >2 KB
 * with long screenshots). Falls back to `generateShareableLink` if storage
 * quota is exceeded.
 *
 * @param demo  The demo to store.
 * @returns     A local URL string with a `?demoKey=` query parameter.
 */
export function storeAndGetLocalLink(demo: Demo): string {
  const key = `spotlight_demo_${demo.id}`;
  try {
    localStorage.setItem(key, JSON.stringify(demo));
  } catch {
    return generateShareableLink(demo);
  }

  const base =
    typeof window !== "undefined"
      ? `${window.location.origin}/demo/view`
      : "/demo/view";

  return `${base}?demoKey=${encodeURIComponent(key)}`;
}

/**
 * Retrieve a demo previously stored via `storeAndGetLocalLink`.
 *
 * @param key  The value of the `demoKey` query parameter.
 * @returns    The reconstructed Demo, or `null` if not found.
 */
export function retrieveLocalDemo(key: string): Demo | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Demo) : null;
  } catch {
    return null;
  }
}
