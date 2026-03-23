# PrivateIDE — Local-First AI Workspace

> **HackXtreme 2026 · Web Productivity Track · Local-First AI Workspace**

PrivateIDE is a fully local, offline-first AI coding and research workspace that runs a real LLM entirely inside the browser. No backend server. No API keys. No cloud. Every byte of inference runs on-device via WebAssembly / WebGPU using the RunAnywhere SDK.

---

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open **http://localhost:5173** in Chrome or Edge.

---

## ⚡ First Load (Model Download)

On first visit, PrivateIDE downloads the **LFM2 350M** LLM (~350 MB) and caches it in-browser via OPFS. After this one-time download, the model loads instantly from cache — even offline.

### The Zero-Network Demo

1. Open Chrome DevTools → **Network** tab
2. Clear the log, check "Preserve log"
3. Use any PrivateIDE feature (Explain, Q&A, etc.)
4. Observe: **ZERO outbound AI requests** — everything is local

---

## 🖥 Dev Mode

Paste code into the Monaco editor and use AI-powered tools:

| Action | What it does |
|---|---|
| 💡 **Explain** | Line-by-line code explanation |
| 📝 **Docstring** | Generate JSDoc/Python/Rust doc comments |
| 🐛 **Debug** | Paste error message → get root cause + fix |
| 🔧 **Refactor** | Clean code suggestions with examples |

**Keyboard:** `Ctrl+Enter` runs the selected action.

---

## 📄 Research Mode

Drag in PDFs and use AI-powered research tools:

| Action | What it does |
|---|---|
| 💬 **Q&A** | Ask questions about loaded documents |
| 📋 **Outline** | Generate thesis chapter structure |
| 📚 **Citations** | Extract and format APA/MLA/IEEE references |

All PDF parsing is 100% client-side via PDF.js.

---

## 🏗 Tech Stack

- **AI:** RunAnywhere SDK (WebAssembly/WebGPU) + LFM2 350M Q4_K_M
- **Frontend:** React 18 + TypeScript + Vite 5
- **Editor:** Monaco Editor (VS Code engine)
- **PDF:** PDF.js client-side extraction
- **Styling:** Tailwind CSS v4
- **Storage:** OPFS (model cache) + IndexedDB (docs + history)

---

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer  (React + Vite)                               │
│  Monaco editor · PDF drop zone · Chat panel             │
├─────────────────────────────────────────────────────────┤
│  App Logic Layer  (TypeScript)                          │
│  Prompt templates · PDF chunker · Citation formatter    │
├─────────────────────────────────────────────────────────┤
│  RunAnywhere SDK  (WebAssembly / WebGPU)                │
│  LLM inference · Streaming · Structured JSON output     │
├─────────────────────────────────────────────────────────┤
│  Client-Side Storage                                    │
│  OPFS (model files) · IndexedDB (docs + history)        │
└─────────────────────────────────────────────────────────┘
```

---

## ⌨ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Enter` | Run selected AI action |
| `Ctrl+K` | Focus Q&A input (Research Mode) |
| `Ctrl+Shift+M` | Toggle Dev / Research mode |

---

## 📁 Project Structure

```
src/
├── App.tsx                    Main application
├── main.tsx                   Entry point
├── index.css                  Design system (dark IDE theme)
├── types/index.ts             TypeScript interfaces
├── hooks/
│   ├── useLLM.ts              RunAnywhere SDK hook
│   └── useIndexedDB.ts        Document & session persistence
├── lib/
│   ├── llm/
│   │   ├── init.ts            SDK singleton + model management
│   │   ├── prompts.ts         All prompt templates
│   │   └── structured.ts      JSON parsing + citation formatting
│   ├── pdf/
│   │   ├── parser.ts          PDF.js text extraction
│   │   └── chunker.ts         Context window chunking
│   └── storage/
│       ├── opfs.ts            OPFS file utilities
│       └── db.ts              IndexedDB CRUD
└── components/
    ├── Layout/
    │   ├── AppShell.tsx        Two-panel split layout
    │   ├── ModeToggle.tsx      Animated Dev|Research toggle
    │   └── StatusBar.tsx       VS Code-style status bar
    ├── DevMode/
    │   ├── CodeEditor.tsx      Monaco editor
    │   └── DevToolbar.tsx      AI action buttons
    ├── ResearchMode/
    │   ├── PDFDropZone.tsx     Drag-and-drop PDF loader
    │   ├── PDFList.tsx         Loaded documents list
    │   └── ResearchToolbar.tsx Research AI actions
    └── Shared/
        ├── OutputPanel.tsx     Streaming output display
        ├── ModelLoader.tsx     Download progress overlay
        └── ChatHistory.tsx     Session history
```

---

## 🛡 Privacy Guarantee

After initial model download, every feature works with the network cable physically unplugged. No data ever leaves your browser.

---

*Built for HackXtreme 2026 — AI-Powered Productivity Tools*
