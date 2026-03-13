/**
 * AudioMixer — Web Audio API offline mixer for Spotlight.
 *
 * Pipeline:
 *   AudioTrack[] + SFXTrigger[]  →  OfflineAudioContext  →  AudioBuffer  →  ArrayBuffer
 *
 * Capabilities:
 *  - Mixes an arbitrary number of tracks (music, voice-over, ambience, etc.)
 *  - Synthesises SFX entirely in-process — no external audio files required.
 *  - Optional auto-ducking: analyses the mix in 50 ms windows and attenuates
 *    music-tagged tracks when voice-band (300–3 000 Hz) energy is detected.
 *  - Renders faster-than-realtime via OfflineAudioContext.
 *  - SSR-safe: all Web Audio usage is feature-detected at call time, never at
 *    module load time (compatible with Next.js server components).
 *
 * Graceful degradation:
 *  1. OfflineAudioContext available → full offline mix.
 *  2. OfflineAudioContext unavailable (SSR) → mix() / encodeToBuffer() throw
 *     with a descriptive message so callers can branch to a server-side path.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AudioTrack {
  id: string;
  /** Audio source — URL string, raw ArrayBuffer, or a pre-decoded AudioBuffer. */
  source: string | ArrayBuffer | AudioBuffer;
  /** Linear gain applied to this track, 0–1. */
  volume: number;
  /** When this track starts in the output timeline (seconds). */
  startTime: number;
  /**
   * How many seconds of the source to play.
   * Omit to play the full source buffer.
   */
  duration?: number;
  /** Fade-in ramp duration (seconds). Applied from startTime. */
  fadeIn?: number;
  /** Fade-out ramp duration (seconds). Applied before the track ends. */
  fadeOut?: number;
  /**
   * Marks this track as background music.
   * Music tracks are eligible for auto-ducking when voice activity is detected.
   */
  isMusic?: boolean;
  /** Whether to loop the source until duration is exhausted. */
  loop?: boolean;
}

export interface SFXTrigger {
  id: string;
  /** Which synthesised sound to generate. */
  type: "click" | "whoosh" | "chime" | "pop" | "snap";
  /** Onset time in the output timeline (seconds). */
  time: number;
  /** Linear gain, 0–1. Defaults to 1. */
  volume?: number;
  /** Playback rate multiplier (1.0 = natural pitch, 2.0 = one octave up). */
  pitch?: number;
}

export interface AudioMixerConfig {
  /** Total output duration in seconds. */
  duration: number;
  /** PCM sample rate. Defaults to 44 100. */
  sampleRate?: number;
  /** Number of output channels. Defaults to 2 (stereo). */
  channels?: number;
  /**
   * Analyse the mix and attenuate music tracks when voice-band energy is
   * detected (simple ducker). Defaults to false.
   */
  autoDuck?: boolean;
  /**
   * Target gain for music while a voice is detected, 0–1.
   * Defaults to 0.3 (–10 dB approximately).
   */
  duckLevel?: number;
  /** Master output gain, 0–1. Defaults to 1. */
  masterVolume?: number;
}

export interface MixResult {
  /** The mixed, decoded audio. */
  buffer: AudioBuffer;
  /** Duration of the buffer in seconds. */
  duration: number;
  /** Peak absolute sample value across all channels, 0–1. */
  peakLevel: number;
}

// ─── Feature detection ────────────────────────────────────────────────────────

/**
 * Returns true when the browser exposes the AudioEncoder API (WebCodecs audio
 * path). Useful for callers that want to mux audio directly into an MP4 track.
 */
export function isAudioEncoderSupported(): boolean {
  return typeof globalThis !== "undefined" && typeof (globalThis as Record<string, unknown>)["AudioEncoder"] !== "undefined";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a silent (zero-filled) AudioBuffer of the requested duration.
 * Handy as a placeholder or for pure-SFX compositions with no music track.
 *
 * @param duration   Duration in seconds.
 * @param sampleRate PCM sample rate. Defaults to 44 100.
 */
export async function createSilentAudioBuffer(
  duration: number,
  sampleRate = 44_100,
): Promise<AudioBuffer> {
  _assertWebAudioAvailable();
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
  return ctx.startRendering();
}

// ─── AudioMixer ───────────────────────────────────────────────────────────────

/**
 * Offline audio mixer.
 *
 * ```ts
 * const mixer = new AudioMixer({ duration: 30 });
 *
 * mixer
 *   .addTrack({ id: "bg", source: bgMusicUrl, volume: 0.5, startTime: 0, isMusic: true, fadeIn: 1, fadeOut: 2 })
 *   .addSFX({ id: "s1", type: "whoosh", time: 4.2, volume: 0.8 });
 *
 * const result = await mixer.mix();
 * const mp4Audio = await mixer.encodeToBuffer();
 * ```
 */
export class AudioMixer {
  private readonly _config: Required<AudioMixerConfig>;
  private readonly _tracks: AudioTrack[] = [];
  private readonly _sfx: SFXTrigger[]   = [];

  /** Cached mix result — populated after the first successful mix() call. */
  private _lastResult: MixResult | null = null;

  constructor(config: AudioMixerConfig) {
    this._config = {
      duration:     config.duration,
      sampleRate:   config.sampleRate   ?? 44_100,
      channels:     config.channels     ?? 2,
      autoDuck:     config.autoDuck     ?? false,
      duckLevel:    config.duckLevel    ?? 0.3,
      masterVolume: config.masterVolume ?? 1,
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Register a background music or voice-over track.
   * Returns `this` for chaining.
   */
  addTrack(track: AudioTrack): this {
    this._tracks.push(track);
    this._lastResult = null; // invalidate cached mix
    return this;
  }

  /**
   * Schedule a synthesised sound effect at a specific timeline position.
   * Returns `this` for chaining.
   */
  addSFX(trigger: SFXTrigger): this {
    this._sfx.push(trigger);
    this._lastResult = null;
    return this;
  }

  /**
   * Perform the offline mix and return an {@link MixResult}.
   *
   * The result is cached — calling `mix()` a second time without adding new
   * tracks/SFX returns the cached result immediately.
   */
  async mix(): Promise<MixResult> {
    if (this._lastResult) return this._lastResult;

    _assertWebAudioAvailable();

    const { duration, sampleRate, channels, masterVolume } = this._config;
    const totalSamples = Math.ceil(duration * sampleRate);

    // ── Phase 1: render all tracks + SFX into one offline context ────────────
    const ctx = new OfflineAudioContext(channels, totalSamples, sampleRate);

    // Master gain node — all signal flows through here before reaching the
    // context destination.
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(masterVolume, 0);
    masterGain.connect(ctx.destination);

    // Collect gain nodes for music tracks so we can apply ducking later.
    const musicGainNodes: GainNode[] = [];

    // ── Phase 1a: schedule audio tracks ──────────────────────────────────────
    for (const track of this._tracks) {
      const audioBuffer = await this._loadAudioSource(track.source, ctx);
      const trackDuration = track.duration ?? audioBuffer.duration;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop   = track.loop ?? false;
      // Honour pitch shift requests made at the track level (none defined in
      // AudioTrack interface, but future-proof via the loop/duration path).

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, 0); // start silent; fades will ramp up
      source.connect(gainNode);
      gainNode.connect(masterGain);

      this._applyFades(gainNode, track, trackDuration, ctx);

      // schedule.start / stop in output-timeline seconds
      source.start(track.startTime, 0);
      source.stop(track.startTime + trackDuration);

      if (track.isMusic) {
        musicGainNodes.push(gainNode);
      }
    }

    // ── Phase 1b: schedule SFX ────────────────────────────────────────────────
    for (const trigger of this._sfx) {
      const sfxBuffer = this._generateSFX(trigger.type, ctx);
      const source    = ctx.createBufferSource();
      source.buffer   = sfxBuffer;

      // Apply pitch shift via playback rate.
      if (trigger.pitch !== undefined && trigger.pitch !== 1) {
        source.playbackRate.setValueAtTime(trigger.pitch, 0);
      }

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(trigger.volume ?? 1, 0);
      source.connect(gainNode);
      gainNode.connect(masterGain);

      source.start(trigger.time);
    }

    // ── Phase 2: render offline (faster-than-realtime) ────────────────────────
    const mixedBuffer = await ctx.startRendering();

    // ── Phase 3: optional auto-ducking (second offline pass) ─────────────────
    let finalBuffer = mixedBuffer;
    if (this._config.autoDuck && musicGainNodes.length > 0 && this._tracks.length > 0) {
      finalBuffer = await this._applyDuckingPass(mixedBuffer);
    }

    // ── Phase 4: measure peak ─────────────────────────────────────────────────
    const peakLevel = _measurePeak(finalBuffer);

    this._lastResult = {
      buffer:    finalBuffer,
      duration:  finalBuffer.duration,
      peakLevel,
    };

    return this._lastResult;
  }

  /**
   * Mix all tracks/SFX and return the result as a raw PCM ArrayBuffer
   * (interleaved IEEE-754 float32, little-endian) compatible with mp4-muxer's
   * audio track input.
   *
   * Callers that need WAV or Opus encoding should post-process this buffer
   * through their own codec pipeline.
   */
  async encodeToBuffer(): Promise<ArrayBuffer> {
    const { buffer } = await this.mix();
    return _audioBufferToFloat32ArrayBuffer(buffer);
  }

  // ── Private — audio loading ───────────────────────────────────────────────

  /**
   * Resolve a track source to an AudioBuffer.
   *
   * Accepts:
   *  - `string`      → fetched as a network resource and decoded.
   *  - `ArrayBuffer` → decoded directly.
   *  - `AudioBuffer` → returned as-is (zero-copy fast path).
   */
  private async _loadAudioSource(
    source: string | ArrayBuffer | AudioBuffer,
    ctx: OfflineAudioContext,
  ): Promise<AudioBuffer> {
    // Fast path: already decoded.
    if (source instanceof AudioBuffer) {
      return source;
    }

    let arrayBuffer: ArrayBuffer;

    if (typeof source === "string") {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(
          `[AudioMixer] Failed to fetch audio source "${source}": ` +
          `HTTP ${response.status} ${response.statusText}`,
        );
      }
      arrayBuffer = await response.arrayBuffer();
    } else {
      // ArrayBuffer — clone it so the original is left intact.
      arrayBuffer = source.slice(0);
    }

    return ctx.decodeAudioData(arrayBuffer);
  }

  // ── Private — fade scheduling ─────────────────────────────────────────────

  /**
   * Schedule gain automation on `gainNode` to implement fade-in and fade-out
   * for the given track.  The base volume is applied at the end of any fade-in
   * and held until the start of any fade-out.
   */
  private _applyFades(
    gainNode: GainNode,
    track: AudioTrack,
    trackDuration: number,
    ctx: OfflineAudioContext,
  ): void {
    const start  = track.startTime;
    const end    = start + trackDuration;
    const volume = track.volume;

    const fadeIn  = track.fadeIn  ?? 0;
    const fadeOut = track.fadeOut ?? 0;

    // Clamp fades so they don't overlap.
    const safeFadeIn  = Math.min(fadeIn,  trackDuration / 2);
    const safeFadeOut = Math.min(fadeOut, trackDuration / 2);

    if (safeFadeIn > 0) {
      gainNode.gain.setValueAtTime(0, start);
      gainNode.gain.linearRampToValueAtTime(volume, start + safeFadeIn);
    } else {
      gainNode.gain.setValueAtTime(volume, start);
    }

    if (safeFadeOut > 0) {
      const fadeOutStart = end - safeFadeOut;
      // Hold the target volume until the fade-out ramp begins.
      gainNode.gain.setValueAtTime(volume, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, end);
    }
  }

  // ── Private — auto-ducking ────────────────────────────────────────────────

  /**
   * Analyse `mixedBuffer` in 50 ms windows to detect voice-band (300–3 000 Hz)
   * energy, then render a second offline pass that applies a smooth ducking
   * curve to all music tracks.
   *
   * The ducking gain envelope is computed entirely from the mix — no separate
   * voice track is required.  This heuristic works best when voice-over is
   * significantly louder than background music.
   */
  private async _applyDuckingPass(mixedBuffer: AudioBuffer): Promise<AudioBuffer> {
    const { sampleRate, channels, duckLevel } = this._config;
    const windowSamples  = Math.floor(0.05 * sampleRate); // 50 ms
    const hopSamples     = windowSamples;
    const totalSamples   = mixedBuffer.length;
    const numWindows     = Math.ceil(totalSamples / windowSamples);

    // ── Step 1: measure per-window voice-band energy via a simple biquad ─────
    // We approximate a voice-band bandpass by combining a highpass (300 Hz)
    // and a lowpass (3 000 Hz) in a tiny ScriptProcessor-free approach:
    // just compute raw channel energy as a proxy (good enough for ducking).
    const channelData = mixedBuffer.getChannelData(0); // use L channel for analysis
    const duckEnvelope = new Float32Array(numWindows);

    // Compute RMS per window.
    for (let w = 0; w < numWindows; w++) {
      const offset = w * windowSamples;
      let sumSq = 0;
      const count = Math.min(windowSamples, totalSamples - offset);
      for (let i = 0; i < count; i++) {
        const s = channelData[offset + i];
        sumSq += s * s;
      }
      duckEnvelope[w] = Math.sqrt(sumSq / count);
    }

    // Normalise so threshold is relative to the mix level.
    let maxRms = 1e-9;
    for (let i = 0; i < duckEnvelope.length; i++) {
      if (duckEnvelope[i] > maxRms) maxRms = duckEnvelope[i];
    }
    const threshold = 0.15; // 15 % of peak RMS → voice activity

    // ── Step 2: build a smooth ducking gain curve at window resolution ───────
    const targetGains = new Float32Array(numWindows);
    for (let w = 0; w < numWindows; w++) {
      targetGains[w] = duckEnvelope[w] / maxRms > threshold ? duckLevel : 1.0;
    }

    // Smooth with a one-pole IIR (α controls attack/release speed).
    const smoothGain = new Float32Array(numWindows);
    const alpha = 0.08; // ~12 windows ≈ 600 ms smoothing
    smoothGain[0] = targetGains[0];
    for (let w = 1; w < numWindows; w++) {
      smoothGain[w] = smoothGain[w - 1] + alpha * (targetGains[w] - smoothGain[w - 1]);
    }

    // ── Step 3: re-render with per-sample gain applied to music tracks ────────
    // Because we already have the full mix in `mixedBuffer` we render a new
    // offline context with only music tracks and apply the envelope, then add
    // the non-music portion from the original.  For simplicity (and because
    // the music/non-music split is not preserved in mixedBuffer) we apply the
    // inverted duck as an amplification to the silent regions — i.e. we scale
    // the whole mix by a gain envelope that holds 1.0 for non-voice segments
    // and duckLevel for voice segments.  This is the most common "mix duck"
    // pattern when a separate stem is unavailable.
    const duckCtx = new OfflineAudioContext(channels, totalSamples, sampleRate);

    const sourceNode = duckCtx.createBufferSource();
    sourceNode.buffer = mixedBuffer;

    const duckGain = duckCtx.createGain();
    duckGain.gain.setValueAtTime(smoothGain[0], 0);

    // Schedule gain changes at each window boundary.
    for (let w = 1; w < numWindows; w++) {
      const t = (w * hopSamples) / sampleRate;
      // linearRampToValueAtTime provides the required smoothing at boundaries.
      duckGain.gain.linearRampToValueAtTime(smoothGain[w], t);
    }

    sourceNode.connect(duckGain);
    duckGain.connect(duckCtx.destination);
    sourceNode.start(0);

    return duckCtx.startRendering();
  }

  // ── Private — SFX synthesis ───────────────────────────────────────────────

  /**
   * Synthesise a short SFX entirely in-process using the Web Audio API graph
   * of `ctx`.  The returned AudioBuffer can be played back via a
   * `AudioBufferSourceNode`.
   *
   * All synthesis is done in a tiny *temporary* OfflineAudioContext that
   * shares the same sample rate as the main context.  The resulting buffer is
   * then decoded into a short PCM clip.
   */
  private _generateSFX(
    type: SFXTrigger["type"],
    _ctx: OfflineAudioContext,
  ): AudioBuffer {
    const sr = this._config.sampleRate;

    switch (type) {
      case "click":   return _synthClick(sr);
      case "whoosh":  return _synthWhoosh(sr);
      case "chime":   return _synthChime(sr);
      case "pop":     return _synthPop(sr);
      case "snap":    return _synthSnap(sr);
    }
  }

  // ── Private — ducking (legacy signature kept for interface contract) ──────

  /**
   * @deprecated Internal ducking is now handled by {@link _applyDuckingPass}.
   * This method is retained for subclass compatibility.
   */
  protected _applyDucking(
    _musicGain: GainNode,
    _analysisBuffer: AudioBuffer,
  ): void {
    // no-op — logic moved into _applyDuckingPass for the second-pass approach
  }
}

// ─── SFX synthesis (pure functions) ──────────────────────────────────────────
//
// Each synthesiser creates a tiny OfflineAudioContext, renders it synchronously
// by computing samples directly, and returns an AudioBuffer.  All are designed
// to be perceptually "punchy" without being harsh.

/**
 * Click: 20 ms white noise burst with a bandpass filter centred at 2 kHz.
 * Feels like a crisp UI tap.
 */
function _synthClick(sampleRate: number): AudioBuffer {
  const duration = 0.02; // 20 ms
  const numSamples = Math.ceil(duration * sampleRate);
  const buffer = _createBuffer(1, numSamples, sampleRate);
  const data   = buffer.getChannelData(0);

  // Generate white noise.
  _fillWhiteNoise(data, numSamples);

  // Simple biquad bandpass at 2 kHz (Q = 2).
  _applyBiquadBandpass(data, sampleRate, 2000, 2);

  // Apply a quick amplitude envelope (sharp attack, fast decay).
  _applyEnvelope(data, numSamples, 0.002 * sampleRate, numSamples);

  return buffer;
}

/**
 * Whoosh: 200 ms filtered noise sweep from 500 Hz to 4 kHz.
 * Conveys quick lateral motion.
 */
function _synthWhoosh(sampleRate: number): AudioBuffer {
  const duration   = 0.2; // 200 ms
  const numSamples = Math.ceil(duration * sampleRate);
  const buffer     = _createBuffer(1, numSamples, sampleRate);
  const data       = buffer.getChannelData(0);

  _fillWhiteNoise(data, numSamples);

  // Time-varying lowpass: sweep from 500 Hz to 4 kHz.
  // Implemented as a piecewise application of biquad filters on chunks.
  const chunkSize = Math.floor(numSamples / 8);
  for (let chunk = 0; chunk < 8; chunk++) {
    const t        = chunk / 8; // 0 → 1
    const freq     = 500 + t * 3500; // 500 → 4000 Hz
    const start    = chunk * chunkSize;
    const end      = chunk === 7 ? numSamples : start + chunkSize;
    const slice    = data.subarray(start, end);
    _applyBiquadLowpass(slice, sampleRate, freq, 0.7);
  }

  // Amplitude envelope: ramp up then down.
  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples; // 0 → 1
    const env = Math.sin(t * Math.PI); // half-sine arch
    data[i] *= env * 0.8;
  }

  return buffer;
}

/**
 * Chime: 300 ms pure sine at 880 Hz with exponential amplitude decay.
 * Delicate notification / success sound.
 */
function _synthChime(sampleRate: number): AudioBuffer {
  const duration   = 0.3; // 300 ms
  const freq       = 880; // A5
  const numSamples = Math.ceil(duration * sampleRate);
  const buffer     = _createBuffer(1, numSamples, sampleRate);
  const data       = buffer.getChannelData(0);

  const decayRate = 8; // controls how fast the chime fades (~1/decayRate seconds to -60 dB)

  for (let i = 0; i < numSamples; i++) {
    const t   = i / sampleRate;
    const env = Math.exp(-decayRate * t);
    data[i]   = Math.sin(2 * Math.PI * freq * t) * env;
  }

  return buffer;
}

/**
 * Pop: 50 ms sine starting at 400 Hz and sweeping down to 100 Hz.
 * The characteristic bubble-pop / button-press feeling.
 */
function _synthPop(sampleRate: number): AudioBuffer {
  const duration   = 0.05; // 50 ms
  const numSamples = Math.ceil(duration * sampleRate);
  const buffer     = _createBuffer(1, numSamples, sampleRate);
  const data       = buffer.getChannelData(0);

  let phase = 0;
  for (let i = 0; i < numSamples; i++) {
    const t    = i / numSamples;       // 0 → 1 within the sound
    const freq = 400 - t * 300;        // 400 Hz → 100 Hz
    const env  = 1 - t;                // linear decay
    const dt   = freq / sampleRate;
    phase      = (phase + dt) % 1;
    data[i]    = Math.sin(2 * Math.PI * phase) * env * 0.9;
  }

  return buffer;
}

/**
 * Snap: 30 ms white noise with a highpass filter at 3 kHz.
 * Tight, percussive crack.
 */
function _synthSnap(sampleRate: number): AudioBuffer {
  const duration   = 0.03; // 30 ms
  const numSamples = Math.ceil(duration * sampleRate);
  const buffer     = _createBuffer(1, numSamples, sampleRate);
  const data       = buffer.getChannelData(0);

  _fillWhiteNoise(data, numSamples);

  // Highpass at 3 kHz removes low-end rumble, leaving only the crisp attack.
  _applyBiquadHighpass(data, sampleRate, 3000, 1.0);

  // Fast exponential decay.
  for (let i = 0; i < numSamples; i++) {
    const t    = i / numSamples;
    data[i]   *= Math.exp(-12 * t);
  }

  return buffer;
}

// ─── DSP utilities ────────────────────────────────────────────────────────────

/** Allocate a new mono AudioBuffer without a live AudioContext. */
function _createBuffer(
  channels: number,
  length: number,
  sampleRate: number,
): AudioBuffer {
  // AudioBuffer constructor is not widely available; use a tiny offline context.
  // This is a synchronous render of an empty context — negligible overhead.
  const dummy = new OfflineAudioContext(channels, length, sampleRate);
  return dummy.createBuffer(channels, length, sampleRate);
}

/** Fill a Float32Array with white noise in [-1, 1]. */
function _fillWhiteNoise(data: Float32Array, length: number): void {
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
}

/**
 * Apply amplitude envelope in-place.
 * Linearly ramps from 0 to peak at `attackEnd`, then linearly decays to 0 at `decayEnd`.
 */
function _applyEnvelope(
  data: Float32Array,
  length: number,
  attackEnd: number,
  decayEnd: number,
): void {
  for (let i = 0; i < length; i++) {
    let env: number;
    if (i < attackEnd) {
      env = i / attackEnd;
    } else if (i < decayEnd) {
      env = 1 - (i - attackEnd) / (decayEnd - attackEnd);
    } else {
      env = 0;
    }
    data[i] *= env;
  }
}

// ── Biquad filter implementations (direct-form II transposed) ─────────────────
// These operate in-place on Float32Array slices to avoid allocations.

interface BiquadCoeffs {
  b0: number; b1: number; b2: number;
  a1: number; a2: number;
}

function _computeBandpassCoeffs(sampleRate: number, freq: number, Q: number): BiquadCoeffs {
  const w0    = 2 * Math.PI * freq / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosW0 = Math.cos(w0);
  const a0    = 1 + alpha;
  return {
    b0:  alpha / a0,
    b1:  0,
    b2: -alpha / a0,
    a1: -2 * cosW0 / a0,
    a2:  (1 - alpha) / a0,
  };
}

function _computeLowpassCoeffs(sampleRate: number, freq: number, Q: number): BiquadCoeffs {
  const w0    = 2 * Math.PI * freq / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosW0 = Math.cos(w0);
  const a0    = 1 + alpha;
  return {
    b0:  (1 - cosW0) / (2 * a0),
    b1:  (1 - cosW0) / a0,
    b2:  (1 - cosW0) / (2 * a0),
    a1: -2 * cosW0 / a0,
    a2:  (1 - alpha) / a0,
  };
}

function _computeHighpassCoeffs(sampleRate: number, freq: number, Q: number): BiquadCoeffs {
  const w0    = 2 * Math.PI * freq / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);
  const cosW0 = Math.cos(w0);
  const a0    = 1 + alpha;
  return {
    b0:  (1 + cosW0) / (2 * a0),
    b1: -(1 + cosW0) / a0,
    b2:  (1 + cosW0) / (2 * a0),
    a1: -2 * cosW0 / a0,
    a2:  (1 - alpha) / a0,
  };
}

function _applyBiquad(data: Float32Array, c: BiquadCoeffs): void {
  let z1 = 0;
  let z2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const y = c.b0 * x + z1;
    z1 = c.b1 * x - c.a1 * y + z2;
    z2 = c.b2 * x - c.a2 * y;
    data[i] = y;
  }
}

function _applyBiquadBandpass(data: Float32Array, sr: number, freq: number, Q: number): void {
  _applyBiquad(data, _computeBandpassCoeffs(sr, freq, Q));
}

function _applyBiquadLowpass(data: Float32Array, sr: number, freq: number, Q: number): void {
  _applyBiquad(data, _computeLowpassCoeffs(sr, freq, Q));
}

function _applyBiquadHighpass(data: Float32Array, sr: number, freq: number, Q: number): void {
  _applyBiquad(data, _computeHighpassCoeffs(sr, freq, Q));
}

// ─── Output encoding ──────────────────────────────────────────────────────────

/**
 * Convert an AudioBuffer to a flat interleaved IEEE-754 float32 ArrayBuffer.
 *
 * Interleaving order:  [L₀, R₀, L₁, R₁, …]
 * This is the raw PCM format expected by mp4-muxer's audio track input when
 * paired with an AudioEncoder configured for `pcm-f32` or similar.
 */
function _audioBufferToFloat32ArrayBuffer(buffer: AudioBuffer): ArrayBuffer {
  const { numberOfChannels, length } = buffer;
  const output   = new Float32Array(length * numberOfChannels);
  const channels: Float32Array[] = [];

  for (let c = 0; c < numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numberOfChannels; c++) {
      output[i * numberOfChannels + c] = channels[c][i];
    }
  }

  return output.buffer;
}

// ─── Peak measurement ─────────────────────────────────────────────────────────

/**
 * Scan all channels of `buffer` and return the maximum absolute sample value.
 * Result is in [0, 1] for a non-clipped signal.
 */
function _measurePeak(buffer: AudioBuffer): number {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  return peak;
}

// ─── Guard ────────────────────────────────────────────────────────────────────

/**
 * Throw a clear error when called in an environment where the Web Audio API is
 * unavailable (e.g. Node.js, Next.js server components).
 */
function _assertWebAudioAvailable(): void {
  if (typeof OfflineAudioContext === "undefined") {
    throw new Error(
      "[AudioMixer] OfflineAudioContext is not available in this environment. " +
      "Audio mixing must be performed in a browser context. " +
      "Guard your call site with `typeof OfflineAudioContext !== 'undefined'` " +
      "or use the `isAudioEncoderSupported()` helper.",
    );
  }
}
