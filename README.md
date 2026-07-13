# RunAnywhere Web Starter App

A minimal React + TypeScript starter app demonstrating **on-device AI in the browser** using the [`@runanywhere/web`](https://www.npmjs.com/package/@runanywhere/web) SDK. All inference runs locally via WebAssembly — no server, no API key, 100% private.

## Features

Every capability is driven through a single public `@runanywhere/web` API — no
business logic in the app.

| Tab | Capability | SDK surface |
|-----|-----------|-------------|
| **Chat** | LLM streaming chat | `RunAnywhere.generateStream(...)` |
| **Vision** | Vision-language (VLM) | `RunAnywhere.visionLanguage.processImageStream(...)` |
| **Voice** | Full voice agent (VAD → STT → LLM → TTS) | `RunAnywhere.initializeVoiceAgentWithLoadedModels()` + `VoiceAgentMicDriver` |
| **Tools** | Tool / function calling | `RunAnywhere.generateWithTools(...)`, `RunAnywhere.toolCalling.*` |
| **Transcribe** | Speech-to-text (batch + live) | `RunAnywhere.transcribe(...)`, `RunAnywhere.transcribeStream(...)` |
| **Speak** | Text-to-speech | `RunAnywhere.speak(...)`, `RunAnywhere.stopSpeaking()` |
| **VAD** | Voice activity detection | `RunAnywhere.streamVAD(...)` |
| **Docs** | RAG over your documents | `RunAnywhere.ragCreatePipeline / ragIngest / ragQuery` |
| **Embeddings** | Semantic similarity | `RunAnywhere.embeddings.embed(...)`, `embeddingCosineSimilarity(...)` |
| **JSON** | Structured (schema-constrained) output | `RunAnywhere.generateStructured(...)` |

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Models are downloaded on first use and cached in the browser's Origin Private File System (OPFS).

## How It Works

```
@runanywhere/web (npm package)
  ├── WASM engine (llama.cpp, whisper.cpp, sherpa-onnx)
  ├── Model management (download, OPFS cache, load/unload)
  └── TypeScript API (TextGeneration, STT, TTS, VAD, VLM, VoicePipeline)
```

The app initializes the SDK once, registers the two backends, and seeds the
model catalog (all in `src/runanywhere.ts`):

```typescript
import { RunAnywhere, SDKEnvironment } from '@runanywhere/web';
import { LlamaCPP } from '@runanywhere/web-llamacpp';
import { ONNX } from '@runanywhere/web-onnx';

await RunAnywhere.initialize({
  environment: SDKEnvironment.SDK_ENVIRONMENT_DEVELOPMENT,
});
await LlamaCPP.register();  // LLM + VLM (CPU/WebGPU)
await ONNX.register();      // STT + TTS + VAD + embeddings (sherpa-onnx)

// Stream LLM text
const { stream, result } = await RunAnywhere.generateStream({ prompt: 'Hello!', maxTokens: 200 });
for await (const token of stream) { console.log(token); }
```

## Project Structure

```
src/
├── main.tsx                    # React root
├── App.tsx                     # Tab navigation
├── runanywhere.ts              # SDK init + model catalog
├── hooks/
│   └── useModelLoader.ts       # Shared per-category download/load hook
├── components/
│   ├── ChatTab.tsx             # LLM streaming chat
│   ├── VisionTab.tsx           # Camera + VLM inference
│   ├── VoiceTab.tsx            # Voice agent (VAD→STT→LLM→TTS)
│   ├── ToolsTab.tsx            # Tool / function calling
│   ├── TranscribeTab.tsx       # STT (batch + live)
│   ├── SpeakTab.tsx            # TTS
│   ├── VadTab.tsx              # Voice activity detection
│   ├── DocumentsTab.tsx        # RAG over uploaded documents
│   ├── EmbeddingsTab.tsx       # Embeddings + cosine similarity
│   ├── StructuredOutputTab.tsx # Schema-constrained JSON output
│   └── ModelBanner.tsx         # Download/load progress UI
└── styles/
    └── index.css               # Dark theme CSS
```

## Model Catalog

Models are registered in `src/runanywhere.ts` through the SDK's
`RunAnywhere.registerModel*` facades — one small model per modality so you can
download and experiment quickly:

| Modality | Model |
|----------|-------|
| LLM | LFM2 350M Q4_K_M · LFM2 1.2B Tool Q4_K_M |
| VLM | LFM2-VL 450M Q8_0 (+ mmproj) |
| STT | Whisper Tiny English (sherpa-onnx) |
| TTS | Piper US English Lessac |
| VAD | Silero VAD |
| Embeddings | All-MiniLM-L6-v2 (+ vocab) |

```typescript
RunAnywhere.registerModel(url, name, InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP, {
  id: 'my-model',
  modality: ModelCategory.MODEL_CATEGORY_LANGUAGE,
  memoryRequirement: 500_000_000,
  downloadSizeBytes: 400_000_000,
});
```

Any GGUF model compatible with llama.cpp works for LLM/VLM. STT/TTS/VAD/embeddings use sherpa-onnx / ONNX models.

## Deployment

### Vercel

```bash
npm run build
npx vercel --prod
```

The included `vercel.json` sets the required Cross-Origin-Isolation headers.

### Netlify

Add a `_headers` file:

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: credentialless
```

### Any static host

Serve the `dist/` folder with these HTTP headers on all responses:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

## Browser Requirements

- Chrome 96+ or Edge 96+ (recommended: 120+)
- WebAssembly (required)
- SharedArrayBuffer (requires Cross-Origin Isolation headers)
- OPFS (for persistent model cache)

## Documentation

- [SDK API Reference](https://docs.runanywhere.ai)
- [npm package](https://www.npmjs.com/package/@runanywhere/web)
- [GitHub](https://github.com/RunanywhereAI/runanywhere-sdks)

## License

MIT
