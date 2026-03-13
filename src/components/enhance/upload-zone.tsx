"use client";

import { useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UploadedVideo {
  file: File;
  url: string;      // Object URL for preview
  name: string;
  size: number;     // bytes
  duration: number; // seconds
  width: number;
  height: number;
  fps: number;
}

interface UploadZoneProps {
  onUpload: (video: UploadedVideo) => void;
  maxSizeMB?: number;
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/avi", "video/x-matroska"];
const ACCEPTED_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
const DEFAULT_MAX_MB = 500;
const DEFAULT_FPS = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function isAcceptedType(file: File): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

/**
 * Loads a File into a hidden HTMLVideoElement and resolves with metadata.
 * Falls back to fps=30 when requestVideoFrameCallback is unavailable.
 */
function extractVideoMetadata(
  file: File,
  objectUrl: string
): Promise<{ duration: number; width: number; height: number; fps: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.src = "";
      video.load();
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video metadata."));
    };

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;

      // Try requestVideoFrameCallback for FPS estimation
      if ("requestVideoFrameCallback" in video) {
        let frameCount = 0;
        let startTime: number | null = null;
        const MAX_FRAMES = 30;
        const MAX_SAMPLE_SECONDS = 2;

        const countFrames = (now: number, meta: VideoFrameCallbackMetadata) => {
          if (startTime === null) startTime = meta.mediaTime;
          frameCount++;

          const elapsed = meta.mediaTime - startTime;
          if (frameCount < MAX_FRAMES && elapsed < MAX_SAMPLE_SECONDS) {
            (video as any).requestVideoFrameCallback(countFrames);
          } else {
            cleanup();
            const fps = elapsed > 0 ? Math.round(frameCount / elapsed) : DEFAULT_FPS;
            resolve({ duration, width, height, fps: fps || DEFAULT_FPS });
          }
        };

        video.currentTime = 0;
        video.play().then(() => {
          (video as any).requestVideoFrameCallback(countFrames);
        }).catch(() => {
          // play() blocked — fall back to default fps
          cleanup();
          resolve({ duration, width, height, fps: DEFAULT_FPS });
        });
      } else {
        // No requestVideoFrameCallback support — use default
        cleanup();
        resolve({ duration, width, height, fps: DEFAULT_FPS });
      }
    };

    video.src = objectUrl;
    video.load();
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

type ProcessingState = "idle" | "validating" | "processing" | "error";

export function UploadZone({ onUpload, maxSizeMB = DEFAULT_MAX_MB, className }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingLabel, setProcessingLabel] = useState("Processing…");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      setErrorMessage(null);

      // Type validation
      if (!isAcceptedType(file)) {
        setProcessingState("error");
        setErrorMessage(
          `Unsupported file type "${file.type || file.name.split(".").pop()}". Please upload an MP4, WebM, MOV, AVI, or MKV file.`
        );
        return;
      }

      // Size validation
      const maxBytes = maxSizeMB * 1024 * 1024;
      if (file.size > maxBytes) {
        setProcessingState("error");
        setErrorMessage(
          `File is too large (${formatBytes(file.size)}). Maximum allowed size is ${maxSizeMB} MB.`
        );
        return;
      }

      setProcessingState("processing");
      setProcessingLabel("Reading video…");

      const objectUrl = URL.createObjectURL(file);

      try {
        setProcessingLabel("Extracting metadata…");
        const { duration, width, height, fps } = await extractVideoMetadata(file, objectUrl);

        setProcessingState("idle");
        onUpload({ file, url: objectUrl, name: file.name, size: file.size, duration, width, height, fps });
      } catch {
        URL.revokeObjectURL(objectUrl);
        setProcessingState("error");
        setErrorMessage("Could not read video metadata. The file may be corrupted or use an unsupported codec.");
      }
    },
    [maxSizeMB, onUpload]
  );

  // Drag handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear when truly leaving the zone (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset input so the same file can be re-selected after an error
      e.target.value = "";
    },
    [processFile]
  );

  const handleClick = useCallback(() => {
    if (processingState === "processing") return;
    fileInputRef.current?.click();
  }, [processingState]);

  const isProcessing = processingState === "processing";

  return (
    <div className={cn("w-full", className)}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload video — drag and drop or click to browse"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
        className={cn(
          "relative flex flex-col items-center justify-center gap-5",
          "rounded-2xl border-2 border-dashed px-8 py-14",
          "cursor-pointer select-none outline-none",
          "transition-all duration-200",
          // Default state
          !isDragOver && !isProcessing && processingState !== "error" && [
            "border-zinc-700 bg-zinc-900/60",
            "hover:border-violet-500/60 hover:bg-violet-500/[0.04]",
            "focus-visible:border-violet-500/60 focus-visible:ring-2 focus-visible:ring-violet-500/30",
          ],
          // Drag-over state
          isDragOver && [
            "border-violet-500 bg-violet-500/[0.08]",
            "shadow-[0_0_0_4px_rgba(139,92,246,0.12)]",
          ],
          // Processing state
          isProcessing && "border-zinc-700 bg-zinc-900/60 cursor-default opacity-80",
          // Error state
          processingState === "error" && "border-rose-500/50 bg-rose-500/[0.04]",
        )}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="sr-only"
          onChange={handleFileInputChange}
          tabIndex={-1}
        />

        {/* Upload icon */}
        <div
          className={cn(
            "flex items-center justify-center w-14 h-14 rounded-2xl border",
            "transition-colors duration-200",
            isDragOver
              ? "border-violet-500/40 bg-violet-500/15 text-violet-400"
              : isProcessing
              ? "border-zinc-700 bg-zinc-800 text-zinc-500"
              : processingState === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
              : "border-zinc-700 bg-zinc-800/80 text-zinc-400"
          )}
        >
          {isProcessing ? (
            /* Spinner */
            <svg
              className="w-7 h-7 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : processingState === "error" ? (
            /* Error X */
            <svg className="w-7 h-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          ) : (
            /* Upload arrow */
            <svg className="w-7 h-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          )}
        </div>

        {/* Text content */}
        <div className="text-center space-y-1.5">
          {isProcessing ? (
            <>
              <p className="text-sm font-medium text-zinc-300">{processingLabel}</p>
              <p className="text-xs text-zinc-500">This may take a moment for large files</p>
            </>
          ) : processingState === "error" ? (
            <>
              <p className="text-sm font-medium text-rose-400">Upload failed</p>
              <p className="text-xs text-zinc-400 max-w-xs">{errorMessage}</p>
              <p className="text-xs text-zinc-500 pt-1">Click to try again</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-zinc-200">
                {isDragOver ? "Drop your video here" : "Drag & drop your recording here"}
              </p>
              <p className="text-xs text-zinc-500">
                or{" "}
                <span className="text-violet-400 underline underline-offset-2 decoration-violet-400/50">
                  click to browse
                </span>
              </p>
            </>
          )}
        </div>

        {/* Format and size hint */}
        {!isProcessing && processingState !== "error" && (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {ACCEPTED_EXTENSIONS.map((ext) => (
              <span
                key={ext}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium uppercase tracking-wide bg-zinc-800 text-zinc-500 border border-zinc-700/60"
              >
                {ext.slice(1)}
              </span>
            ))}
            <span className="text-zinc-600 text-[11px]">— up to {maxSizeMB} MB</span>
          </div>
        )}

        {/* Drag-over overlay ring (purely decorative) */}
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-violet-500/40" />
        )}
      </div>
    </div>
  );
}
