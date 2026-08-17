# RunAnywhere web example: agent guide

This is the browser validation app for the RunAnywhere Web SDK. It consumes the
public facade from `@runanywhere/web`, backend registration from
`@runanywhere/web-llamacpp` and `@runanywhere/web-onnx`, and capture helpers
from `@runanywhere/web/browser`.

The app may break when the SDK facade changes. Update it to the current API
rather than preserving old compatibility imports.

## Dependency rules

The SDK is consumed from npm, always. The four `@runanywhere/*` packages are
ordinary `dependencies`, and `npm install` is the only thing that decides which
SDK version this app runs against. There are no source aliases, `paths`
mappings, `--prefix` scripts, or `fs.allow` whitelists pointing at any SDK
checkout, and none may be reintroduced. To test an unreleased SDK build,
`npm install` a packed tarball or use `npm link`. Both the TypeScript modules
and every WASM runtime artifact come out of `node_modules/@runanywhere/*`.

Three publishable Web packages, plus generated types:

- `@runanywhere/web` for SDK lifecycle and the inference facades.
  `@runanywhere/web/browser` is its capture entrypoint (`AudioCapture`,
  `AudioFileLoader`, `VideoCapture`).
- `@runanywhere/web-llamacpp` for LLM and VLM registration, CPU and WebGPU.
- `@runanywhere/web-onnx` for Sherpa STT, TTS, VAD, and embedding registration.
- `@runanywhere/proto-ts` for generated protobuf types.

Views may import the public roots and `@runanywhere/web/browser`. They must not
import `@runanywhere/web/internal` or `@runanywhere/web/backend`, deep-import
package source, import one backend from another, or implement SDK model
routing, storage, or inference rules in UI code. Only `main.ts` imports the
backend packages, and it does so dynamically at registration and teardown time.
Put reusable SDK behavior in the lowest applicable SDK package and keep each
view focused on DOM state and user-flow orchestration.

## Types, inputs, errors, credentials

- Keep strict TypeScript. No `any`, `@ts-ignore`, raw JSON assumptions, or
  hand-written copies of proto DTOs and enums. Use `@runanywhere/proto-ts` for
  models, lifecycle, events, storage, modalities, environments, and errors. Use
  local discriminated unions only for browser UI state.
- Treat settings, localStorage, IndexedDB, files, URLs, media, model downloads,
  and network responses as external input. Validate and narrow before calling
  the SDK, and show structured errors without exposing stack traces. Chat
  history is persistent, origin-scoped IndexedDB data; the Web RAG index is
  session-only and must not be presented as persistent. Keep app-owned chat
  records in IndexedDB. `RunAnywhere.storage` owns model artifacts and storage
  analysis, not arbitrary application records.
- Never log or persist API keys or tokens. Keys entered in Settings are
  session-only and are sent directly by the browser. `VITE_RUNANYWHERE_API_KEY`
  and `VITE_RUNANYWHERE_BASE_URL` are build-time values that Vite inlines into
  the bundle, so only a publishable browser key belongs there. Persist only
  explicitly allowlisted non-secret settings. The configured endpoint must
  support browser CORS.
- `appLogger` reduces an `Error` to `{ errorType }` so a message carrying a
  signed URL cannot reach the console. Pass `formatError(err)` when the reason
  itself needs to survive, and it will route through the redacting path.
- This example is static and client-only. Do not add `api/`, `server/`,
  serverless functions, proxies, embedded credentials, or secret environment
  variables. Secret-bearing control-plane calls need a backend built,
  authenticated, and deployed outside this example.
- UI copy and controls must be truthful. Render distinct typed idle, loading,
  ready, success, unavailable, cancelled, and error states. Never show a fake
  toggle, treat a download as inference success, or label a failed backend or
  model as ready.

## Navigation

Every surface has a URL fragment (`#/vision`). The fragment is the single
source of truth for which tab is showing: `navigateToTab` writes it,
`popstate` and `hashchange` read it back, and `applyRoute` is the only path to
`switchTab`. A fragment was chosen over the History API because this app ships
as a static bundle that must also work from a bare file server. Do not add a
router library and do not reintroduce a module-scope tab index.

Surfaces reached by drilling in carry `parent` in the `TABS` table and get a
shell-owned Back button injected into their toolbar. Views must not add their
own Back control.

## Design system

Brand primary is `#FF6900` (the logo orange), the strong interactive tone is
`#E65E00`, and the brand gradient is `linear-gradient(135deg, #FF6900,
#FB2C36)`. The canonical palette, typography, and contrast rules live in
`docs/DESIGN_GUIDELINE.md` in the SDK monorepo
([runanywhere-sdks](https://github.com/RunanywhereAI/runanywhere-sdks)), which
is not vendored here. This app hand-maintains its mirror as CSS custom
properties in `src/styles/design-system.css`, the single token layer that
`commons.css` and `components.css` consume.

Light and dark are declared once each, keyed only on `:root[data-theme="…"]`.
There is deliberately no `@media (prefers-color-scheme: …)` copy of the
palette: the inline script in `index.html` resolves the OS preference to a
concrete `data-theme` value before first paint, and `renderTheme()` in `app.ts`
repaints on preference change while the user is still following the OS. Do not
add a media-query duplicate of the palette, do not reintroduce the legacy
`#FF5500` orange, and do not hardcode brand hexes in views. The one sanctioned
exception is the boot screen's inline critical CSS in `index.html`, which
cannot reach the token layer.

## Commands

Run from the repository root. Node must satisfy `engines` (`>=22.12.0`).
Production output is pinned to `chrome86` in `vite.config.ts` so a Vite major
upgrade cannot silently raise the Web SDK's documented browser floor. That
target does not polyfill missing browser APIs; WebGPU stays optional and falls
back to CPU.

```bash
npm ci          # pulls the @runanywhere/* packages, JS and WASM
npm run lint
npm run typecheck
npm run test
npm run build
npm run dev     # http://localhost:3000, COOP/COEP enabled
```

To cut a production release (build, verify, deploy to Vercel, and the required
post-deploy browser pass), use the `runanywhere-web-release` skill rather than
running `release:deploy` ad hoc.

`scripts/` holds `release.sh`, which owns release verification, staging, and
deployment, plus `sync-skills.sh` (regenerates the `.agents/skills` mirror of
`.claude/skills` for non-Claude tooling — never hand-edit the mirror). Extend
`release.sh` or add an npm script rather than another single-use wrapper.

`src/services/solutions-config.ts` is vendored, not generated here. Upstream is
`core/examples/solutions/*.yaml` in the SDK monorepo. The generator that
produced this file was not extracted into this repo, so update it by copying
the upstream YAML over the string constants by hand. (The file's own header
comment still names pre-0.20.17 monorepo paths.)

## SDK surface by view

The app uses the namespaced facade throughout — nothing calls the flat
deprecated aliases. Full per-surface table (view file → SDK calls):
[`docs/reference/sdk-surface-by-view.md`](docs/reference/sdk-surface-by-view.md).

Only Segmentation and Diarization render `renderModalityUnavailable`. Chat gates
on `runtime.modalities.llm.status`; Vision, Transcribe, Speak, VAD, and
Documents gate on `services/engine-availability` instead, which tracks the
per-engine registration outcome that `runtime.modalities` cannot report.
Voice does not gate at all: it calls the verb and surfaces the SDK's typed
`backendNotAvailable` error.

## WASM artifacts

Five independently built execution artifacts ship across three packages (CPU
and WebGPU builds of both llama.cpp and Sherpa), copied out of the installed
`@runanywhere/*` packages by the `copy-wasm` Vite plugin. Full pair/package/
loader table and the pthread-glue rationale:
[`docs/reference/wasm-artifacts.md`](docs/reference/wasm-artifacts.md).

STT, TTS, and VAD run through the proto-byte adapters in `@runanywhere/web`
against the Sherpa vtable inside `racommons-onnx-sherpa.wasm` — there is no
standalone speech provider path and no `wasm/sherpa/` directory. Production
output must contain and serve all five canonical JS/WASM pairs, never an SPA
HTML fallback; `scripts/release.sh verify` and the plugin's `buildStart` check
both enforce this before a bundle ships. Diffusion is a core facade with no
browser engine and no publishable WASM — do not show it as available and do
not add it to packaging.

## Boot and availability rules

`main.ts` owns the whole boot path, and Settings reuses it so applying
credentials cannot leave a partially configured runtime behind a success
message. The order is:

1. `ensureCrossOriginIsolation()`, which registers `coi-serviceworker.js` and
   reloads once if the page is not already isolated.
2. `RunAnywhere.initialize()`, then `RunAnywhere.storage.restore()`.
3. `LlamaCPP.register()`, then `ONNX.register()`, each dynamically imported and
   each wrapped so one failing does not abort the other.
4. Model catalog registration, `RunAnywhere.storage.refresh()`, and the
   post-init registry log.

Rules that follow from that:

- `RunAnywhere.initialize()` is fail-closed. A core WASM failure throws and
  `main()` shows the error view with Retry.
- Backend registration is fail-soft at boot (`requireAllBackends: false`) and
  fail-closed when Settings applies production credentials. Every outcome goes
  through `reportEngineRegistration`, which is what the picker and the runtime
  row read. Never let a view infer engine health any other way.
- Both backends register with `requireBackendWorker: true`, so inference runs
  in a backend worker and a failed handshake is a registration failure rather
  than a silent main-thread fallback.
- Identity is cloud-dependent and completes in the background after
  `initialize()` returns. The shell never waits on it.
- Retry is a runtime restart, not a page reload: `retryEngineRegistration()`
  tears down and re-runs `startRuntime`, preserving conversations and the
  current tab. It serializes against a Settings apply through a shared promise.

## Validation

A passing build or app launch is smoke validation only. End-to-end modality
validation needs a real browser, a model download, a model load, real
inference, and reviewed logs and screenshots. Automated release coverage lives
with the Web SDK in its own `bindings/web/tests/browser/` Playwright suite, not
here. [`tests/web-sdk-test-suite.md`](tests/web-sdk-test-suite.md) is this
repo's manual checklist; the `runanywhere-web-release` skill runs it as part of
cutting a release.

Before handoff run `npm ci`, `npm run lint`, `npm run typecheck`, `npm run
test`, and a production `npm run build`.

The app publishes `window.__RUNANYWHERE_AI_READY__` (a readiness snapshot),
`window.__RUNANYWHERE_SDK__`, and mirrored `data-runanywhere-ai-*` attributes on
`<html>`. That is the contract browser harnesses probe; keep it stable.
