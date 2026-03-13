"use client";

/**
 * @module DemoPlayerEmbed
 *
 * Lightweight embeddable wrapper around DemoPlayer.
 *
 * Designed to be loaded inside an <iframe>. Communicates with the parent page
 * via the postMessage API using a namespaced `spotlight:*` message protocol.
 *
 * PostMessage contract
 * ────────────────────
 * Outbound (iframe → parent):
 *   { type: "spotlight:ready" }
 *   { type: "spotlight:step-change", stepId: string, stepIndex: number }
 *   { type: "spotlight:complete" }
 *
 * Inbound (parent → iframe):
 *   { type: "spotlight:goto-step", stepId: string }
 *   { type: "spotlight:play" }
 *   { type: "spotlight:pause" }
 */

import { useEffect, useRef, useCallback } from "react";
import { DemoPlayer } from "./demo-player";
import type { Demo } from "@/engine/demo-engine";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DemoPlayerEmbedProps {
  demo: Demo;
  /** Start playing immediately. */
  autoplay?: boolean;
  /** Start at a specific chapter index (0-based). */
  chapter?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DemoPlayerEmbed({ demo, autoplay = false, chapter }: DemoPlayerEmbedProps) {
  const engineCommandRef = useRef<{
    play: () => void;
    pause: () => void;
    goToStep: (id: string) => void;
  } | null>(null);

  // Resolve the starting step from the chapter index.
  const startStep = (() => {
    if (chapter === undefined) return undefined;
    const targetChapter = demo.chapters[chapter];
    if (!targetChapter) return undefined;
    return demo.steps.find((s) => s.chapter === targetChapter.id)?.id;
  })();

  // ── PostMessage: send ──────────────────────────────────────────────────────

  const postToParent = useCallback((payload: Record<string, unknown>) => {
    try {
      // When running inside an iframe, window.parent !== window.
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, "*");
      }
    } catch {
      // Cross-origin restriction — silently ignore.
    }
  }, []);

  // ── PostMessage: receive ───────────────────────────────────────────────────

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Accept messages from any origin for maximum embed flexibility.
      // Implementors may tighten this with a whitelist if needed.
      const { type, stepId } = event.data ?? {};

      switch (type) {
        case "spotlight:goto-step":
          if (typeof stepId === "string") {
            engineCommandRef.current?.goToStep(stepId);
          }
          break;
        case "spotlight:play":
          engineCommandRef.current?.play();
          break;
        case "spotlight:pause":
          engineCommandRef.current?.pause();
          break;
        default:
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // ── Announce ready ─────────────────────────────────────────────────────────

  useEffect(() => {
    postToParent({ type: "spotlight:ready", demoId: demo.id, totalSteps: demo.steps.length });
  }, [demo.id, demo.steps.length, postToParent]);

  // ── Handlers passed down to DemoPlayer ────────────────────────────────────

  const handleStepChange = useCallback(
    (stepId: string) => {
      const stepIndex = demo.steps.findIndex((s) => s.id === stepId);
      postToParent({ type: "spotlight:step-change", stepId, stepIndex });
    },
    [demo.steps, postToParent]
  );

  const handleComplete = useCallback(() => {
    postToParent({ type: "spotlight:complete", demoId: demo.id });
  }, [demo.id, postToParent]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DemoPlayer
      demo={demo}
      autoplay={autoplay}
      startStep={startStep}
      onStepChange={handleStepChange}
      onComplete={handleComplete}
      embedded
      className="w-full h-full"
    />
  );
}

// ─── Embed code generator ─────────────────────────────────────────────────────

/** Options for generating embed snippets. */
export interface EmbedCodeOptions {
  /** Width of the embedded player (default "100%"). */
  width?: string | number;
  /** Height of the embedded player (default 450). */
  height?: string | number;
  /** Auto-start playback. */
  autoplay?: boolean;
  /** Start at chapter index (0-based). */
  chapter?: number;
  /** Base URL for the Spotlight deployment (default current origin). */
  baseUrl?: string;
}

/** All generated embed snippet variants. */
export interface EmbedCodeResult {
  /** Raw <iframe> HTML string. */
  iframe: string;
  /** Self-contained <script> tag for direct-embed without an iframe. */
  script: string;
  /** React JSX usage example. */
  reactUsage: string;
}

/**
 * Generate embeddable code snippets for a given demo.
 *
 * @param demoId   The demo's unique identifier.
 * @param options  Optional configuration for the embed.
 * @returns        An object containing iframe, script, and React usage examples.
 *
 * @example
 * const snippets = generateEmbedCode("demo_abc123", { autoplay: true });
 * console.log(snippets.iframe);
 */
export function generateEmbedCode(
  demoId: string,
  options: EmbedCodeOptions = {}
): EmbedCodeResult {
  const {
    width = "100%",
    height = 450,
    autoplay = false,
    chapter,
    baseUrl = typeof window !== "undefined" ? window.location.origin : "https://your-spotlight-domain.com",
  } = options;

  // Build query string for embed URL.
  const params = new URLSearchParams({ id: demoId });
  if (autoplay) params.set("autoplay", "1");
  if (chapter !== undefined) params.set("chapter", String(chapter));

  const embedUrl = `${baseUrl}/embed/demo?${params.toString()}`;

  const widthAttr = typeof width === "number" ? `${width}px` : width;
  const heightAttr = typeof height === "number" ? `${height}px` : height;

  // ── iframe snippet ──────────────────────────────────────────────────────────
  const iframe = [
    `<iframe`,
    `  src="${embedUrl}"`,
    `  width="${widthAttr}"`,
    `  height="${heightAttr}"`,
    `  frameborder="0"`,
    `  allow="fullscreen"`,
    `  allowfullscreen`,
    `  title="Product Demo"`,
    `  style="border-radius: 12px; overflow: hidden;"`,
    `></iframe>`,
  ].join("\n");

  // ── Script snippet ──────────────────────────────────────────────────────────
  // A minimal inline loader that creates an iframe and wires up postMessage.
  const script = [
    `<div id="spotlight-demo-${demoId}" style="width:${widthAttr};height:${heightAttr}"></div>`,
    `<script>`,
    `(function() {`,
    `  var container = document.getElementById("spotlight-demo-${demoId}");`,
    `  var iframe = document.createElement("iframe");`,
    `  iframe.src = "${embedUrl}";`,
    `  iframe.style.width = "100%";`,
    `  iframe.style.height = "100%";`,
    `  iframe.style.border = "none";`,
    `  iframe.style.borderRadius = "12px";`,
    `  iframe.allow = "fullscreen";`,
    `  iframe.allowFullscreen = true;`,
    `  container.appendChild(iframe);`,
    ``,
    `  // Listen for demo events from the iframe.`,
    `  window.addEventListener("message", function(e) {`,
    `    if (!e.data || !e.data.type) return;`,
    `    var type = e.data.type;`,
    `    if (type === "spotlight:ready") console.log("Spotlight demo ready");`,
    `    if (type === "spotlight:step-change") console.log("Step changed:", e.data.stepId);`,
    `    if (type === "spotlight:complete") console.log("Demo complete");`,
    `  });`,
    ``,
    `  // Control API: window.Spotlight.play(), pause(), goToStep(id).`,
    `  window.Spotlight = window.Spotlight || {};`,
    `  window.Spotlight.play = function() { iframe.contentWindow.postMessage({ type: "spotlight:play" }, "*"); };`,
    `  window.Spotlight.pause = function() { iframe.contentWindow.postMessage({ type: "spotlight:pause" }, "*"); };`,
    `  window.Spotlight.goToStep = function(id) { iframe.contentWindow.postMessage({ type: "spotlight:goto-step", stepId: id }, "*"); };`,
    `})();`,
    `</script>`,
  ].join("\n");

  // ── React usage ──────────────────────────────────────────────────────────────
  const reactUsage = [
    `import { DemoPlayerEmbed } from "@/components/demo/demo-player-embed";`,
    `import type { Demo } from "@/engine/demo-engine";`,
    ``,
    `// Fetch or import your demo data:`,
    `declare const myDemo: Demo;`,
    ``,
    `export default function MyPage() {`,
    `  return (`,
    `    <div style={{ width: "${widthAttr}", height: "${heightAttr}" }}>`,
    `      <DemoPlayerEmbed`,
    `        demo={myDemo}`,
    autoplay ? `        autoplay` : `        autoplay={false}`,
    chapter !== undefined ? `        chapter={${chapter}}` : `        {/* chapter={0} to start at a specific chapter */}`,
    `      />`,
    `    </div>`,
    `  );`,
    `}`,
  ].join("\n");

  return { iframe, script, reactUsage };
}
