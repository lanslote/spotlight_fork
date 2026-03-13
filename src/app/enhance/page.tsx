"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { UploadZone, type UploadedVideo } from "@/components/enhance/upload-zone";
import { CameraEditor } from "@/components/enhance/camera-editor";
import { PreviewPlayer } from "@/components/enhance/preview-player";
import { TimelineEditor } from "@/components/enhance/timeline-editor";
import { StylePanel } from "@/components/enhance/style-panel";
import { ExportPanel } from "@/components/enhance/export-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils";
import {
  VideoAnalyzer,
  Compositor,
  CameraSystem,
  CursorEngine,
  SpotlightEncoder,
  downloadBlob,
  CURSOR_PRESETS,
  RIPPLE_PRESETS,
  BACKGROUND_PRESETS,
  EXPORT_FORMATS,
  type AnalysisResult,
  type CompositorLayers,
  type ExportFormat,
} from "@/engine";
import type { CameraKeyframe } from "@/engine/camera-system";
import type { SceneSegment } from "@/engine/video-analyzer";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "upload" | "analyzing" | "editing" | "previewing" | "exporting";

const PHASES: Phase[] = ["upload", "analyzing", "editing", "previewing", "exporting"];

const ANALYSIS_STEPS = [
  "Extracting frames",
  "Detecting scenes",
  "Finding clicks",
  "Mapping cursor",
] as const;

// ── Sub-views ─────────────────────────────────────────────────────────────────

// ---- Upload phase ------------------------------------------------------------

function UploadPhase({ onUpload }: { onUpload: (video: UploadedVideo) => void }) {
  const features = [
    {
      icon: (
        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ),
      title: "Cursor smoothing",
      body: "Jerky mouse movements are automatically smoothed into professional arcs.",
    },
    {
      icon: (
        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      ),
      title: "Click highlights",
      body: "Every click is detected and highlighted with animated ripple effects.",
    },
    {
      icon: (
        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m2.25-2.25h.375a1.125 1.125 0 011.125 1.125v1.5" />
        </svg>
      ),
      title: "Scene cuts",
      body: "Dead time is trimmed automatically. Scenes are paced for engagement.",
    },
    {
      icon: (
        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
        </svg>
      ),
      title: "Pro framing",
      body: "Camera follows active UI regions. No more awkward screen edges.",
    },
  ];

  return (
    <div className="flex flex-col items-center gap-10 w-full max-w-2xl mx-auto pt-8 pb-16 px-4">
      {/* Hero text */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-zinc-100 tracking-tight">
          Upload your screen recording
        </h2>
        <p className="text-sm text-zinc-400 max-w-md">
          Drop in a raw recording and Spotlight will automatically enhance it into a
          polished product demo.
        </p>
      </div>

      {/* Upload zone */}
      <UploadZone onUpload={onUpload} className="w-full" />

      {/* Feature bullets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        {features.map((f) => (
          <div
            key={f.title}
            className="flex gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800/80"
          >
            <div className="mt-0.5 shrink-0 text-violet-400">{f.icon}</div>
            <div>
              <p className="text-sm font-medium text-zinc-200">{f.title}</p>
              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{f.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Analyzing phase ---------------------------------------------------------

function AnalyzingPhase({
  progress,
  step,
}: {
  progress: number;
  step: string;
}) {
  const pct = Math.round(progress * 100);

  return (
    <div className="flex flex-col items-center justify-center gap-8 w-full max-w-md mx-auto px-4 flex-1">
      {/* Pulsing ring */}
      <div className="relative flex items-center justify-center w-20 h-20">
        <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-violet-500/30 animate-ping [animation-delay:300ms]" />
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-[0_0_24px_rgba(124,58,237,0.4)]">
          <svg className="w-5 h-5 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>

      {/* Heading and step */}
      <div className="text-center space-y-1.5">
        <h2 className="text-lg font-semibold text-zinc-100">Analyzing your recording…</h2>
        <p className="text-sm text-zinc-400">{step}</p>
      </div>

      {/* Progress bar */}
      <div className="w-full space-y-2">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-500 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex flex-col gap-2 w-full">
        {ANALYSIS_STEPS.map((s, i) => {
          const stepProgress = progress * ANALYSIS_STEPS.length;
          const done = i < Math.floor(stepProgress);
          const active = i === Math.floor(stepProgress) && progress < 1;

          return (
            <div key={s} className="flex items-center gap-3">
              {/* Status dot */}
              <div
                className={cn(
                  "w-4 h-4 rounded-full shrink-0 flex items-center justify-center border transition-all duration-300",
                  done
                    ? "bg-violet-600 border-violet-600"
                    : active
                    ? "border-violet-500 bg-violet-500/20"
                    : "border-zinc-700 bg-zinc-800/50"
                )}
              >
                {done && (
                  <svg className="w-2.5 h-2.5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                )}
                {active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                )}
              </div>
              <span
                className={cn(
                  "text-sm transition-colors duration-200",
                  done ? "text-zinc-400 line-through decoration-zinc-600" : active ? "text-zinc-200" : "text-zinc-600"
                )}
              >
                {s}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Editing phase -----------------------------------------------------------

interface EditingPhaseProps {
  video: UploadedVideo;
  analysisResult: AnalysisResult;
  compositor: Compositor;
  videoElement: HTMLVideoElement;
  cameraSystem: CameraSystem;
  keyframes: CameraKeyframe[];
  onKeyframesChange: (kfs: CameraKeyframe[]) => void;
  segments: SceneSegment[];
  onSegmentsChange: (segs: SceneSegment[]) => void;
  layers: CompositorLayers;
  onLayersChange: (layers: CompositorLayers) => void;
  currentTime: number;
  onTimeChange: (t: number) => void;
}

function EditingPhase({
  video,
  analysisResult,
  compositor,
  videoElement,
  keyframes,
  onKeyframesChange,
  segments,
  onSegmentsChange,
  layers,
  onLayersChange,
  currentTime,
  onTimeChange,
}: EditingPhaseProps) {
  const duration = analysisResult.source.duration;

  function handleSegmentTrim(segmentId: string, startTime: number, endTime: number) {
    onSegmentsChange(
      segments.map((s) =>
        s.id === segmentId
          ? { ...s, startTime, endTime, duration: endTime - startTime }
          : s
      )
    );
  }

  function handleSegmentDelete(segmentId: string) {
    onSegmentsChange(segments.filter((s) => s.id !== segmentId));
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Left: Camera editor */}
      <div className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-900/60 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800/80 shrink-0">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Camera Editor</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <CameraEditor
            keyframes={keyframes}
            duration={duration}
            currentTime={currentTime}
            onKeyframesChange={onKeyframesChange}
            onTimeChange={onTimeChange}
          />
        </div>

        {/* Video metadata */}
        <div className="p-4 border-t border-zinc-800/80 space-y-2 shrink-0">
          <p className="text-[11px] text-zinc-600 font-medium uppercase tracking-widest">Source</p>
          <p className="text-xs text-zinc-400 truncate" title={video.name}>{video.name}</p>
          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            <span>{video.width}&times;{video.height}</span>
            <span className="text-zinc-700">&#x2022;</span>
            <span>{video.fps} fps</span>
            <span className="text-zinc-700">&#x2022;</span>
            <span>{formatDuration(video.duration)}</span>
          </div>
        </div>
      </div>

      {/* Center: Preview + Timeline */}
      <div className="flex-1 min-w-0 bg-zinc-950 flex flex-col overflow-hidden">
        {/* Preview player — fills available space */}
        <div className="flex-1 min-h-0 p-4 pb-2">
          <PreviewPlayer
            compositor={compositor}
            videoElement={videoElement}
            duration={duration}
            width={1920}
            height={1080}
            onTimeChange={onTimeChange}
            className="h-full"
          />
        </div>

        {/* Timeline editor */}
        <div className="shrink-0 px-4 pb-4">
          <TimelineEditor
            segments={segments}
            totalDuration={duration}
            currentTime={currentTime}
            onTimeChange={onTimeChange}
            onSegmentTrim={handleSegmentTrim}
            onSegmentDelete={handleSegmentDelete}
          />
        </div>
      </div>

      {/* Right: Style panel */}
      <div className="w-72 shrink-0 border-l border-zinc-800 bg-zinc-900/60 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800/80 shrink-0">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Style</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <StylePanel
            background={layers.background ?? BACKGROUND_PRESETS["midnight-gradient"]}
            deviceFrame={layers.deviceFrame ?? { type: "browser", showShadow: true }}
            textOverlays={layers.textOverlays ?? []}
            grain={layers.grain ?? { enabled: true, intensity: 0.03 }}
            onBackgroundChange={(bg) => onLayersChange({ ...layers, background: bg })}
            onDeviceFrameChange={(df) => onLayersChange({ ...layers, deviceFrame: df })}
            onTextOverlaysChange={(overlays) => onLayersChange({ ...layers, textOverlays: overlays })}
            onGrainChange={(grain) => onLayersChange({ ...layers, grain })}
          />
        </div>
      </div>
    </div>
  );
}

// ---- Exporting phase ---------------------------------------------------------

function ExportingPhase({
  exportProgress,
}: {
  exportProgress: number;
}) {
  const pct = Math.round(exportProgress * 100);

  return (
    <div className="flex flex-col items-center justify-center gap-8 w-full max-w-md mx-auto px-4 flex-1">
      {/* Pulsing ring */}
      <div className="relative flex items-center justify-center w-20 h-20">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-indigo-500/30 animate-ping [animation-delay:300ms]" />
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-[0_0_24px_rgba(99,102,241,0.4)]">
          <svg className="w-5 h-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </div>
      </div>

      <div className="text-center space-y-1.5">
        <h2 className="text-lg font-semibold text-zinc-100">Exporting your video…</h2>
        <p className="text-sm text-zinc-400">Encoding enhanced frames — this may take a moment.</p>
      </div>

      <div className="w-full space-y-2">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Encoding</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500 transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EnhancePage() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [video, setVideo] = useState<UploadedVideo | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState<string>(ANALYSIS_STEPS[0]);

  // Engine state
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [compositor, setCompositor] = useState<Compositor | null>(null);
  const [cameraSystem, setCameraSystem] = useState<CameraSystem | null>(null);
  const [exportProgress, setExportProgress] = useState(0);

  // Editable state derived from analysis
  const [keyframes, setKeyframes] = useState<CameraKeyframe[]>([]);
  const [segments, setSegments] = useState<SceneSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [layers, setLayers] = useState<CompositorLayers>({
    background: BACKGROUND_PRESETS["midnight-gradient"],
    deviceFrame: { type: "browser", showShadow: true },
    grain: { enabled: true, intensity: 0.03 },
  });
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(EXPORT_FORMATS[0]);

  // Sync layers changes into the live compositor
  const handleLayersChange = useCallback((newLayers: CompositorLayers) => {
    setLayers(newLayers);
    compositor?.setLayers(newLayers);
  }, [compositor]);

  // Analysis wiring
  const startAnalysis = useCallback(async (uploaded: UploadedVideo) => {
    setVideo(uploaded);
    setPhase("analyzing");
    setAnalysisProgress(0);

    try {
      // Create a video element from the uploaded file
      const vid = document.createElement("video");
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = "auto";
      vid.src = uploaded.url;
      await new Promise<void>((resolve) => {
        vid.onloadedmetadata = () => resolve();
      });
      setVideoElement(vid);

      // Run real analysis
      const analyzer = new VideoAnalyzer();
      const result = await analyzer.analyze(vid, (progress) => {
        const phaseMap: Record<string, number> = {
          "extracting": 0,
          "analyzing-scenes": 1,
          "detecting-clicks": 2,
          "detecting-cursor": 3,
          "finalizing": 3,
        };
        const stepIdx = phaseMap[progress.phase] ?? 0;
        const overallProgress = (stepIdx + progress.progress) / 4;
        setAnalysisProgress(overallProgress);
        setAnalysisStep(ANALYSIS_STEPS[Math.min(stepIdx, ANALYSIS_STEPS.length - 1)]);
      });

      setAnalysisResult(result);
      setSegments(result.segments);

      // Initialize engine modules from analysis
      const camera = new CameraSystem({
        sourceWidth: result.source.width,
        sourceHeight: result.source.height,
      });
      camera.generateKeyframes(result.clicks, result.cursorPath, result.segments);
      setCameraSystem(camera);
      setKeyframes([...camera.getKeyframes()]);

      const cursor = new CursorEngine(CURSOR_PRESETS.modern, RIPPLE_PRESETS.subtle);
      cursor.setPath(result.cursorPath, result.source.fps);
      cursor.setClicks(result.clicks);

      const comp = new Compositor({
        outputWidth: 1920,
        outputHeight: 1080,
        sourceWidth: result.source.width,
        sourceHeight: result.source.height,
        fps: result.source.fps,
      });
      comp.setCameraSystem(camera);
      comp.setCursorEngine(cursor);
      comp.setLayers({
        background: BACKGROUND_PRESETS["midnight-gradient"],
        deviceFrame: { type: "browser", showShadow: true },
        grain: { enabled: true, intensity: 0.03 },
      });
      setCompositor(comp);

      setPhase("editing");
    } catch (err) {
      console.error("Analysis failed:", err);
      // Fall back to upload phase on error
      setPhase("upload");
    }
  }, []);

  // Sync updated keyframes back into the camera system
  const handleKeyframesChange = useCallback((kfs: CameraKeyframe[]) => {
    setKeyframes(kfs);
    cameraSystem?.setKeyframes(kfs);
  }, [cameraSystem]);

  // Export wiring
  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!compositor || !videoElement || !analysisResult) return;
    setSelectedFormat(format);
    setPhase("exporting");
    setExportProgress(0);

    try {
      const encoder = new SpotlightEncoder({
        width: format.width,
        height: format.height,
        fps: format.fps,
        bitrate: format.bitrate,
      });

      const totalFrames = Math.ceil(analysisResult.source.duration * format.fps);
      encoder.onProgress((p) => setExportProgress(p.progress));
      await encoder.init(totalFrames);

      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = format.width;
      outputCanvas.height = format.height;

      for (let i = 0; i < totalFrames; i++) {
        const time = i / format.fps;
        videoElement.currentTime = time;
        await new Promise((r) => setTimeout(r, 0)); // yield to browser

        // Draw source frame onto an intermediate canvas
        const sourceCanvas = document.createElement("canvas");
        sourceCanvas.width = analysisResult.source.width;
        sourceCanvas.height = analysisResult.source.height;
        const sctx = sourceCanvas.getContext("2d")!;
        sctx.drawImage(videoElement, 0, 0);

        compositor.compositeFrame(sourceCanvas, time, outputCanvas);
        await encoder.addFrame(outputCanvas, i);
      }

      const blob = await encoder.finalize();
      downloadBlob(blob, "spotlight-enhanced.mp4");
      setPhase("editing"); // Return to editing after export
    } catch (err) {
      console.error("Export failed:", err);
      setPhase("editing");
    }
  }, [compositor, videoElement, analysisResult]);

  const phaseIndex = PHASES.indexOf(phase);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="shrink-0 h-12 bg-zinc-900 border-b border-zinc-800 flex items-center gap-3 px-4">
        {/* Back */}
        <Link href="/">
          <button
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-zinc-500",
              "hover:text-zinc-200 hover:bg-white/[0.05] transition-all text-xs"
            )}
          >
            <svg className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>
        </Link>

        <div className="w-px h-4 bg-zinc-800 mx-0.5" />

        {/* Title */}
        <h1 className="text-sm font-semibold text-zinc-100 tracking-tight">
          Enhance Recording
        </h1>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Phase indicator dots */}
        <nav className="flex items-center gap-1.5" aria-label="Progress">
          {PHASES.map((p, i) => (
            <div
              key={p}
              title={p.charAt(0).toUpperCase() + p.slice(1)}
              className={cn(
                "rounded-full transition-all duration-300",
                i === phaseIndex
                  ? "w-5 h-2 bg-violet-500"
                  : i < phaseIndex
                  ? "w-2 h-2 bg-violet-500/40"
                  : "w-2 h-2 bg-zinc-700"
              )}
            />
          ))}
        </nav>

        {/* Conditional action buttons */}
        {phase === "editing" && (
          <>
            <div className="w-px h-4 bg-zinc-800 mx-0.5" />
            <Button
              variant="primary"
              size="sm"
              onClick={() => setPhase("previewing")}
            >
              Preview
            </Button>
          </>
        )}
        {phase === "previewing" && (
          <>
            <div className="w-px h-4 bg-zinc-800 mx-0.5" />
            <Button variant="outline" size="sm" onClick={() => setPhase("editing")}>
              Back to Edit
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setPhase("exporting")}
            >
              Export
            </Button>
          </>
        )}
      </header>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
        {phase === "upload" && (
          <div className="flex-1 overflow-y-auto">
            <UploadPhase onUpload={startAnalysis} />
          </div>
        )}

        {phase === "analyzing" && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <AnalyzingPhase progress={analysisProgress} step={analysisStep} />
          </div>
        )}

        {phase === "editing" && video && analysisResult && compositor && videoElement && cameraSystem && (
          <EditingPhase
            video={video}
            analysisResult={analysisResult}
            compositor={compositor}
            videoElement={videoElement}
            cameraSystem={cameraSystem}
            keyframes={keyframes}
            onKeyframesChange={handleKeyframesChange}
            segments={segments}
            onSegmentsChange={setSegments}
            layers={layers}
            onLayersChange={handleLayersChange}
            currentTime={currentTime}
            onTimeChange={setCurrentTime}
          />
        )}

        {phase === "previewing" && analysisResult && compositor && videoElement && (
          <div className="flex-1 min-h-0 p-6">
            <PreviewPlayer
              compositor={compositor}
              videoElement={videoElement}
              duration={analysisResult.source.duration}
              width={1920}
              height={1080}
              onTimeChange={setCurrentTime}
              className="h-full"
            />
          </div>
        )}

        {phase === "exporting" && (
          <ExportingPhase exportProgress={exportProgress} />
        )}

        {/* Export format chooser — shown as an overlay sidebar when reaching the export phase from previewing */}
        {phase === "previewing" && (
          <div className="absolute bottom-6 right-6 z-10 w-96 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-2xl shadow-2xl overflow-y-auto max-h-[70vh]">
            <div className="p-5">
              <ExportPanel
                onExport={handleExport}
                isExporting={false}
                exportProgress={0}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
