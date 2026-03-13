/**
 * Encoder — WebCodecs-based video encoder for Spotlight.
 *
 * Pipeline:
 *   Canvas frames  →  VideoEncoder (H.264 / AVC)  →  mp4-muxer  →  Blob
 *
 * Graceful degradation:
 *   1. WebCodecs available and hardware acceleration works  → use it.
 *   2. WebCodecs available but HW accel fails              → software fallback.
 *   3. WebCodecs unavailable                               → throw with clear message
 *      (caller should switch to gif/apng or server-side encoding).
 *
 * Notes on WebCodecs:
 *  - VideoEncoder.encode() is asynchronous under the hood; we must wait for
 *    the encoder's queue to drain before calling finalize().
 *  - Each frame is captured via canvas.captureStream() → VideoFrame constructor.
 *  - mp4-muxer expects a sequential chunk stream; we must not reorder chunks.
 */

// mp4-muxer ships its own TS types.
// Lazy import so the module doesn't break SSR (Next.js server components).
// We only ever use the ArrayBufferTarget variant, so we avoid the generic constraint.
type Muxer            = import("mp4-muxer").Muxer<import("mp4-muxer").ArrayBufferTarget>;
type ArrayBufferTarget = import("mp4-muxer").ArrayBufferTarget;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EncoderConfig {
  width: number;
  height: number;
  fps: number;
  /** H.264 profile string.  Defaults to a broad-compatibility "avc1.42E01E". */
  codec?: string;
  /** Target bitrate in bits per second.  Defaults to width*height*fps*0.15. */
  bitrate?: number;
  /**
   * Keyframe interval (frames).  Defaults to fps (one per second).
   * Lower = better seeking, higher = smaller file.
   */
  keyframeInterval?: number;
  /** Audio configuration. If provided, audio track is included in the MP4. */
  audio?: AudioEncoderConfig;
}

export interface AudioEncoderConfig {
  /** Sample rate (default 44100) */
  sampleRate?: number;
  /** Number of channels (default 2) */
  channels?: number;
  /** Audio bitrate in bits per second (default 128000) */
  bitrate?: number;
}

export interface EncodeProgress {
  framesEncoded: number;
  totalFrames: number;
  /** 0–1 fraction. */
  progress: number;
  /** Estimated seconds remaining (NaN until a few frames are in). */
  eta: number;
}

export type ProgressCallback = (p: EncodeProgress) => void;

// ─── Capability check ─────────────────────────────────────────────────────────

export function isWebCodecsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof VideoEncoder !== "undefined" &&
    typeof VideoFrame  !== "undefined"
  );
}

/** Check if the AudioEncoder API is available (for encoding audio tracks). */
export function isAudioEncoderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof AudioEncoder !== "undefined" &&
    typeof AudioData    !== "undefined"
  );
}

// ─── VideoEncoder ─────────────────────────────────────────────────────────────

export class SpotlightEncoder {
  private _config: Required<Omit<EncoderConfig, "audio">> & { audio?: AudioEncoderConfig };
  private _encoder: VideoEncoder | null = null;
  private _audioEncoder: AudioEncoder | null = null;
  private _muxer: Muxer | null = null;
  private _target: ArrayBufferTarget | null = null;

  private _framesEncoded: number = 0;
  private _totalFrames: number   = 0;
  private _encodeStartTime: number = 0;

  private _onProgress: ProgressCallback | null = null;

  /** Pending promise that resolves once the encoder queue drains. */
  private _flushResolve: (() => void) | null = null;

  constructor(config: EncoderConfig) {
    this._config = {
      width:            config.width,
      height:           config.height,
      fps:              config.fps,
      codec:            config.codec ?? "avc1.42E01E",
      bitrate:          config.bitrate ?? Math.round(config.width * config.height * config.fps * 0.15),
      keyframeInterval: config.keyframeInterval ?? config.fps,
      audio:            config.audio,
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /** Register a progress callback (called after each frame is processed). */
  onProgress(cb: ProgressCallback): this {
    this._onProgress = cb;
    return this;
  }

  /**
   * Initialise the encoder and muxer.  Must be called before addFrame().
   * @param totalFrames  Total number of frames to encode (for progress reporting).
   */
  async init(totalFrames: number): Promise<void> {
    if (!isWebCodecsSupported()) {
      throw new Error(
        "WebCodecs API is not available in this browser.  " +
        "Please use Chrome 94+, Edge 94+, or a browser that supports VideoEncoder."
      );
    }

    this._totalFrames    = totalFrames;
    this._framesEncoded  = 0;
    this._encodeStartTime = performance.now();

    // Dynamically import mp4-muxer so Next.js doesn't bundle it on the server.
    const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");

    this._target = new ArrayBufferTarget();

    const muxerConfig: any = {
      target: this._target,
      video: {
        codec:  "avc",
        width:  this._config.width,
        height: this._config.height,
      },
      fastStart: "in-memory",
    };

    // Add audio track to muxer if audio config is provided
    if (this._config.audio && isAudioEncoderSupported()) {
      muxerConfig.audio = {
        codec: "aac",
        sampleRate: this._config.audio.sampleRate ?? 44100,
        numberOfChannels: this._config.audio.channels ?? 2,
      };
    }

    this._muxer = new Muxer(muxerConfig);

    await this._initEncoder();

    // Initialize audio encoder if configured
    if (this._config.audio && isAudioEncoderSupported()) {
      await this._initAudioEncoder();
    }
  }

  /**
   * Add one rendered canvas frame to the video.
   *
   * @param canvas      The canvas element (already painted).
   * @param frameIndex  0-based frame index (used for timestamp calculation).
   */
  async addFrame(canvas: HTMLCanvasElement, frameIndex: number): Promise<void> {
    if (!this._encoder || !this._muxer) {
      throw new Error("Encoder not initialised — call init() first.");
    }

    const { fps, keyframeInterval } = this._config;
    const timestampUs = Math.round((frameIndex / fps) * 1_000_000);
    const durationUs  = Math.round((1 / fps) * 1_000_000);
    const keyFrame    = frameIndex % keyframeInterval === 0;

    // Wait if the encoder is backed up to avoid OOM on long sequences.
    if (this._encoder.encodeQueueSize > 10) {
      await this._drainQueue();
    }

    const frame = new VideoFrame(canvas, {
      timestamp: timestampUs,
      duration:  durationUs,
    });

    this._encoder.encode(frame, { keyFrame });
    frame.close();
  }

  /**
   * Add audio data to the encoded video.
   * Must be called after init() and before finalize().
   *
   * @param audioBuffer  An AudioBuffer containing the mixed audio.
   */
  async addAudioData(audioBuffer: AudioBuffer): Promise<void> {
    if (!this._audioEncoder || !this._muxer) {
      // Audio encoding not available or not configured — skip silently.
      return;
    }

    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const numberOfFrames = audioBuffer.length;

    // Convert AudioBuffer to interleaved Float32Array
    const interleaved = new Float32Array(numberOfFrames * numberOfChannels);
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < numberOfFrames; i++) {
        interleaved[i * numberOfChannels + ch] = channelData[i];
      }
    }

    // Encode in chunks to avoid memory pressure
    const chunkSize = sampleRate; // 1 second of audio per chunk
    for (let offset = 0; offset < numberOfFrames; offset += chunkSize) {
      const framesToEncode = Math.min(chunkSize, numberOfFrames - offset);
      const chunkData = interleaved.slice(
        offset * numberOfChannels,
        (offset + framesToEncode) * numberOfChannels
      );

      const audioData = new AudioData({
        format: "f32-planar" as AudioSampleFormat,
        sampleRate,
        numberOfFrames: framesToEncode,
        numberOfChannels,
        timestamp: Math.round((offset / sampleRate) * 1_000_000),
        data: chunkData,
      });

      this._audioEncoder.encode(audioData);
      audioData.close();

      // Wait if the audio encoder is backed up
      if (this._audioEncoder.encodeQueueSize > 5) {
        await new Promise<void>(resolve => setTimeout(resolve, 10));
      }
    }

    await this._audioEncoder.flush();
  }

  /**
   * Flush all pending frames and return the encoded MP4 as a Blob.
   * The encoder is invalidated after this call — create a new instance
   * for subsequent encodes.
   */
  async finalize(): Promise<Blob> {
    if (!this._encoder || !this._muxer || !this._target) {
      throw new Error("Encoder not initialised — call init() first.");
    }

    // Flush the video encoder.
    await this._encoder.flush();

    // Flush the audio encoder if present.
    if (this._audioEncoder) {
      await this._audioEncoder.flush();
      this._audioEncoder.close();
      this._audioEncoder = null;
    }

    this._muxer.finalize();

    const buffer = this._target.buffer;
    this._encoder.close();
    this._encoder = null;

    return new Blob([buffer], { type: "video/mp4" });
  }

  /**
   * Abort an in-progress encode (e.g. user cancels).
   */
  abort(): void {
    if (this._encoder) {
      try { this._encoder.close(); } catch { /* ignore */ }
      this._encoder = null;
    }
    if (this._audioEncoder) {
      try { this._audioEncoder.close(); } catch { /* ignore */ }
      this._audioEncoder = null;
    }
    this._muxer  = null;
    this._target = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async _initEncoder(): Promise<void> {
    const { codec, width, height, fps, bitrate } = this._config;

    const config: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate:          fps,
      hardwareAcceleration: "prefer-hardware",
      latencyMode:        "quality",
    };

    // Test hardware support; fall back to software if unavailable.
    let support = await VideoEncoder.isConfigSupported(config);
    if (!support.supported) {
      const swConfig = { ...config, hardwareAcceleration: "prefer-software" as const };
      support = await VideoEncoder.isConfigSupported(swConfig);
      if (!support.supported) {
        throw new Error(`VideoEncoder does not support codec "${codec}" on this device.`);
      }
      Object.assign(config, swConfig);
    }

    this._encoder = new VideoEncoder({
      output: (chunk, meta) => {
        this._muxer!.addVideoChunk(chunk, meta);
        this._framesEncoded++;
        this._reportProgress();

        // Notify any drain waiters.
        if (this._encoder && this._encoder.encodeQueueSize === 0) {
          this._flushResolve?.();
          this._flushResolve = null;
        }
      },
      error: (err) => {
        console.error("[SpotlightEncoder] VideoEncoder error:", err);
      },
    });

    this._encoder.configure(config);
  }

  private async _initAudioEncoder(): Promise<void> {
    if (!isAudioEncoderSupported() || !this._config.audio) return;

    const audioConfig = this._config.audio;
    const sampleRate = audioConfig.sampleRate ?? 44100;
    const channels = audioConfig.channels ?? 2;
    const bitrate = audioConfig.bitrate ?? 128_000;

    const encoderConfig: AudioEncoderConfig = {
      codec: "mp4a.40.2", // AAC-LC
      sampleRate,
      numberOfChannels: channels,
      bitrate,
    } as any;

    // Check support
    const support = await AudioEncoder.isConfigSupported(encoderConfig as any);
    if (!support.supported) {
      console.warn("[SpotlightEncoder] AudioEncoder config not supported, skipping audio.");
      return;
    }

    this._audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        this._muxer!.addAudioChunk(chunk, meta);
      },
      error: (err) => {
        console.error("[SpotlightEncoder] AudioEncoder error:", err);
      },
    });

    this._audioEncoder.configure(encoderConfig as any);
  }

  private _drainQueue(): Promise<void> {
    return new Promise((resolve) => {
      this._flushResolve = resolve;
      // Safety: resolve after 2 s in case the queue-empty callback is missed.
      const timeout = setTimeout(resolve, 2000);
      const origResolve = this._flushResolve;
      this._flushResolve = () => { clearTimeout(timeout); origResolve!(); };
    });
  }

  private _reportProgress(): void {
    if (!this._onProgress) return;
    const elapsed    = (performance.now() - this._encodeStartTime) / 1000;
    const fps        = this._framesEncoded / elapsed;
    const remaining  = (this._totalFrames - this._framesEncoded) / fps;
    this._onProgress({
      framesEncoded: this._framesEncoded,
      totalFrames:   this._totalFrames,
      progress:      this._framesEncoded / this._totalFrames,
      eta:           isFinite(remaining) ? remaining : NaN,
    });
  }
}

// ─── High-level encode pipeline ───────────────────────────────────────────────

export interface RenderExportOptions {
  sequence: import("./scene").SceneSequence;
  /** Rendered frames producer.  Called once per frame; must paint the canvas. */
  renderFrame: (canvas: HTMLCanvasElement, globalTimeSec: number, frameIndex: number) => void | Promise<void>;
  onProgress?: ProgressCallback;
  /** Override encoder settings. */
  encoderConfig?: Partial<EncoderConfig>;
}

/**
 * Convenience pipeline: advance through a sequence frame-by-frame,
 * encode each frame, and return an MP4 Blob.
 *
 * Typical usage:
 * ```ts
 * const blob = await encodeSequence({
 *   sequence,
 *   renderFrame: (canvas, t) => { renderer.renderFrame(timeline.getStateAtTime(t)!); },
 * });
 * const url = URL.createObjectURL(blob);
 * ```
 */
export async function encodeSequence(opts: RenderExportOptions): Promise<Blob> {
  const { sequence, renderFrame, onProgress, encoderConfig = {} } = opts;
  const { width, height, fps } = sequence;

  // Compute total duration from the sequence.
  const { sequenceDuration } = await import("./scene");
  const totalSec = sequenceDuration(sequence);
  const totalFrames = Math.ceil(totalSec * fps);

  const encoder = new SpotlightEncoder({
    width, height, fps,
    ...encoderConfig,
  });

  if (onProgress) encoder.onProgress(onProgress);

  await encoder.init(totalFrames);

  // Create an off-screen canvas for rendering.
  const canvas = document.createElement("canvas");
  canvas.width  = width;
  canvas.height = height;

  for (let i = 0; i < totalFrames; i++) {
    const globalTime = i / fps;
    await renderFrame(canvas, globalTime, i);
    await encoder.addFrame(canvas, i);
  }

  return encoder.finalize();
}

// ─── Download helper ─────────────────────────────────────────────────────────

/**
 * Trigger a browser download of an encoded Blob.
 * @param blob      The MP4 blob from finalize().
 * @param filename  e.g. "launch-video.mp4"
 */
export function downloadBlob(blob: Blob, filename = "launch-video.mp4"): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Revoke after a short delay to allow the download to start.
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
}
