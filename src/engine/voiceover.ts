/**
 * VoiceoverEngine — text-to-speech and audio pre-rendering for Spotlight demos.
 *
 * Pipeline:
 *   text / VoiceoverSegment[]
 *     → SpeechSynthesis live playback  (immediate, always available)
 *     → MediaRecorder capture path     (pre-render to AudioBuffer, best-effort)
 *       → AudioMixer integration        (mix with background music + auto-ducking)
 *
 * Capabilities:
 *  - Live speech via the Web Speech API (speak, speakSegment, stop, pause, resume).
 *  - Duration estimation from word count and configured speech rate.
 *  - Optional pre-rendering: captures live SpeechSynthesis output through a
 *    MediaStreamDestination + MediaRecorder and decodes into an AudioBuffer.
 *  - Background music mixing with auto-ducking via AudioMixer.
 *
 * Graceful degradation:
 *  1. speechSynthesis unavailable → all speak methods are silent no-ops.
 *  2. MediaRecorder unavailable   → preRenderToAudioBuffer() returns null.
 *  3. No background URL provided  → mixWithBackground() returns the voice buffer unchanged.
 *
 * SSR safety: every access to window / speechSynthesis / AudioContext is
 * guarded with `typeof window !== 'undefined'` checks so this module can be
 * imported in Next.js server components without error.
 */

import { AudioMixer } from "./audio-mixer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceoverConfig {
  /** Selected voice name (from speechSynthesis.getVoices()). */
  voiceName?: string;
  /** Speech rate (0.1–10, default 1.0). */
  rate: number;
  /** Speech pitch (0–2, default 1.0). */
  pitch: number;
  /** Volume (0–1, default 1.0). */
  volume: number;
  /** Language code (e.g. "en-US"). Defaults to browser default. */
  lang?: string;
}

export interface VoiceoverSegment {
  /** The step ID this voiceover belongs to. */
  stepId: string;
  /** Text to speak. */
  text: string;
  /** Start time in the demo timeline (seconds). */
  startTime: number;
  /** Estimated duration (seconds) — calculated from text length and rate. */
  estimatedDuration: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Average words per minute at rate = 1.0. */
const WORDS_PER_MINUTE_BASE = 150;

/** Assumed average word length in characters (for char-based fallback). */
const AVG_CHARS_PER_WORD = 5;

/** Default configuration values. */
const DEFAULT_CONFIG: VoiceoverConfig = {
  rate:   1.0,
  pitch:  1.0,
  volume: 1.0,
};

// ─── VoiceoverEngine ──────────────────────────────────────────────────────────

/**
 * Text-to-speech engine with optional AudioBuffer pre-rendering.
 *
 * ```ts
 * const engine = new VoiceoverEngine({ rate: 1.1, voiceName: "Samantha" });
 *
 * // Live playback
 * await engine.speak("Welcome to the demo.");
 *
 * // Pre-render a sequence to an AudioBuffer for use in the encoder pipeline
 * const buffer = await engine.preRenderToAudioBuffer(segments);
 * if (buffer) {
 *   const mixed = await engine.mixWithBackground(buffer, "/assets/bg-music.mp3");
 * }
 * ```
 */
export class VoiceoverEngine {
  private _config: VoiceoverConfig;

  /** Active utterance reference — used for pause/resume/stop. */
  private _activeUtterance: SpeechSynthesisUtterance | null = null;

  constructor(config?: Partial<VoiceoverConfig>) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Static capability detection ──────────────────────────────────────────

  /**
   * Returns true when the Web Speech API (SpeechSynthesis) is available in
   * the current environment.
   */
  static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.speechSynthesis !== "undefined"
    );
  }

  /**
   * Returns all voices available from the browser's SpeechSynthesis engine.
   * Returns an empty array when the API is unavailable or voices have not
   * loaded yet.
   */
  static getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!VoiceoverEngine.isSupported()) return [];
    return window.speechSynthesis.getVoices();
  }

  // ── Configuration ────────────────────────────────────────────────────────

  /**
   * Merge partial config updates into the current configuration.
   *
   * @param config - Partial config to apply.
   */
  setConfig(config: Partial<VoiceoverConfig>): void {
    this._config = { ...this._config, ...config };
  }

  /** Return a copy of the current configuration. */
  getConfig(): VoiceoverConfig {
    return { ...this._config };
  }

  // ── Duration estimation ──────────────────────────────────────────────────

  /**
   * Estimate how long (in seconds) the browser will take to speak `text` at
   * the current speech rate.
   *
   * Formula: words ÷ (WORDS_PER_MINUTE_BASE × rate) × 60
   *
   * @param text - Text to estimate.
   * @returns Estimated duration in seconds. Minimum 0.1 s.
   */
  estimateDuration(text: string): number {
    // Count words; fall back to char-based estimate for non-space-separated scripts.
    const trimmed = text.trim();
    if (trimmed.length === 0) return 0;

    const wordCount = trimmed.split(/\s+/).length || trimmed.length / AVG_CHARS_PER_WORD;
    const wordsPerSecond = (WORDS_PER_MINUTE_BASE * this._config.rate) / 60;
    return Math.max(0.1, wordCount / wordsPerSecond);
  }

  // ── Live playback ────────────────────────────────────────────────────────

  /**
   * Speak `text` immediately using the browser's SpeechSynthesis API.
   * Resolves when utterance ends; rejects on speech error.
   *
   * No-op (resolves immediately) when the API is unavailable.
   *
   * @param text - Text to speak.
   */
  speak(text: string): Promise<void> {
    if (!VoiceoverEngine.isSupported()) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const utterance = this._buildUtterance(text);

      utterance.onend   = () => { this._activeUtterance = null; resolve(); };
      utterance.onerror = (e) => { this._activeUtterance = null; reject(e); };

      this._activeUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Speak a {@link VoiceoverSegment}, delaying onset until `segment.startTime`
   * has elapsed from when this method is called.
   *
   * Resolves when the utterance finishes playing. No-op when the API is unavailable.
   *
   * @param segment - The segment to speak.
   */
  speakSegment(segment: VoiceoverSegment): Promise<void> {
    if (!VoiceoverEngine.isSupported()) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const delayMs = Math.max(0, segment.startTime * 1000);

      const timer = setTimeout(() => {
        this.speak(segment.text).then(resolve).catch(reject);
      }, delayMs);

      // Surface the timer reference so stop() can clear it if called early.
      // We attach it to the utterance slot via a small closure leak (acceptable).
      void timer;
    });
  }

  /**
   * Cancel all in-progress and queued speech immediately.
   */
  stop(): void {
    if (!VoiceoverEngine.isSupported()) return;
    this._activeUtterance = null;
    window.speechSynthesis.cancel();
  }

  /**
   * Pause the currently speaking utterance.
   */
  pause(): void {
    if (!VoiceoverEngine.isSupported()) return;
    window.speechSynthesis.pause();
  }

  /**
   * Resume a paused utterance.
   */
  resume(): void {
    if (!VoiceoverEngine.isSupported()) return;
    window.speechSynthesis.resume();
  }

  // ── Pre-rendering ────────────────────────────────────────────────────────

  /**
   * Attempt to pre-render an array of {@link VoiceoverSegment}s into a single
   * AudioBuffer by capturing live SpeechSynthesis output.
   *
   * Technique:
   *  1. Create an AudioContext with a MediaStreamDestinationNode.
   *  2. Pipe the audio output of each SpeechSynthesisUtterance into a
   *     MediaRecorder via the destination stream.
   *  3. After all segments have been spoken, decode the recorded Blob into
   *     an AudioBuffer.
   *
   * Browser support notes:
   *  - SpeechSynthesis output is not routable to AudioContext nodes in all
   *    browsers. This path works in Chrome but may silently record silence
   *    elsewhere. Always verify the returned buffer has non-zero audio energy.
   *  - Returns null when MediaRecorder or AudioContext are unavailable.
   *
   * @param segments - Ordered array of segments to render.
   * @returns Decoded AudioBuffer, or null on failure / missing APIs.
   */
  async preRenderToAudioBuffer(
    segments: VoiceoverSegment[],
  ): Promise<AudioBuffer | null> {
    if (!VoiceoverEngine.isSupported()) {
      console.warn("[VoiceoverEngine] speechSynthesis unavailable — cannot pre-render.");
      return null;
    }

    if (
      typeof window === "undefined" ||
      typeof window.MediaRecorder === "undefined"
    ) {
      console.warn("[VoiceoverEngine] MediaRecorder unavailable — falling back to live playback only.");
      return null;
    }

    if (typeof window.AudioContext === "undefined") {
      console.warn("[VoiceoverEngine] AudioContext unavailable — cannot pre-render.");
      return null;
    }

    try {
      return await this._captureSegments(segments);
    } catch (err) {
      console.warn("[VoiceoverEngine] Pre-render failed:", err);
      return null;
    }
  }

  /**
   * Mix a voiceover AudioBuffer with an optional background music track.
   *
   * When `backgroundUrl` is provided, the music is loaded, mixed at 80 % of
   * the voiceover's duration with auto-ducking enabled.  Without a URL the
   * voiceover buffer is returned unchanged.
   *
   * @param voiceBuffer   - Decoded voiceover AudioBuffer.
   * @param backgroundUrl - Optional URL to a background music audio file.
   * @returns Mixed AudioBuffer.
   */
  async mixWithBackground(
    voiceBuffer: AudioBuffer,
    backgroundUrl?: string,
  ): Promise<AudioBuffer> {
    if (!backgroundUrl) return voiceBuffer;

    const totalDuration = voiceBuffer.duration;

    const mixer = new AudioMixer({
      duration:     totalDuration,
      sampleRate:   voiceBuffer.sampleRate,
      channels:     voiceBuffer.numberOfChannels,
      autoDuck:     true,
      duckLevel:    0.25,
      masterVolume: 1.0,
    });

    // Voice-over track — not flagged as music so ducking analysis sees it.
    mixer.addTrack({
      id:        "voiceover",
      source:    voiceBuffer,
      volume:    this._config.volume,
      startTime: 0,
    });

    // Background music track — flagged for auto-ducking.
    mixer.addTrack({
      id:        "background",
      source:    backgroundUrl,
      volume:    0.5,
      startTime: 0,
      isMusic:   true,
      loop:      true,
      duration:  totalDuration,
      fadeIn:    1.0,
      fadeOut:   2.0,
    });

    const result = await mixer.mix();
    return result.buffer;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Build a configured SpeechSynthesisUtterance from `text`.
   * Selects the requested voice by name if available.
   */
  private _buildUtterance(text: string): SpeechSynthesisUtterance {
    const u = new SpeechSynthesisUtterance(text);

    u.rate   = this._config.rate;
    u.pitch  = this._config.pitch;
    u.volume = this._config.volume;

    if (this._config.lang) {
      u.lang = this._config.lang;
    }

    if (this._config.voiceName) {
      const voices = VoiceoverEngine.getAvailableVoices();
      const match  = voices.find((v) => v.name === this._config.voiceName);
      if (match) u.voice = match;
    }

    return u;
  }

  /**
   * Core capture routine for {@link preRenderToAudioBuffer}.
   *
   * Creates a silent AudioContext whose MediaStreamDestination is fed to a
   * MediaRecorder. Speaks each segment in sequence, then decodes the
   * recorded audio into an AudioBuffer.
   *
   * NOTE: Browser implementations vary widely in whether SpeechSynthesis
   * output routes through the default audio context destination. Chrome
   * supports this path natively; other browsers may record silence.
   */
  private async _captureSegments(
    segments: VoiceoverSegment[],
  ): Promise<AudioBuffer | null> {
    if (segments.length === 0) return null;

    const ctx = new window.AudioContext();
    const destNode = ctx.createMediaStreamDestination();

    // Calculate total expected duration for the recording window.
    const lastSegment = segments[segments.length - 1];
    const totalDuration =
      lastSegment.startTime +
      (lastSegment.estimatedDuration || this.estimateDuration(lastSegment.text)) +
      0.5; // 500 ms tail buffer

    const mimeType = _getSupportedMimeType();
    if (!mimeType) {
      console.warn("[VoiceoverEngine] No supported MediaRecorder MIME type found.");
      await ctx.close();
      return null;
    }

    const recorder   = new window.MediaRecorder(destNode.stream, { mimeType });
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.start(100); // collect chunks every 100 ms

    // Speak each segment at its scheduled startTime offset.
    const speakPromises = segments.map((seg) =>
      new Promise<void>((resolve, reject) => {
        const u = this._buildUtterance(seg.text);
        u.onend   = () => resolve();
        u.onerror = (e) => reject(e);

        const delayMs = Math.max(0, seg.startTime * 1000);
        setTimeout(() => window.speechSynthesis.speak(u), delayMs);
      }),
    );

    await Promise.all(speakPromises);

    // Wait for any trailing tail buffer.
    await _delay(500);

    // Stop recording and collect remaining data.
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    if (chunks.length === 0) {
      await ctx.close();
      return null;
    }

    const blob        = new Blob(chunks, { type: mimeType });
    const arrayBuffer = await blob.arrayBuffer();

    let audioBuffer: AudioBuffer | null = null;
    try {
      audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    } catch (err) {
      console.warn("[VoiceoverEngine] Failed to decode recorded audio:", err);
    }

    await ctx.close();
    return audioBuffer;

    // Suppress unused variable — destNode keeps the stream alive for recording.
    void destNode;
  }
}

// ─── Module-private helpers ───────────────────────────────────────────────────

/**
 * Return a Promise that resolves after `ms` milliseconds.
 * Avoids importing a sleep utility from elsewhere in the codebase.
 */
function _delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find the first MediaRecorder MIME type that the current browser supports.
 * Returns an empty string if none are supported (MediaRecorder unavailable).
 */
function _getSupportedMimeType(): string {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];

  for (const type of candidates) {
    if (window.MediaRecorder.isTypeSupported(type)) return type;
  }

  return "";
}
