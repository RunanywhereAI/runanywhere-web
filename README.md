# RunAnywhere AI — Web Example

<p align="center">
  <img src="https://img.shields.io/badge/Runtime-Browser%20WASM-654FF0?style=flat-square&logo=webassembly&logoColor=white" alt="Browser WASM" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5.9" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/License-RunAnywhere-blue?style=flat-square" alt="RunAnywhere License" />
</p>

**The browser reference app for the RunAnywhere Web SDK.** Chat, speech-to-text,
text-to-speech, voice agent, vision, RAG over your own documents, diarization,
segmentation, benchmarks, and model management — every model runs **in the browser**
via WebAssembly (with a WebGPU path where available). Nothing is uploaded.

---

## Requirements

| Item | Minimum |
|------|---------|
| **Node.js** | 22.12+ (CI runs 24) |
| **Browser** | Chrome/Edge 86+; Safari and Firefox supported |
| **Cross-origin isolation** | Required for `SharedArrayBuffer` — the dev server and `vercel.json` already send COOP/COEP; Safari also uses `public/coi-serviceworker.js` |
| **Disk / cache space** | Several hundred MB–GB for downloaded models (stored in OPFS/IndexedDB) |

---

## Install the SDK

The SDK is consumed **entirely from the npm registry**. There are no `file:` links,
no `paths` aliases, and no monorepo checkout: `npm install` is the single mechanism
that decides which SDK version this app runs against. Both the TypeScript modules
and every WASM artifact come out of `node_modules/@runanywhere/*`.

```jsonc
// package.json — the actual, current declarations
"dependencies": {
  "@runanywhere/proto-ts":     "^0.20.15",
  "@runanywhere/web":          "^0.20.15",
  "@runanywhere/web-llamacpp": "^0.20.15",
  "@runanywhere/web-onnx":     "^0.20.15"
}
```

| Package | Role |
|---|---|
| `@runanywhere/web` | Core SDK lifecycle + public inference facades (`@runanywhere/web/browser` for browser helpers) |
| `@runanywhere/web-llamacpp` | LLM/VLM backend registration — CPU and WebGPU WASM variants |
| `@runanywhere/web-onnx` | Sherpa-ONNX backend registration — STT, TTS, VAD |
| `@runanywhere/proto-ts` | Generated protobuf types (models, events, errors, modalities) |

> **Known-red build:** none of the four packages are published to npm at `0.20.15`
> yet, so `npm install` currently fails with `E404`. Everything in this repo is
> correct for the moment they publish; there is no local fallback by design.

To test an unreleased SDK build, `npm install` a packed tarball or `npm link` —
never re-introduce a source alias.

---

## Run it

```bash
git clone https://github.com/RunanywhereAI/runanywhere-web.git
cd runanywhere-web

npm install      # pulls the SDK + its WASM artifacts from npm
npm run dev      # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on `localhost:3000` (strict port) with COOP/COEP headers |
| `npm run build` | Production bundle into `dist/`, including the canonical Emscripten `.js`/`.wasm` pairs |
| `npm run preview` | Serve the built `dist/` on `localhost:3000` |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint over `src`, zero warnings tolerated |
| `npm run test` | Vitest unit tests (`src/**/*.test.ts`) |

---

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull request:
`ubuntu-latest` + Node 24 → install → `typecheck` → `lint` → `test` → `build`.

It installs with `npm install` rather than `npm ci`, because the committed
`package-lock.json` predates the SDK's npm publish and contains no
`@runanywhere/*` entries — `npm ci` would reject it as out of sync, and it cannot
be regenerated until the packages exist. Once they publish, regenerate and commit
the lock and switch CI back to `npm ci` (which is also what `vercel.json` uses for
deploys). The workflow comment says the same.

---

## Project structure

```
runanywhere-web/
├── index.html                # Vite entry
├── src/
│   ├── main.ts               # Bootstrap + SDK init
│   ├── app.ts                # Shell, routing, tab state
│   ├── views/                # chat, transcribe, speak, voice, vision, documents,
│   │                         # diarization, segmentation, solutions, benchmarks,
│   │                         # storage, settings
│   ├── services/             # Model catalog, conversation store (IndexedDB)
│   ├── components/           # Shared DOM components
│   └── styles/               # Design tokens (brand orange #FF6900)
├── public/coi-serviceworker.js  # Cross-origin-isolation polyfill (Safari)
├── vite.config.ts            # Copies the SDK's canonical WASM pairs into dist/assets
└── vercel.json               # COOP/COEP headers + SPA rewrites
```

Views may import `@runanywhere/web` and `@runanywhere/web/browser`; they must not
reach into `@runanywhere/web/internal` or `/backend`, and must not re-implement
SDK routing, storage, or inference rules in UI code. See `AGENTS.md`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `npm error 404 @runanywhere/web` | The SDK packages are not on npm yet (see above) |
| `SharedArrayBuffer is not defined` | The page is not cross-origin isolated — serve with COOP `same-origin` + COEP `credentialless` (dev server and `vercel.json` do this) |
| Model download stalls or workers hang | Hard-reload to clear a stale service worker, then re-check the COOP/COEP headers |
| WebGPU model produces garbage | Switch that model to the CPU WASM variant in Settings |

---

## Related links

| Resource | Link |
|---|---|
| **iOS example** | [github.com/RunanywhereAI/runanywhere-ios](https://github.com/RunanywhereAI/runanywhere-ios) |
| **Android example** | [github.com/RunanywhereAI/runanywhere-android](https://github.com/RunanywhereAI/runanywhere-android) |
| **Electron example** | [github.com/RunanywhereAI/runanywhere-electron](https://github.com/RunanywhereAI/runanywhere-electron) |
| **SDK monorepo** | [github.com/RunanywhereAI/runanywhere-sdks](https://github.com/RunanywhereAI/runanywhere-sdks) |
| **Discord** | [discord.gg/N359FBbDVd](https://discord.gg/N359FBbDVd) |
| **Email** | founders@runanywhere.ai |

---

## License

This project is licensed under the RunAnywhere License (Apache 2.0 based, with
additional commercial-use terms). See [LICENSE](LICENSE) for details.
