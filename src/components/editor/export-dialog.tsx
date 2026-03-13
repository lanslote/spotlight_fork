"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { X, Download, Film, AlertCircle, CheckCircle2 } from "lucide-react";

type Resolution = "720p" | "1080p" | "4k";
type FPS = 30 | 60;
type ExportStatus = "idle" | "encoding" | "done" | "error";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  templateId: string;
  productName: string;
}

const RESOLUTIONS: { value: Resolution; label: string; w: number; h: number }[] = [
  { value: "720p",  label: "720p  HD",  w: 1280,  h: 720  },
  { value: "1080p", label: "1080p FHD", w: 1920,  h: 1080 },
  { value: "4k",    label: "4K   UHD",  w: 3840,  h: 2160 },
];

const FPS_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: "30", label: "30 FPS", description: "Standard, smaller file" },
  { value: "60", label: "60 FPS", description: "Smooth, larger file"   },
];

function estimateFileSizeMB(
  resolution: Resolution,
  fps: FPS,
  durationSeconds = 10.5
): number {
  const bitrateMap: Record<Resolution, Record<number, number>> = {
    "720p":  { 30: 4,  60: 6  },
    "1080p": { 30: 8,  60: 12 },
    "4k":    { 30: 25, 60: 40 },
  };
  const mbps = bitrateMap[resolution][fps];
  return Math.round((mbps * durationSeconds) / 8);
}

export function ExportDialog({
  open,
  onClose,
  templateId,
  productName,
}: ExportDialogProps) {
  const [resolution, setResolution] = useState<Resolution>("1080p");
  const [fps, setFps] = useState<FPS>(60);
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const resConfig = RESOLUTIONS.find((r) => r.value === resolution)!;
  const estimatedMB = estimateFileSizeMB(resolution, fps);

  const handleExport = useCallback(async () => {
    setStatus("encoding");
    setProgress(0);
    setDownloadUrl(null);
    setErrorMsg("");

    // Simulate encoding progress (real WebCodecs integration would go here)
    try {
      const totalFrames = fps * 10.5;
      for (let i = 0; i <= totalFrames; i++) {
        await new Promise((resolve) => setTimeout(resolve, 8));
        setProgress(Math.round((i / totalFrames) * 100));
      }

      // Simulate creating a blob URL
      const blob = new Blob(["mock-mp4-data"], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg("Encoding failed. Please try again.");
    }
  }, [fps]);

  const handleDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${productName.replace(/\s+/g, "-").toLowerCase()}-${resolution}-${fps}fps.mp4`;
    a.click();
  };

  const handleClose = () => {
    if (status === "encoding") return; // block close during export
    onClose();
    setStatus("idle");
    setProgress(0);
    setDownloadUrl(null);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto w-full max-w-md",
            "bg-surface-1 border border-white/[0.08]",
            "rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)]",
            "animate-in fade-in zoom-in-95 duration-200"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.05]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent-500/15 flex items-center justify-center">
                <Film className="w-5 h-5 text-accent-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Export Video</h2>
                <p className="text-xs text-zinc-500">MP4 · H.264 · Client-side</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={status === "encoding"}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition-all disabled:opacity-30"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Resolution */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">
                Resolution
              </label>
              <div className="grid grid-cols-3 gap-2">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setResolution(r.value)}
                    disabled={status === "encoding"}
                    className={cn(
                      "flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs transition-all",
                      "border disabled:opacity-40",
                      resolution === r.value
                        ? "bg-accent-500/15 border-accent-500/40 text-accent-400"
                        : "bg-surface-2 border-white/[0.06] text-zinc-400 hover:border-white/[0.12] hover:text-zinc-200"
                    )}
                  >
                    <span className="font-semibold">{r.label.split(" ")[0]}</span>
                    <span className="opacity-60">
                      {r.w}×{r.h}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* FPS */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">
                Frame Rate
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FPS_OPTIONS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFps(Number(f.value) as FPS)}
                    disabled={status === "encoding"}
                    className={cn(
                      "flex flex-col items-start gap-0.5 py-2.5 px-3 rounded-xl text-xs transition-all",
                      "border disabled:opacity-40",
                      fps === Number(f.value)
                        ? "bg-accent-500/15 border-accent-500/40 text-accent-400"
                        : "bg-surface-2 border-white/[0.06] text-zinc-400 hover:border-white/[0.12] hover:text-zinc-200"
                    )}
                  >
                    <span className="font-semibold">{f.label}</span>
                    <span className="opacity-60">{f.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-surface-2 border border-white/[0.05]">
              <div className="text-xs text-zinc-400 space-y-0.5">
                <div>
                  Format:{" "}
                  <span className="font-mono text-zinc-300">MP4 · H.264</span>
                </div>
                <div>
                  Output:{" "}
                  <span className="font-mono text-zinc-300">
                    {resConfig.w}×{resConfig.h} · {fps}fps
                  </span>
                </div>
              </div>
              <div className="text-right text-xs text-zinc-400">
                <div className="text-lg font-semibold text-zinc-200 font-mono">
                  ~{estimatedMB}
                  <span className="text-sm font-normal"> MB</span>
                </div>
                <div className="text-zinc-600">estimated</div>
              </div>
            </div>

            {/* Progress / status */}
            {status === "encoding" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Encoding frames…</span>
                  <span className="font-mono text-accent-400">{progress}%</span>
                </div>
                <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-[width] duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[11px] text-zinc-600">
                  This runs entirely in your browser — no upload needed.
                </p>
              </div>
            )}

            {status === "error" && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-300">{errorMsg}</p>
              </div>
            )}

            {status === "done" && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-300">
                  Export complete! Your video is ready to download.
                </p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-6 pb-5 flex items-center gap-3">
            {status === "done" ? (
              <>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4" />
                  Download MP4
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStatus("idle")}
                >
                  Export Again
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleExport}
                  isLoading={status === "encoding"}
                  disabled={status === "encoding"}
                >
                  <Film className="w-4 h-4" />
                  {status === "encoding" ? "Encoding…" : "Export Video"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleClose}
                  disabled={status === "encoding"}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
