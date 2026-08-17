# WASM artifacts

Full detail on the five canonical JS/WASM pairs. Referenced from `AGENTS.md`,
which keeps only the invariant (all five must ship; there is no standalone
speech path). Runtime assets are copied out of the installed packages
(`node_modules/@runanywhere/{web,web-llamacpp,web-onnx}/wasm`) by the
`copy-wasm` Vite plugin in `vite.config.ts`. CPU and WebGPU are separate
builds for both llama.cpp and Sherpa.

| Pair | Package | Loaded by | Used by |
|---|---|---|---|
| `racommons.{js,wasm}` | `@runanywhere/web` | `RunAnywhere.initialize()` | every surface |
| `racommons-llamacpp.{js,wasm}` | `@runanywhere/web-llamacpp` | `LlamaCPP.register()` | Assistant, Image & Live, Documents, Benchmarks |
| `racommons-llamacpp-webgpu.{js,wasm}` | `@runanywhere/web-llamacpp` | same call, chosen by the runtime capability probe | same, when WebGPU and Asyncify are available |
| `racommons-onnx-sherpa.{js,wasm}` | `@runanywhere/web-onnx` | `ONNX.register()` | Talk, Transcribe, Read Aloud, Voice Activity, embeddings and RAG |
| `racommons-onnx-sherpa-webgpu.{js,wasm}` | `@runanywhere/web-onnx` | same call, ORT WebGPU EP path | same, when the EP probe succeeds |

Speech acceleration is independent of LLM acceleration. `ONNX.register()`
takes its own `acceleration` and `threads`, and `RunAnywhere.runtime.speech`
reports the result separately from `RunAnywhere.runtime.active`.

STT, TTS, and VAD run through the proto-byte adapters in `@runanywhere/web`
against the Sherpa vtable inside `racommons-onnx-sherpa.wasm`. There is no
standalone speech provider path and no `wasm/sherpa/` directory.

Every canonical `.js` in the table is required Emscripten runtime glue, not
build input. Vite emits a hashed copy for the main-thread import, and
pthread-enabled modules additionally load their canonical self-name from
workers (Emscripten's pthread glue starts workers using the original
filename, e.g. `new Worker(new URL("racommons.js", import.meta.url))`). The
WebGPU and Asyncify artifacts are deliberately non-threaded, but their
canonical glue is still required. Production output must contain and serve
all five canonical pairs with JavaScript and `application/wasm` MIME types,
never an SPA HTML fallback — `scripts/release.sh verify` and the `copy-wasm`
plugin's `buildStart` check both enforce this before a bundle ships.
