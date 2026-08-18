# Development reference

Detail moved out of the root README so it stays a consumer-facing page. Everything here
is about building and shipping the app, not about using it.

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
  "@runanywhere/proto-ts":     "^0.20.24",
  "@runanywhere/web":          "^0.20.24",
  "@runanywhere/web-llamacpp": "^0.20.24",
  "@runanywhere/web-onnx":     "^0.20.24"
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

