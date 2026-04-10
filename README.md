# Spotlight

**Launch videos & interactive demos — open-source, in your browser.**

Spotlight is the open-source alternative to [Arcade](https://arcade.software). It combines cinematic product launch videos, interactive click-through demos, and screen recording enhancement into one platform — all running entirely client-side with zero server dependencies.

---

## 🆕 Recent Updates (Fork)

This fork includes the following improvements to the **Interactive Demo Builder**:

### Video Analysis & Screenshot Extraction
- **Real video analysis** — replaced placeholder logic with actual `VideoAnalyzer` engine for multi-step screenshot extraction
- **Sensitivity presets** — choose Low / Medium / High / Very High to control scene detection granularity
- **Improved scene detection** — fixed consecutive cut frame handling so no screen changes are missed

### Editor Enhancements
- **Hotspot resize** — drag handle + numeric W/H inputs in properties panel
- **Callout resize** — drag handle + numeric W/H inputs
- **Callout font size** — adjustable 8–32px via slider
- **Callout alignment** — horizontal (left/center/right) and vertical (top/middle/bottom)
- **Blur region drag & resize** — full drag-to-move and resize handle support
- **Image upload per step** — drop or click to upload screenshots for manually added steps
- **Image fit modes** — Cover / Contain / Fill toggle per step
- **Bulk apply** — set transition type and duration across all steps at once
- **Overlay selection fix** — hotspots, callouts, and blur regions can now be reliably selected after creation

### Preview & Export
- **Step transitions** — fade, slide-left, slide-right, zoom, morph, none — all working in preview and DemoPlayer
- **HTML export parity** — all editor properties (hotspot shape, callout size/font/alignment, image fit, blur regions, branch targets) now correctly reflected in exported HTML
- **Hotspot shape** — changed from circle to rounded rectangle for better coverage of UI elements

---

## What You Can Do

### Launch Videos
Create Apple-quality product videos from 6 cinematic templates. 60fps Canvas 2D rendering, one-click H.264 export up to 4K via WebCodecs. No watermark, no account.

### Interactive Demos
Build click-through product tours with:
- **Hotspots** — pulse, highlight, outline, or arrow styles with hover tooltips
- **Callouts** — tooltip, badge, numbered, and arrow annotations with `{{variable}}` personalization
- **Chapters & Branching** — group steps into chapters, branch to any step on click
- **Page Morph** — edit text and swap images directly in screenshots
- **Blur & Mask** — hide sensitive content with blur, solid mask, or pixelate
- **Voiceover** — auto-generate narration per step via Web Speech API
- **Embeddable Player** — export as self-contained HTML, iframe, or React component
- **Analytics** — track step views, completion rate, drop-off, branch paths

### Enhance Recordings
Upload any screen recording and Spotlight auto-detects scenes, clicks, and cursor paths, then applies cinematic camera zoom, smooth cursor animation, device frames, and background music. Export a polished MP4 in one click.

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/lanslote/spotlight_fork.git
cd spotlight_fork
npm install

# Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you're ready to go.

### CLI

```bash
cd cli
npm install
npm run build
npx spotlight create
```

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/templates` | Browse 6 video templates |
| `/editor/[id]` | Visual video editor with live preview |
| `/enhance` | Upload & enhance screen recordings |
| `/demo` | Interactive demo builder |

---

## Tech Stack

- **Framework** — Next.js 14 (App Router), React 18, TypeScript 5
- **Styling** — Tailwind CSS 3.4, custom design tokens
- **Rendering** — Canvas 2D API, 60fps animation pipeline
- **Video Export** — WebCodecs API (H.264/AAC), mp4-muxer, GIF89a encoder
- **Audio** — Web Audio API (OfflineAudioContext), SFX synthesis, AudioMixer
- **Speech** — Web Speech API for voiceover generation
- **Physics** — Spring simulation for camera & cursor smoothing
- **Analysis** — Frame differencing for scene/click/cursor detection

---

## Engine Architecture

```
VirtualClock → Timeline → CanvasRenderer → Compositor → Encoder
                                ↑
                    CameraSystem (spring physics)
                    CursorEngine (Catmull-Rom paths)
                    AudioMixer (music + SFX + voiceover)
```

### Engine Modules

| Module | Purpose |
|--------|---------|
| `video-analyzer` | Detect scenes, clicks, cursor from recordings |
| `compositor` | Layer composition with camera, cursor, device frames |
| `camera-system` | Spring-physics camera zoom & pan |
| `cursor-engine` | Smooth cursor with Catmull-Rom → Bezier paths |
| `encoder` | H.264/AAC encoding via WebCodecs + mp4-muxer |
| `audio-mixer` | Mix background music, SFX, and voiceover |
| `demo-engine` | Interactive demo data model & playback |
| `demo-exporter` | Export demos as HTML, MP4, GIF, JSON, shareable links |
| `page-morph` | Edit text/images in screenshots via canvas |
| `voiceover` | Text-to-speech with Web Speech API |
| `demo-analytics` | Client-side analytics with localStorage persistence |

---

## Spotlight vs Arcade

| Feature | Spotlight | Arcade |
|---------|:---------:|:------:|
| Interactive click-through demos | Yes | Yes |
| Hotspots & callouts | Yes | Yes |
| Chapters & branching | Yes | Yes |
| Page morph | Yes | Yes |
| Blur & mask | Yes | Yes |
| Embeddable player | Yes | Yes |
| Voiceover | Yes | Yes |
| Analytics | Yes | Yes |
| Cinematic launch videos | Yes | No |
| Screen recording enhancement | Yes | No |
| 6 video templates | Yes | No |
| 4K 60fps export | Yes | No |
| Open-source | Yes | No |
| No watermark | Yes | No |
| Runs in-browser | Yes | No |
| Free forever | Yes | No |
| **Price** | **Free** | **$32/mo+** |

---

## License

- **Core** — AGPL-3.0
- **Templates** — MIT
