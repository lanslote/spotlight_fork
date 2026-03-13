/**
 * @module @spotlight/engine
 *
 * Barrel export for the Spotlight rendering engine.
 *
 * Consumers should import from "@/engine" (or "@/engine/<module>") rather
 * than from the individual files so that we can reorganise internals without
 * breaking callsites.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  VirtualClock  →  Timeline  →  CanvasRenderer  →  Encoder              │
 * │  (time source)    (keyframes)  (draw)             (WebCodecs + mp4)     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Interactive demo capabilities (Phase G):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  DemoEngine  →  PageMorph  →  VoiceoverEngine                          │
 * │  (step mgmt)    (transitions)  (narration sync)                        │
 * │                                                                         │
 * │  DemoExporter  →  DemoAnalytics                                        │
 * │  (HTML/video/GIF/JSON output)   (engagement metrics)                   │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

// ─── Virtual Clock ────────────────────────────────────────────────────────────
export {
  VirtualClock,
  createPreviewClock,
  createExportClock,
} from "./virtual-clock";

export type {
  ClockMode,
  ClockState,
  TickCallback,
} from "./virtual-clock";

// ─── Scene data model ─────────────────────────────────────────────────────────
export {
  makeId,
  makeColor,
  makeElement,
  hexToColor,
  colorToCSS,
  buildLinearGradient,
  sequenceDuration,
  Colors,
} from "./scene";

export type {
  // Primitives
  Vec2,
  Size,
  Rect,
  Color,
  // Gradient
  GradientDef,
  GradientStop,
  LinearGradient,
  RadialGradient,
  AngularGradient,
  // Animation
  EasingName,
  Keyframe,
  PropertyAnimation,
  AnimationConfig,
  // Elements
  ElementType,
  SceneElementBase,
  SceneElement,
  TextElement,
  TextStyle,
  RectElement,
  CircleElement,
  RoundedRectElement,
  GradientBgElement,
  ImageElement,
  DeviceMockupElement,
  GroupElement,
  ShapeStyle,
  // Scene
  Scene,
  SceneSequence,
  SceneTransition,
  TransitionType,
} from "./scene";

// ─── Timeline / Interpolation ─────────────────────────────────────────────────
export {
  Timeline,
  Easings,
  applyEasing,
  evaluatePropertyAnimation,
  createStaggerGroup,
  blurFilter,
} from "./timeline";

export type {
  ResolvedElementBase,
  ResolvedScene,
  StaggerGroup,
} from "./timeline";

// ─── Canvas Renderer ──────────────────────────────────────────────────────────
export {
  CanvasRenderer,
  createRenderer,
} from "./canvas-renderer";

export type {
  RendererConfig,
} from "./canvas-renderer";

// ─── Encoder ──────────────────────────────────────────────────────────────────
export {
  SpotlightEncoder,
  encodeSequence,
  downloadBlob,
  isWebCodecsSupported,
  isAudioEncoderSupported,
} from "./encoder";

export type {
  EncoderConfig,
  AudioEncoderConfig,
  EncodeProgress,
  ProgressCallback,
  RenderExportOptions,
} from "./encoder";

// ─── Spring Physics ──────────────────────────────────────────────────────────
export {
  SpringSimulator,
  Spring2D,
  springLerp,
  CAMERA_SPRING,
  CURSOR_SPRING,
  GENTLE_SPRING,
} from "./spring-physics";

export type {
  SpringConfig,
} from "./spring-physics";

// ─── Video Analyzer ──────────────────────────────────────────────────────────
export {
  VideoAnalyzer,
  isLikelyScreenRecording,
  extractFrame,
} from "./video-analyzer";

export type {
  AnalyzerConfig,
  AnalyzedFrame,
  AnalysisResult,
  AnalysisProgressCallback,
  SceneSegment,
  SegmentType,
  DetectedClick,
  CursorPath,
  ScrollEvent,
} from "./video-analyzer";

// ─── Camera System ───────────────────────────────────────────────────────────
export {
  CameraSystem,
  applyFocusBlur,
  getScreenThird,
  clampCameraPosition,
} from "./camera-system";

export type {
  CameraState,
  CameraKeyframe,
  CameraConfig,
  FocusBlurConfig,
} from "./camera-system";

// ─── Cursor Engine ───────────────────────────────────────────────────────────
export {
  CursorEngine,
  smoothPath,
  CURSOR_PRESETS,
  RIPPLE_PRESETS,
} from "./cursor-engine";

export type {
  CursorConfig,
  RippleConfig,
  SmoothedPoint,
} from "./cursor-engine";

// ─── Audio Mixer ─────────────────────────────────────────────────────────────
export {
  AudioMixer,
  createSilentAudioBuffer,
} from "./audio-mixer";

// Re-export audio-mixer's isAudioEncoderSupported under a distinct name.
export { isAudioEncoderSupported as isAudioMixerSupported } from "./audio-mixer";

export type {
  AudioTrack,
  SFXTrigger,
  AudioMixerConfig,
  MixResult,
} from "./audio-mixer";

// ─── Compositor ──────────────────────────────────────────────────────────────
export {
  Compositor,
  BACKGROUND_PRESETS,
  EXPORT_FORMATS,
} from "./compositor";

export type {
  CompositorConfig,
  BackgroundStyle,
  DeviceFrame,
  DeviceFrameConfig,
  TextOverlay,
  GrainConfig,
  CompositorLayers,
  ExportFormat,
} from "./compositor";

// ─── Demo Engine ─────────────────────────────────────────────────────────────
export {
  DemoEngine,
  createDefaultDemo,
  createDefaultStep,
  makeId as makeDemoId,
  hitTestHotspot,
  getStepById,
  reorderSteps,
  addStep,
  removeStep,
} from "./demo-engine";

export type {
  Demo,
  DemoStep,
  DemoSettings,
  DemoVariable,
  Chapter,
  Hotspot,
  Callout,
  BlurRegion,
  TransitionType as DemoTransitionType,
  PlaybackState,
  DemoEvent,
  DemoEventType,
  DemoEventListener,
} from "./demo-engine";

// ─── Page Morph ──────────────────────────────────────────────────────────────
export {
  PageMorph,
} from "./page-morph";

export type {
  TextRegion,
  ImageRegion,
  MorphConfig,
} from "./page-morph";

// ─── Voiceover ───────────────────────────────────────────────────────────────
export {
  VoiceoverEngine,
} from "./voiceover";

export type {
  VoiceoverConfig,
  VoiceoverSegment,
} from "./voiceover";

// ─── Demo Exporter ───────────────────────────────────────────────────────────
export {
  exportAsHTML,
  exportAsVideo,
  exportAsGIF,
  exportAsJSON,
  generateShareableLink,
} from "./demo-exporter";

// ─── Demo Analytics ──────────────────────────────────────────────────────────
export {
  DemoAnalytics,
} from "./demo-analytics";

export type {
  AnalyticsEvent,
  StepMetrics,
  DemoMetrics,
  FunnelData,
  AnalyticsExport,
} from "./demo-analytics";
