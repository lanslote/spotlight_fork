/**
 * VideoAnalyzer — frame extraction and analysis for screen recordings.
 *
 * Extracts frames from a video, then performs:
 *  1. Scene detection (frame differencing)
 *  2. Cursor detection (motion analysis)
 *  3. Click detection (cursor velocity analysis)
 *  4. Scroll detection (vertical shift patterns)
 *  5. Idle detection (minimal frame changes)
 *
 * All processing is client-side using Canvas 2D and HTMLVideoElement.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AnalyzerConfig {
  /** Thumbnail scale factor (0-1). Lower = faster analysis, less memory. Default 0.1 */
  thumbnailScale?: number;
  /** Frames per second to sample for analysis. Default 5 */
  analysisFPS?: number;
  /** Scene cut threshold — fraction of pixels changed (0-1). Default 0.6 */
  sceneCutThreshold?: number;
  /** Idle threshold — fraction of pixels changed below this = idle (0-1). Default 0.02 */
  idleThreshold?: number;
  /** Per-pixel color difference threshold (0-765). Default 30 */
  pixelDiffThreshold?: number;
  /** Minimum scene duration in seconds. Default 0.5 */
  minSceneDuration?: number;
  /** Minimum idle duration to flag (seconds). Default 2.0 */
  minIdleDuration?: number;
  /** Cursor detection confidence threshold (0-1). Default 0.3 */
  cursorConfidenceThreshold?: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface AnalyzedFrame {
  /** Frame index */
  index: number;
  /** Time in the source video (seconds) */
  time: number;
  /** Thumbnail image data (downsampled) */
  thumbnail: ImageData;
  /** Fraction of pixels changed from previous frame (0-1) */
  changeRatio: number;
  /** Detected cursor position (normalised 0-1 coordinates), null if not detected */
  cursorPosition: Vec2 | null;
  /** Cursor detection confidence (0-1) */
  cursorConfidence: number;
}

export type SegmentType = "content" | "idle" | "scroll" | "transition";

export interface SceneSegment {
  /** Segment ID */
  id: string;
  /** Segment type */
  type: SegmentType;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Duration in seconds */
  duration: number;
  /** Start frame index */
  startFrame: number;
  /** End frame index */
  endFrame: number;
  /** Average change ratio within this segment */
  avgChangeRatio: number;
}

export interface DetectedClick {
  /** Click ID */
  id: string;
  /** Time of the click (seconds) */
  time: number;
  /** Frame index */
  frameIndex: number;
  /** Position (normalised 0-1) */
  position: Vec2;
  /** Confidence (0-1) */
  confidence: number;
}

export interface CursorPath {
  /** Ordered cursor positions with timestamps */
  points: Array<{
    time: number;
    position: Vec2;
    confidence: number;
  }>;
  /** Average detection confidence across all frames */
  avgConfidence: number;
}

export interface ScrollEvent {
  /** Scroll event ID */
  id: string;
  /** Start time (seconds) */
  startTime: number;
  /** End time (seconds) */
  endTime: number;
  /** Scroll direction */
  direction: "up" | "down";
  /** Estimated scroll magnitude (pixels in source resolution) */
  magnitude: number;
}

export interface AnalysisResult {
  /** Source video metadata */
  source: {
    width: number;
    height: number;
    duration: number;
    fps: number;
  };
  /** Analyzed frames (thumbnails + metrics) */
  frames: AnalyzedFrame[];
  /** Detected scene segments */
  segments: SceneSegment[];
  /** Detected clicks */
  clicks: DetectedClick[];
  /** Cursor path throughout the video */
  cursorPath: CursorPath;
  /** Detected scroll events */
  scrollEvents: ScrollEvent[];
  /** Idle regions */
  idleRegions: Array<{ startTime: number; endTime: number }>;
  /** Analysis metadata */
  meta: {
    analysisDuration: number;
    totalFramesAnalyzed: number;
    thumbnailSize: { width: number; height: number };
  };
}

export type AnalysisProgressCallback = (progress: {
  phase: "extracting" | "analyzing-scenes" | "detecting-cursor" | "detecting-clicks" | "finalizing";
  progress: number;
  message: string;
}) => void;

// ─── Private helpers ────────────────────────────────────────────────────────

let _segId = 0;
function makeSegId(): string {
  return `seg_${(++_segId).toString(36)}`;
}

let _clickId = 0;
function makeClickId(): string {
  return `click_${(++_clickId).toString(36)}`;
}

let _scrollId = 0;
function makeScrollId(): string {
  return `scroll_${(++_scrollId).toString(36)}`;
}

/**
 * Compare two ImageData buffers pixel-by-pixel.
 * Returns the fraction of pixels whose combined RGB difference exceeds the threshold.
 */
function computeFrameDiff(
  a: ImageData,
  b: ImageData,
  pixelThreshold: number
): { changeRatio: number; diffMap: Uint8Array } {
  const len = a.width * a.height;
  const diffMap = new Uint8Array(len);
  let changed = 0;

  for (let i = 0; i < len; i++) {
    const off = i * 4;
    const dr = Math.abs(a.data[off] - b.data[off]);
    const dg = Math.abs(a.data[off + 1] - b.data[off + 1]);
    const db = Math.abs(a.data[off + 2] - b.data[off + 2]);
    const total = dr + dg + db;

    if (total > pixelThreshold) {
      diffMap[i] = 1;
      changed++;
    }
  }

  return { changeRatio: changed / len, diffMap };
}

/**
 * Detect the vertical shift between two frames by correlating rows.
 * Returns the estimated vertical offset in pixels (positive = downward scroll).
 */
function detectVerticalShift(
  prev: ImageData,
  curr: ImageData,
  maxShift: number
): number {
  const { width, height } = prev;
  const rowBytes = width * 4;
  let bestShift = 0;
  let bestScore = Infinity;

  // Test shifts from -maxShift to +maxShift
  const step = Math.max(1, Math.floor(maxShift / 20));
  for (let shift = -maxShift; shift <= maxShift; shift += step) {
    let totalDiff = 0;
    let rowCount = 0;

    const startRow = Math.max(0, -shift);
    const endRow = Math.min(height, height - shift);

    // Sample every 4th row for speed
    for (let y = startRow; y < endRow; y += 4) {
      const prevRow = y;
      const currRow = y + shift;
      if (currRow < 0 || currRow >= height) continue;

      const prevOff = prevRow * rowBytes;
      const currOff = currRow * rowBytes;

      // Sample every 8th pixel
      for (let x = 0; x < width; x += 8) {
        const pOff = prevOff + x * 4;
        const cOff = currOff + x * 4;
        totalDiff += Math.abs(prev.data[pOff] - curr.data[cOff]);
        totalDiff += Math.abs(prev.data[pOff + 1] - curr.data[cOff + 1]);
        totalDiff += Math.abs(prev.data[pOff + 2] - curr.data[cOff + 2]);
      }
      rowCount++;
    }

    if (rowCount > 0) {
      const score = totalDiff / rowCount;
      if (score < bestScore) {
        bestScore = score;
        bestShift = shift;
      }
    }
  }

  return bestShift;
}

/**
 * Find the centroid of changed pixels in a diff map — candidate cursor position.
 * Uses connected component analysis to find the smallest moving blob.
 */
function findMotionCentroid(
  diffMap: Uint8Array,
  width: number,
  height: number
): { position: Vec2 | null; confidence: number } {
  // Find connected components of changed pixels
  const visited = new Uint8Array(diffMap.length);
  const components: Array<{ pixels: number[]; cx: number; cy: number; size: number }> = [];

  for (let i = 0; i < diffMap.length; i++) {
    if (diffMap[i] === 0 || visited[i]) continue;

    // BFS flood fill
    const queue: number[] = [i];
    const pixels: number[] = [];
    let sumX = 0, sumY = 0;
    visited[i] = 1;

    while (queue.length > 0) {
      const idx = queue.pop()!;
      pixels.push(idx);
      const px = idx % width;
      const py = Math.floor(idx / width);
      sumX += px;
      sumY += py;

      // 4-connected neighbours
      const neighbours = [
        idx - 1, idx + 1,
        idx - width, idx + width,
      ];

      for (const n of neighbours) {
        if (n >= 0 && n < diffMap.length && !visited[n] && diffMap[n]) {
          visited[n] = 1;
          queue.push(n);
        }
      }

      // Limit component size to prevent processing huge areas
      if (pixels.length > 5000) break;
    }

    if (pixels.length >= 3 && pixels.length <= 2000) {
      components.push({
        pixels,
        cx: sumX / pixels.length,
        cy: sumY / pixels.length,
        size: pixels.length,
      });
    }
  }

  if (components.length === 0) {
    return { position: null, confidence: 0 };
  }

  // The cursor is typically one of the smaller, consistently-moving components.
  // Sort by size and pick the smallest reasonable one (cursor is ~10-30px).
  components.sort((a, b) => a.size - b.size);

  // Filter to small components (likely cursor-sized)
  const cursorCandidates = components.filter(c => c.size >= 3 && c.size <= 500);

  if (cursorCandidates.length === 0) {
    // Fall back to smallest component
    const c = components[0];
    return {
      position: { x: c.cx / width, y: c.cy / height },
      confidence: 0.1,
    };
  }

  // Pick the candidate with the most "cursor-like" aspect ratio (roughly square)
  let best = cursorCandidates[0];
  let bestScore = 0;

  for (const c of cursorCandidates) {
    // Compute bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const px of c.pixels.slice(0, 200)) { // sample for speed
      const x = px % width;
      const y = Math.floor(px / width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const aspectRatio = Math.min(bw, bh) / Math.max(bw, bh);
    const sizeScore = 1 - Math.min(c.size, 200) / 200; // prefer smaller
    const score = aspectRatio * 0.6 + sizeScore * 0.4;

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  const confidence = Math.min(1, bestScore * 1.5);
  return {
    position: { x: best.cx / width, y: best.cy / height },
    confidence,
  };
}

// ─── Frame extraction ────────────────────────────────────────────────────────

/**
 * Seek a video element to a specific time and capture a frame.
 * Returns a Promise that resolves with the ImageData.
 */
function seekAndCapture(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  time: number
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      clearTimeout(timeout);

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        resolve(imageData);
      } catch (err) {
        reject(err);
      }
    };

    const timeout = setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      reject(new Error(`Seek timed out at ${time}s`));
    }, 5000);

    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });
}

/**
 * Estimate the FPS of a video by counting frames over a short interval.
 * Uses requestVideoFrameCallback if available, otherwise falls back to metadata/default.
 */
async function estimateFPS(video: HTMLVideoElement): Promise<number> {
  // Check for explicit fps in video metadata (not standard but some formats include it)
  // Fall back to counting frames
  if ("requestVideoFrameCallback" in video) {
    return new Promise((resolve) => {
      let frameCount = 0;
      let startTime = 0;
      const maxFrames = 15;

      const savedTime = video.currentTime;
      video.currentTime = 0;

      const countFrame = (_now: number, metadata: { mediaTime: number }) => {
        frameCount++;
        if (frameCount === 1) {
          startTime = metadata.mediaTime;
        }

        if (frameCount >= maxFrames) {
          const elapsed = metadata.mediaTime - startTime;
          const fps = elapsed > 0 ? (frameCount - 1) / elapsed : 30;
          video.pause();
          video.currentTime = savedTime;
          // Round to common FPS values
          resolve(roundToCommonFPS(fps));
          return;
        }

        (video as any).requestVideoFrameCallback(countFrame);
      };

      (video as any).requestVideoFrameCallback(countFrame);
      video.play().catch(() => resolve(30));

      // Safety timeout
      setTimeout(() => {
        video.pause();
        video.currentTime = savedTime;
        if (frameCount <= 1) resolve(30);
      }, 3000);
    });
  }

  // Fallback: assume 30fps for screen recordings
  return 30;
}

function roundToCommonFPS(fps: number): number {
  const common = [24, 25, 30, 48, 50, 60, 120];
  let closest = common[0];
  let minDiff = Math.abs(fps - closest);

  for (const c of common) {
    const diff = Math.abs(fps - c);
    if (diff < minDiff) {
      minDiff = diff;
      closest = c;
    }
  }

  return closest;
}

// ─── VideoAnalyzer class ────────────────────────────────────────────────────

export class VideoAnalyzer {
  private _config: Required<AnalyzerConfig>;

  constructor(config: AnalyzerConfig = {}) {
    this._config = {
      thumbnailScale: config.thumbnailScale ?? 0.1,
      analysisFPS: config.analysisFPS ?? 5,
      sceneCutThreshold: config.sceneCutThreshold ?? 0.6,
      idleThreshold: config.idleThreshold ?? 0.02,
      pixelDiffThreshold: config.pixelDiffThreshold ?? 30,
      minSceneDuration: config.minSceneDuration ?? 0.5,
      minIdleDuration: config.minIdleDuration ?? 2.0,
      cursorConfidenceThreshold: config.cursorConfidenceThreshold ?? 0.3,
    };
  }

  /**
   * Analyze a video file or video element.
   * Extracts frames, detects scenes, cursor, clicks, and scrolls.
   */
  async analyze(
    source: File | HTMLVideoElement | string,
    onProgress?: AnalysisProgressCallback
  ): Promise<AnalysisResult> {
    const startTime = performance.now();

    // Load video
    const video = await this._loadVideo(source);
    const fps = await estimateFPS(video);
    const { videoWidth, videoHeight, duration } = video;

    // Setup thumbnail canvas
    const thumbW = Math.max(32, Math.round(videoWidth * this._config.thumbnailScale));
    const thumbH = Math.max(32, Math.round(videoHeight * this._config.thumbnailScale));
    const canvas = document.createElement("canvas");
    canvas.width = thumbW;
    canvas.height = thumbH;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    // ── Phase 1: Frame extraction ──────────────────────────────────────────
    onProgress?.({
      phase: "extracting",
      progress: 0,
      message: "Extracting frames...",
    });

    const interval = 1 / this._config.analysisFPS;
    const totalFrames = Math.ceil(duration * this._config.analysisFPS);
    const frames: AnalyzedFrame[] = [];
    let prevImageData: ImageData | null = null;

    for (let i = 0; i < totalFrames; i++) {
      const time = i * interval;
      if (time > duration) break;

      try {
        const imageData = await seekAndCapture(video, canvas, ctx, time);
        let changeRatio = 0;

        if (prevImageData) {
          const diff = computeFrameDiff(imageData, prevImageData, this._config.pixelDiffThreshold);
          changeRatio = diff.changeRatio;
        }

        frames.push({
          index: i,
          time,
          thumbnail: imageData,
          changeRatio,
          cursorPosition: null,
          cursorConfidence: 0,
        });

        prevImageData = imageData;
      } catch {
        // Skip frames that fail to extract
        continue;
      }

      onProgress?.({
        phase: "extracting",
        progress: (i + 1) / totalFrames,
        message: `Extracting frames... ${i + 1}/${totalFrames}`,
      });
    }

    // ── Phase 2: Scene detection ───────────────────────────────────────────
    onProgress?.({
      phase: "analyzing-scenes",
      progress: 0,
      message: "Detecting scenes...",
    });

    const segments = this._detectScenes(frames);

    onProgress?.({
      phase: "analyzing-scenes",
      progress: 1,
      message: `Found ${segments.length} segments`,
    });

    // ── Phase 3: Cursor detection ──────────────────────────────────────────
    onProgress?.({
      phase: "detecting-cursor",
      progress: 0,
      message: "Detecting cursor...",
    });

    this._detectCursorPositions(frames, thumbW, thumbH, onProgress);

    const cursorPath = this._buildCursorPath(frames);

    // ── Phase 4: Click detection ───────────────────────────────────────────
    onProgress?.({
      phase: "detecting-clicks",
      progress: 0,
      message: "Detecting clicks...",
    });

    const clicks = this._detectClicks(frames, interval);

    // ── Phase 5: Scroll & idle detection ───────────────────────────────────
    const scrollEvents = this._detectScrolls(frames, thumbW, thumbH, interval);
    const idleRegions = this._detectIdleRegions(frames, interval);

    // Mark scroll and idle segments
    this._classifySegments(segments, scrollEvents, idleRegions);

    // ── Finalize ───────────────────────────────────────────────────────────
    onProgress?.({
      phase: "finalizing",
      progress: 1,
      message: "Analysis complete",
    });

    // Clean up if we created the video element
    if (typeof source !== "object" || source instanceof File) {
      if (video.src.startsWith("blob:")) {
        URL.revokeObjectURL(video.src);
      }
    }

    const analysisDuration = (performance.now() - startTime) / 1000;

    return {
      source: {
        width: videoWidth,
        height: videoHeight,
        duration,
        fps,
      },
      frames,
      segments,
      clicks,
      cursorPath,
      scrollEvents,
      idleRegions,
      meta: {
        analysisDuration,
        totalFramesAnalyzed: frames.length,
        thumbnailSize: { width: thumbW, height: thumbH },
      },
    };
  }

  // ── Private methods ─────────────────────────────────────────────────────

  private async _loadVideo(
    source: File | HTMLVideoElement | string
  ): Promise<HTMLVideoElement> {
    if (source instanceof HTMLVideoElement) {
      return source;
    }

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    return new Promise((resolve, reject) => {
      const onReady = () => {
        video.removeEventListener("loadedmetadata", onReady);
        clearTimeout(timeout);
        resolve(video);
      };

      const timeout = setTimeout(() => {
        video.removeEventListener("loadedmetadata", onReady);
        reject(new Error("Video load timed out"));
      }, 30000);

      video.addEventListener("loadedmetadata", onReady);
      video.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("Failed to load video"));
      });

      if (source instanceof File) {
        video.src = URL.createObjectURL(source);
      } else {
        video.src = source;
      }
    });
  }

  /**
   * Detect scene boundaries using frame difference ratios.
   */
  private _detectScenes(frames: AnalyzedFrame[]): SceneSegment[] {
    if (frames.length === 0) return [];

    const segments: SceneSegment[] = [];
    let segStart = 0;

    for (let i = 1; i < frames.length; i++) {
      const isCut = frames[i].changeRatio >= this._config.sceneCutThreshold;
      const isLast = i === frames.length - 1;

      if (isCut || isLast) {
        const endIdx = isLast ? i : i - 1;
        const startTime = frames[segStart].time;
        const endTime = frames[endIdx].time;
        const duration = endTime - startTime;

        // Only add segments above minimum duration
        if (duration >= this._config.minSceneDuration || segments.length === 0) {
          let totalChange = 0;
          for (let j = segStart; j <= endIdx; j++) {
            totalChange += frames[j].changeRatio;
          }

          segments.push({
            id: makeSegId(),
            type: "content",
            startTime,
            endTime,
            duration,
            startFrame: segStart,
            endFrame: endIdx,
            avgChangeRatio: totalChange / (endIdx - segStart + 1),
          });
        } else if (segments.length > 0) {
          // Merge short segments into the previous one
          const prev = segments[segments.length - 1];
          prev.endTime = endTime;
          prev.duration = prev.endTime - prev.startTime;
          prev.endFrame = endIdx;
        }

        segStart = i;
      }
    }

    // Handle case where no cuts detected — entire video is one segment
    if (segments.length === 0 && frames.length > 0) {
      segments.push({
        id: makeSegId(),
        type: "content",
        startTime: frames[0].time,
        endTime: frames[frames.length - 1].time,
        duration: frames[frames.length - 1].time - frames[0].time,
        startFrame: 0,
        endFrame: frames.length - 1,
        avgChangeRatio: 0,
      });
    }

    return segments;
  }

  /**
   * Detect cursor positions in each frame using motion analysis.
   */
  private _detectCursorPositions(
    frames: AnalyzedFrame[],
    width: number,
    height: number,
    onProgress?: AnalysisProgressCallback
  ): void {
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1];
      const curr = frames[i];

      const diff = computeFrameDiff(prev.thumbnail, curr.thumbnail, this._config.pixelDiffThreshold);
      const { position, confidence } = findMotionCentroid(diff.diffMap, width, height);

      curr.cursorPosition = position;
      curr.cursorConfidence = confidence;

      onProgress?.({
        phase: "detecting-cursor",
        progress: i / (frames.length - 1),
        message: `Tracking cursor... ${i}/${frames.length - 1}`,
      });
    }

    // Apply median filter to cursor positions to reduce noise
    this._smoothCursorPositions(frames);
  }

  /**
   * Smooth cursor positions using a median filter.
   * Fills gaps where cursor wasn't detected using linear interpolation.
   */
  private _smoothCursorPositions(frames: AnalyzedFrame[]): void {
    const windowSize = 3;

    // Median filter
    for (let i = 1; i < frames.length - 1; i++) {
      if (!frames[i].cursorPosition) continue;

      const positions: Vec2[] = [];
      for (let j = Math.max(0, i - windowSize); j <= Math.min(frames.length - 1, i + windowSize); j++) {
        if (frames[j].cursorPosition) {
          positions.push(frames[j].cursorPosition!);
        }
      }

      if (positions.length >= 3) {
        positions.sort((a, b) => a.x - b.x);
        const medianX = positions[Math.floor(positions.length / 2)].x;
        positions.sort((a, b) => a.y - b.y);
        const medianY = positions[Math.floor(positions.length / 2)].y;
        frames[i].cursorPosition = { x: medianX, y: medianY };
      }
    }

    // Linear interpolation for gaps
    for (let i = 0; i < frames.length; i++) {
      if (frames[i].cursorPosition) continue;

      // Find previous and next known positions
      let prevIdx = -1, nextIdx = -1;
      for (let j = i - 1; j >= 0; j--) {
        if (frames[j].cursorPosition) { prevIdx = j; break; }
      }
      for (let j = i + 1; j < frames.length; j++) {
        if (frames[j].cursorPosition) { nextIdx = j; break; }
      }

      if (prevIdx >= 0 && nextIdx >= 0) {
        const t = (i - prevIdx) / (nextIdx - prevIdx);
        const prev = frames[prevIdx].cursorPosition!;
        const next = frames[nextIdx].cursorPosition!;
        frames[i].cursorPosition = {
          x: prev.x + (next.x - prev.x) * t,
          y: prev.y + (next.y - prev.y) * t,
        };
        frames[i].cursorConfidence = Math.min(
          frames[prevIdx].cursorConfidence,
          frames[nextIdx].cursorConfidence
        ) * 0.5; // lower confidence for interpolated
      }
    }
  }

  /**
   * Build a continuous cursor path from frame cursor positions.
   */
  private _buildCursorPath(frames: AnalyzedFrame[]): CursorPath {
    const points: CursorPath["points"] = [];
    let totalConfidence = 0;
    let count = 0;

    for (const frame of frames) {
      if (frame.cursorPosition && frame.cursorConfidence >= this._config.cursorConfidenceThreshold) {
        points.push({
          time: frame.time,
          position: frame.cursorPosition,
          confidence: frame.cursorConfidence,
        });
        totalConfidence += frame.cursorConfidence;
        count++;
      }
    }

    return {
      points,
      avgConfidence: count > 0 ? totalConfidence / count : 0,
    };
  }

  /**
   * Detect clicks by finding moments where cursor velocity drops near zero
   * with small jitter for >150ms.
   */
  private _detectClicks(
    frames: AnalyzedFrame[],
    interval: number
  ): DetectedClick[] {
    const clicks: DetectedClick[] = [];
    const minPauseDuration = 0.15; // 150ms
    const velocityThreshold = 0.005; // normalised units per frame
    const minFramesForPause = Math.max(1, Math.round(minPauseDuration / interval));

    let pauseStart = -1;
    let pausePosition: Vec2 | null = null;

    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1].cursorPosition;
      const curr = frames[i].cursorPosition;

      if (!prev || !curr) {
        pauseStart = -1;
        continue;
      }

      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const velocity = Math.sqrt(dx * dx + dy * dy);

      if (velocity < velocityThreshold) {
        if (pauseStart === -1) {
          pauseStart = i;
          pausePosition = curr;
        }
      } else {
        // End of pause — check if it was long enough
        if (pauseStart >= 0 && pausePosition) {
          const pauseFrames = i - pauseStart;
          if (pauseFrames >= minFramesForPause) {
            // Check for small jitter (sub-pixel movement indicating click feedback)
            const hasJitter = this._checkClickJitter(frames, pauseStart, i);

            if (hasJitter) {
              clicks.push({
                id: makeClickId(),
                time: frames[pauseStart].time,
                frameIndex: pauseStart,
                position: pausePosition,
                confidence: Math.min(1, pauseFrames / (minFramesForPause * 3)),
              });
            }
          }
        }
        pauseStart = -1;
        pausePosition = null;
      }
    }

    return clicks;
  }

  /**
   * Check if there's small jitter at a cursor pause position,
   * suggesting a click happened (UI feedback causes sub-pixel changes).
   */
  private _checkClickJitter(
    frames: AnalyzedFrame[],
    startIdx: number,
    endIdx: number
  ): boolean {
    // Look for a spike in changeRatio during the pause
    // (clicking causes UI changes even though cursor is still)
    let maxChange = 0;
    for (let i = startIdx; i < endIdx && i < frames.length; i++) {
      maxChange = Math.max(maxChange, frames[i].changeRatio);
    }

    // A click typically causes 5-30% of pixels to change (button highlight, etc.)
    return maxChange > 0.03 && maxChange < this._config.sceneCutThreshold;
  }

  /**
   * Detect scroll events by analysing vertical shift patterns between frames.
   */
  private _detectScrolls(
    frames: AnalyzedFrame[],
    width: number,
    height: number,
    interval: number
  ): ScrollEvent[] {
    const events: ScrollEvent[] = [];
    const maxShift = Math.floor(height * 0.3);
    const minScrollMagnitude = 3; // pixels in thumbnail

    let scrollStart = -1;
    let scrollDirection: "up" | "down" = "down";
    let totalShift = 0;

    for (let i = 1; i < frames.length; i++) {
      const shift = detectVerticalShift(
        frames[i - 1].thumbnail,
        frames[i].thumbnail,
        maxShift
      );

      const isScrolling = Math.abs(shift) > minScrollMagnitude;

      if (isScrolling) {
        if (scrollStart === -1) {
          scrollStart = i - 1;
          scrollDirection = shift > 0 ? "down" : "up";
          totalShift = 0;
        }
        totalShift += shift;
      } else if (scrollStart >= 0) {
        // End of scroll
        const scale = 1 / this._config.thumbnailScale;
        events.push({
          id: makeScrollId(),
          startTime: frames[scrollStart].time,
          endTime: frames[i].time,
          direction: scrollDirection,
          magnitude: Math.abs(totalShift) * scale,
        });
        scrollStart = -1;
      }
    }

    return events;
  }

  /**
   * Detect idle regions where very little is changing on screen.
   */
  private _detectIdleRegions(
    frames: AnalyzedFrame[],
    interval: number
  ): Array<{ startTime: number; endTime: number }> {
    const regions: Array<{ startTime: number; endTime: number }> = [];
    let idleStart = -1;

    for (let i = 0; i < frames.length; i++) {
      const isIdle = frames[i].changeRatio < this._config.idleThreshold;

      if (isIdle && idleStart === -1) {
        idleStart = i;
      } else if (!isIdle && idleStart >= 0) {
        const duration = frames[i].time - frames[idleStart].time;
        if (duration >= this._config.minIdleDuration) {
          regions.push({
            startTime: frames[idleStart].time,
            endTime: frames[i].time,
          });
        }
        idleStart = -1;
      }
    }

    // Handle idle at end of video
    if (idleStart >= 0 && frames.length > 0) {
      const duration = frames[frames.length - 1].time - frames[idleStart].time;
      if (duration >= this._config.minIdleDuration) {
        regions.push({
          startTime: frames[idleStart].time,
          endTime: frames[frames.length - 1].time,
        });
      }
    }

    return regions;
  }

  /**
   * Classify existing segments based on scroll and idle overlap.
   */
  private _classifySegments(
    segments: SceneSegment[],
    scrollEvents: ScrollEvent[],
    idleRegions: Array<{ startTime: number; endTime: number }>
  ): void {
    for (const seg of segments) {
      // Check if segment is predominantly idle
      const idleOverlap = this._computeOverlap(seg, idleRegions);
      if (idleOverlap > 0.7) {
        seg.type = "idle";
        continue;
      }

      // Check if segment is predominantly scrolling
      const scrollOverlap = this._computeOverlap(seg, scrollEvents);
      if (scrollOverlap > 0.5) {
        seg.type = "scroll";
        continue;
      }

      // Check if it's a transition (very brief, high change)
      if (seg.duration < 0.3 && seg.avgChangeRatio > 0.3) {
        seg.type = "transition";
      }
    }
  }

  private _computeOverlap(
    segment: SceneSegment,
    regions: Array<{ startTime: number; endTime: number }>
  ): number {
    if (segment.duration === 0) return 0;

    let overlap = 0;
    for (const region of regions) {
      const overlapStart = Math.max(segment.startTime, region.startTime);
      const overlapEnd = Math.min(segment.endTime, region.endTime);
      if (overlapEnd > overlapStart) {
        overlap += overlapEnd - overlapStart;
      }
    }

    return overlap / segment.duration;
  }
}

// ─── Standalone helpers ──────────────────────────────────────────────────────

/**
 * Quick check: is this likely a screen recording?
 * Heuristic: low total frame variation, consistent dimensions, limited color palette.
 */
export function isLikelyScreenRecording(analysis: AnalysisResult): boolean {
  // Screen recordings tend to have low average change between frames
  const avgChange = analysis.frames.reduce((sum, f) => sum + f.changeRatio, 0) / analysis.frames.length;

  // Screen recordings have lots of idle time
  const totalIdle = analysis.idleRegions.reduce(
    (sum, r) => sum + (r.endTime - r.startTime), 0
  );
  const idleFraction = totalIdle / analysis.source.duration;

  // Screen recordings typically have detected clicks
  const hasClicks = analysis.clicks.length > 0;

  return avgChange < 0.15 && (idleFraction > 0.1 || hasClicks);
}

/**
 * Extract a single frame from a video at a specific time.
 * Returns an HTMLCanvasElement with the frame drawn on it.
 */
export async function extractFrame(
  video: HTMLVideoElement,
  time: number,
  width?: number,
  height?: number
): Promise<HTMLCanvasElement> {
  const w = width ?? video.videoWidth;
  const h = height ?? video.videoHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      clearTimeout(timeout);
      ctx.drawImage(video, 0, 0, w, h);
      resolve();
    };
    const timeout = setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      reject(new Error("Frame extraction timed out"));
    }, 5000);
    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });

  return canvas;
}
