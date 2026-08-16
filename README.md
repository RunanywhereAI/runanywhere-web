# RunAnywhere web example

A browser app built on the RunAnywhere Web SDK. Models download to the browser
and run there via WebAssembly, with a WebGPU path where the browser and the
model support it. Prompts, audio, images, and documents stay on the device.

## What works

| Surface | What it does | SDK entry point |
|---|---|---|
| Assistant | Streaming chat, tool calling, saved conversations | `RunAnywhere.llm.generateStream`, `RunAnywhere.llm.tools` |
| Talk | Full voice session (VAD, STT, LLM, TTS) | `RunAnywhere.voice.createSession` |
| Image & Live | Describe a photo or a live camera frame | `RunAnywhere.vlm.generateStream` |
| Transcribe | Batch and streaming speech to text | `RunAnywhere.stt.transcribe`, `.transcribeStream` |
| Read Aloud | Speak arbitrary text | `RunAnywhere.tts.speak` |
| Voice Activity | Streaming speech detection | `RunAnywhere.vad.detectStream` |
| Documents | RAG over `.txt`, `.md`, and `.json` files you drop in | `RunAnywhere.rag.open` |
| Solutions | Two packaged YAML pipelines: voice agent and document Q&A | `RunAnywhere.solutions.run` |
| Benchmarks | One prompt at three token budgets (50, 256, 512), charted | `RunAnywhere.llm.generateStream` |
| Downloads | Model registry, disk usage, storage folder | `RunAnywhere.storage`, `RunAnywhere.models` |
| Settings | Generation preferences, API credentials, Hugging Face token | `RunAnywhere.setHuggingFaceToken` |

Segmentation and Diarization have views and SDK calls wired, but no browser
engine registers those capabilities, so the catalog is empty for both and each
tab renders an unavailable placeholder.

## Requirements

| Item | Minimum |
|---|---|
| Node.js | 22.12 (CI runs 24) |
| Browser | Chrome or Edge 86, Safari, Firefox |
| Cross-origin isolation | Required for `SharedArrayBuffer`. The dev server and `vercel.json` send COOP `same-origin` and COEP `require-corp`; `public/coi-serviceworker.js` covers hosts that cannot |
| Disk space | Hundreds of megabytes to a few gigabytes for downloaded models, held in OPFS |

## Run it

```bash
git clone https://github.com/RunanywhereAI/runanywhere-web.git
cd runanywhere-web

npm ci
npm run dev      # http://localhost:3000
```

`npm ci` pulls the SDK and its WASM artifacts. There is no separate WASM build
step and no Emscripten toolchain to install.

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on `localhost:3000` (strict port) with COOP/COEP headers |
| `npm run build` | Production bundle into `dist/`, including the Emscripten `.js`/`.wasm` pairs |
| `npm run preview` | Serve the built `dist/` on `localhost:3000` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over `src`, zero warnings tolerated |
| `npm run test` | Vitest over `src/**/*.test.ts` |
| `npm run release:build` | `build` followed by `release:verify` |
| `npm run release:verify` | Assert `dist/` holds every required runtime file |
| `npm run release:deploy` | Build, verify, and deploy a prebuilt static bundle to Vercel |

## SDK packages

Everything comes from the npm registry. There are no `file:` links, no `paths`
aliases, and no monorepo checkout, so `npm install` is the only thing that
decides which SDK version the app runs against. Both the TypeScript modules and
every WASM artifact come out of `node_modules/@runanywhere/*`.

```jsonc
"dependencies": {
  "@runanywhere/proto-ts":     "^0.20.19",
  "@runanywhere/web":          "^0.20.19",
  "@runanywhere/web-llamacpp": "^0.20.19",
  "@runanywhere/web-onnx":     "^0.20.19"
}
```

| Package | Role |
|---|---|
| `@runanywhere/web` | SDK lifecycle and the inference facades. `@runanywhere/web/browser` adds `AudioCapture`, `AudioFileLoader`, and `VideoCapture` |
| `@runanywhere/web-llamacpp` | LLM and VLM backend registration, CPU and WebGPU builds |
| `@runanywhere/web-onnx` | Sherpa-ONNX backend registration for STT, TTS, VAD, and embeddings |
| `@runanywhere/proto-ts` | Generated protobuf types for models, events, errors, and modalities |

To try an unreleased SDK build, `npm install` a packed tarball or use
`npm link`. Do not reintroduce a source alias.

## WASM artifacts

Five JS/WASM pairs ship across the three SDK packages. `vite.config.ts` copies
each canonical pair into `dist/assets/` next to Vite's hashed copy, because
Emscripten's pthread glue starts its workers from the original filename.

| Pair | Package |
|---|---|
| `racommons.{js,wasm}` | `@runanywhere/web` |
| `racommons-llamacpp.{js,wasm}` | `@runanywhere/web-llamacpp` |
| `racommons-llamacpp-webgpu.{js,wasm}` | `@runanywhere/web-llamacpp` |
| `racommons-onnx-sherpa.{js,wasm}` | `@runanywhere/web-onnx` |
| `racommons-onnx-sherpa-webgpu.{js,wasm}` | `@runanywhere/web-onnx` |

A production build fails naming the missing files rather than shipping a bundle
that only breaks after deployment.

## Project layout

```
runanywhere-web/
  index.html               Vite entry, plus the pre-paint theme script and boot screen
  src/
    main.ts                Boot: cross-origin isolation, SDK init, backend registration, catalog
    app.ts                 Shell, drawer navigation, hash routing, the Advanced hub
    views/                 One file per surface: chat, vision, voice, transcribe, speak, vad,
                           segmentation, diarization, documents, storage, solutions,
                           benchmarks, settings
    services/              Model catalog, engine availability, conversation store (IndexedDB),
                           Hugging Face client, markdown, formatting helpers
    components/            Model selection sheet, dialogs, file drop, icons, shared notices
    styles/                design-system.css is the only token layer
  public/coi-serviceworker.js   Cross-origin-isolation fallback
  scripts/release.sh       Static release verify, stage, and deploy
  tests/                   Manual browser test plan
  vite.config.ts           Dev/preview COOP-COEP headers, WASM copy plugin, chrome86 target
  vercel.json              COOP/COEP headers and SPA rewrites
```

Every surface has a URL fragment (`#/vision`, `#/benchmarks`), so a tab survives
a refresh, a pasted link, and the reload the isolation service worker performs
on Safari.

Views may import `@runanywhere/web` and `@runanywhere/web/browser`. They must
not reach into `@runanywhere/web/internal` or `@runanywhere/web/backend`, and
must not reimplement SDK routing, storage, or inference rules in UI code. See
`AGENTS.md`.

## Configuration

Settings holds an API key and base URL for the session only; neither is written
to storage. For a hosted deployment, Vite reads two build-time variables and
boots the SDK straight into the production environment:

| Variable | Meaning |
|---|---|
| `VITE_RUNANYWHERE_API_KEY` | Publishable browser key. Never a server-side secret, since Vite inlines it into the bundle |
| `VITE_RUNANYWHERE_BASE_URL` | Production API origin |

Both must be set, or the app boots in the development environment.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull request:
`ubuntu-latest` and Node 24, then `npm ci`, `typecheck`, `lint`, `test`, `build`.

CI installs with `npm ci`, the same command `vercel.json` uses, so a
`package-lock.json` out of sync with `package.json` fails the gate instead of
breaking production. Commit the regenerated lock with any dependency change:
`npm install` would quietly repair the lock locally and hide the breakage.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `npm ci` fails with `Missing: @runanywhere/… from lock file` | `package.json` and `package-lock.json` drifted. Run `npm install` and commit the refreshed lock |
| `SharedArrayBuffer is not defined` | The page is not cross-origin isolated. Serve with COOP `same-origin` and COEP `require-corp` |
| Build fails naming missing `racommons-*` files | The SDK packages did not install completely. Re-run `npm ci` |
| Model download stalls or workers hang | Hard-reload to clear a stale service worker, then recheck the COOP/COEP headers |
| A WebGPU model produces garbage | Switch that model to the CPU variant |

## Related

| Resource | Link |
|---|---|
| iOS example | [github.com/RunanywhereAI/runanywhere-ios](https://github.com/RunanywhereAI/runanywhere-ios) |
| Android example | [github.com/RunanywhereAI/runanywhere-android](https://github.com/RunanywhereAI/runanywhere-android) |
| Electron example | [github.com/RunanywhereAI/runanywhere-electron](https://github.com/RunanywhereAI/runanywhere-electron) |
| SDK monorepo | [github.com/RunanywhereAI/runanywhere-sdks](https://github.com/RunanywhereAI/runanywhere-sdks) |
| Discord | [discord.gg/N359FBbDVd](https://discord.gg/N359FBbDVd) |
| Email | founders@runanywhere.ai |

## License

RunAnywhere License, based on Apache 2.0 with additional commercial-use terms.
See [LICENSE](LICENSE).
