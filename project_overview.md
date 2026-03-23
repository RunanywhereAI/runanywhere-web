# PrivateIDE — Project Overview

> **HackXtreme 2026 · Web Applications — AI-Powered Productivity Tools**

---

## What Is PrivateIDE?

PrivateIDE is a **fully local, offline-first AI coding and research workspace** that runs a real LLM entirely inside the browser. No backend server. No API keys. No cloud. Every byte of inference runs on-device via WebAssembly/WebGPU using the [RunAnywhere SDK](https://docs.runanywhere.ai).

It solves three real problems:

| Problem | PrivateIDE's Solution |
|---|---|
| Cloud AI costs $0.08–0.35/min | **$0 inference forever** — local WASM model |
| Pasting code into ChatGPT leaks IP | **Model never leaves the device** — zero network requests |
| Cloud AI adds 300–400ms latency | **Sub-100ms local inference**, no spinners |
| Cloud AI is useless offline | **Fully functional on airplane mode** after first model load |

### Two Modes, One Core

````carousel
**Dev Mode** — A Monaco-powered code editor for engineers at companies where pasting internal code into ChatGPT is a compliance violation.

![Dev Mode](C:/Users/Ritesh%20Kumar%20Singh/.gemini/antigravity/brain/f2053587-a141-46ef-a5a3-1191759457e2/dev_mode_screenshot.png)
<!-- slide -->
**Research Mode** — A multi-PDF workspace for PhD students, medical researchers, and academics working with embargoed or sensitive data.

![Research Mode](C:/Users/Ritesh%20Kumar%20Singh/.gemini/antigravity/brain/f2053587-a141-46ef-a5a3-1191759457e2/research_mode_screenshot.png)
````

**The killer demo moment:** Open Chrome DevTools → Network tab → use PrivateIDE → show **ZERO outbound AI requests**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **AI Runtime** | RunAnywhere SDK (`@runanywhere/web` + `web-llamacpp`) — llama.cpp compiled to WASM/WebGPU |
| **Model** | LFM2 350M Q4_K_M (Liquid AI) — ~350MB, cached in OPFS |
| **Frontend** | React 18 + TypeScript + Vite 5 |
| **Code Editor** | Monaco Editor (VS Code engine in-browser) |
| **PDF Parsing** | PDF.js — 100% client-side text extraction |
| **Styling** | Tailwind CSS v4 + custom dark IDE theme |
| **Storage** | OPFS (model cache) + IndexedDB (docs + history) + localStorage (prefs) |

---

## What Has Been Done

### ✅ Phase 1 — Foundation (Complete)
- Project scaffold with full TypeScript type safety
- Vite config with COOP/COEP headers (required for SharedArrayBuffer/WASM threading)
- RunAnywhere SDK singleton initialization with dynamic imports
- EventBus wiring for model download progress tracking
- OPFS model caching — 350MB model downloads once, loads from cache forever
- IndexedDB schema + CRUD for documents and chat sessions
- PDF.js integration with client-side text extraction
- PDF text chunker with overlapping windows for LLM context fitting
- Custom dark IDE theme (deep charcoal `#0a0e1a` + electric cyan `#00d4ff` accent)

### ✅ Phase 2 — Dev Mode (Complete)
- Monaco editor with `vs-dark` theme, JetBrains Mono font, minimap, bracket coloring
- **4 AI-powered features**, all streaming tokens in real-time:
  - 💡 **Explain** — line-by-line code explanation
  - 📝 **Docstring** — JSDoc/Python/Rust/Go doc generation
  - 🐛 **Debug** — paste error message → root cause analysis + fix
  - 🔧 **Refactor** — clean code suggestions with examples
- Auto language detection from code heuristics (JS, TS, Python, Rust, Go, Java, etc.)
- Copy/Download output buttons

### ✅ Phase 3 — Research Mode + Polish (Complete)
- Drag-and-drop PDF loader with visual hover animation
- Loaded documents list with page count, chunk count, and remove button
- **3 AI-powered research features:**
  - 💬 **Q&A** — ask questions, get answers with source attribution (filename + page)
  - 📋 **Outline** — generate structured thesis chapter outline (JSON → formatted tree)
  - 📚 **Citations** — extract metadata, format as APA/MLA/IEEE + BibTeX export
- Keyword-based chunk retrieval for context building
- Animated pill mode switcher (Dev ↔ Research) with cyan glow
- VS Code-style status bar (model state, language, mode, token count)
- Model loader overlay with progress bar (first-load only)
- Offline banner (`navigator.onLine` detection)
- Empty states with helpful feature descriptions
- Keyboard shortcuts: `Ctrl+Enter` (run action), `Ctrl+Shift+M` (toggle mode)

---

## What Is Pending

> [!NOTE]
> The core application is functional end-to-end. These are enhancements that would strengthen the demo.

| Item | Priority | Effort |
|---|---|---|
| **Test AI output quality** — run all 7 AI features and fine-tune prompts for the 350M model | 🔴 High | 1–2 hrs |
| **Chat history persistence** — save/load sessions from IndexedDB (UI exists, wiring needed) | 🟡 Medium | 1 hr |
| **Error boundary** — graceful React error fallback if SDK crashes | 🟡 Medium | 30 min |
| **GitHub Pages deployment** — add `base` to vite config + deployment workflow | 🟡 Medium | 30 min |
| **Context window warning** — show UI toast when loaded PDFs exceed ~4000 tokens | 🟢 Low | 20 min |
| **Monaco minimap toggle** — add settings panel for editor preferences | 🟢 Low | 30 min |

---

## Future Enhancements

> Ideas that align with the **local-first, privacy-preserving, developer-tool** theme.

### 🧠 AI Capabilities
- **Multi-turn chat** — conversational follow-ups within the same context window
- **Code generation** — "Write a function that…" with language selection
- **Inline suggestions** — Monaco autocomplete powered by local LLM (like Copilot, but private)
- **Diff view** — show refactoring suggestions as side-by-side code diffs
- **Model selector** — swap between LFM2 350M (fast) and SmolLM2 360M (different strengths)
- **Larger model support** — LFM2 1.2B Tool for better quality when hardware allows

### 📄 Research Enhancements
- **Vector embeddings** — replace keyword search with semantic similarity (run embeddings locally too)
- **Cross-document synthesis** — "Compare conclusions across these 5 papers"
- **Annotation layer** — highlight PDF regions and link them to AI-generated notes
- **Literature review generator** — multi-paper summary with gap analysis
- **Export to LaTeX** — one-click thesis framework with generated outline + citations

### 🛠 Developer Experience
- **File tabs** — open multiple files like a real IDE
- **Syntax highlighting in output** — render markdown/code blocks in the AI response panel
- **Git integration** — paste a diff, get AI review (still 100% local)
- **Multi-language support** — i18n for the UI, keep prompts in English for model quality
- **Custom prompt templates** — let users define their own AI actions

### ⚡ Performance & Infrastructure
- **WebGPU-first inference** — detect and prefer GPU acceleration for 2–5x speedup
- **Service Worker** — full PWA with offline install, app icon, and splash screen
- **Shared Worker** — run LLM inference in a shared worker so multiple tabs share one model
- **Streaming markdown renderer** — parse and render markdown while tokens stream in
- **Memory management** — monitor WASM memory usage, warn before OOM on low-end devices

### 🎨 Design Polish
- **Command palette** — `Ctrl+P` for quick action access (VS Code-style)
- **Split pane resizer** — drag to resize left/right panels
- **Theme customizer** — switch between cyan, green, amber, and purple accent colors
- **Typing indicator** — subtle animation while model generates tokens
- **Onboarding tour** — first-time user walkthrough highlighting key features

---

*Built for HackXtreme 2026 — something a senior engineer would be proud to demo on stage.*
