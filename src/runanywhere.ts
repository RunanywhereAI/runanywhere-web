/**
 * RunAnywhere SDK initialization + model catalog.
 *
 * What this module does:
 * 1) Initializes RunAnywhere core SDK (TypeScript)
 * 2) Registers LlamaCPP backend (loads WASM for LLM/VLM)
 * 3) Registers ONNX backend (STT/TTS/VAD)
 * 4) Registers model catalog
 * 5) Wires VLM worker bridge
 * 6) Exposes helpers to load the provided Language model and generate text
 *
 * Import this module once at app startup (or call init() before model loading).
 */

import {
  RunAnywhere,
  SDKEnvironment,
  EventBus,
  ModelManager,
  ModelCategory,
  LLMFramework,
  type CompactModelDef,
} from "@runanywhere/web";

import { LlamaCPP, VLMWorkerBridge } from "@runanywhere/web-llamacpp";
import { ONNX } from "@runanywhere/web-onnx";
import type { AccelerationMode } from "@runanywhere/web";

// @ts-ignore — Vite-specific ?worker&url query
import vlmWorkerUrl from "./workers/vlm-worker?worker&url";

// ---------------------------------------------------------------------------
// Model catalog
// ---------------------------------------------------------------------------

const MODELS: CompactModelDef[] = [
  {
    id: "lfm2-350m-q4_k_m",
    name: "LFM2 350M Q4_K_M",
    repo: "LiquidAI/LFM2-350M-GGUF",
    files: ["LFM2-350M-Q4_K_M.gguf"],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Language,
    memoryRequirement: 250_000_000,
  },
  {
    id: "lfm2-vl-450m-q4_0",
    name: "LFM2-VL 450M Q4_0",
    repo: "runanywhere/LFM2-VL-450M-GGUF",
    files: ["LFM2-VL-450M-Q4_0.gguf", "mmproj-LFM2-VL-450M-Q8_0.gguf"],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Multimodal,
    memoryRequirement: 500_000_000,
  },
  {
    id: "sherpa-onnx-whisper-tiny.en",
    name: "Whisper Tiny English (ONNX)",
    url: "https://huggingface.co/runanywhere/sherpa-onnx-whisper-tiny.en/resolve/main/sherpa-onnx-whisper-tiny.en.tar.gz",
    framework: LLMFramework.ONNX,
    modality: ModelCategory.SpeechRecognition,
    memoryRequirement: 105_000_000,
    artifactType: "archive" as const,
  },
  {
    id: "vits-piper-en_US-lessac-medium",
    name: "Piper TTS US English (Lessac)",
    url: "https://huggingface.co/runanywhere/vits-piper-en_US-lessac-medium/resolve/main/vits-piper-en_US-lessac-medium.tar.gz",
    framework: LLMFramework.ONNX,
    modality: ModelCategory.SpeechSynthesis,
    memoryRequirement: 65_000_000,
    artifactType: "archive" as const,
  },
  {
    id: "silero-vad-v5",
    name: "Silero VAD v5",
    url: "https://huggingface.co/runanywhere/silero-vad-v5/resolve/main/silero_vad.onnx",
    files: ["silero_vad.onnx"],
    framework: LLMFramework.ONNX,
    modality: ModelCategory.Audio,
    memoryRequirement: 5_000_000,
  },
];

// Use provided model id if set, else default
const LANGUAGE_MODEL_ID =
  (import.meta as any).env?.VITE_LANGUAGE_MODEL_ID || "lfm2-350m-q4_k_m";

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _initPromise: Promise<void> | null = null;
let _loadPromise: Promise<boolean> | null = null;

let _accelerationMode: AccelerationMode | null = null;
let _loading = false;
let _ready = false;
let _lastError: string | null = null;

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

export function getModelStatus() {
  const def = MODELS.find((m) => m.id === LANGUAGE_MODEL_ID);
  return {
    ready: _ready,
    loading: _loading,
    modelId: LANGUAGE_MODEL_ID,
    modelName: def?.name ?? LANGUAGE_MODEL_ID,
    lastError: _lastError,
  };
}

export function getAccelerationMode(): AccelerationMode | null {
  return _accelerationMode;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export async function init(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    await RunAnywhere.initialize({
      environment: SDKEnvironment.Development,
      debug: true,
    });

    // Track acceleration mode once WASM loads (cpu/webgpu/etc)
    try {
      EventBus.shared.on("llamacpp.wasmLoaded", (evt: any) => {
        _accelerationMode = (evt?.accelerationMode as AccelerationMode) ?? "cpu";
      });
    } catch {
      // EventBus might differ by version — safe to ignore
    }

    // Register backends (loads WASM automatically)
    await LlamaCPP.register();
    await ONNX.register();

    // Register models
    RunAnywhere.registerModels(MODELS);

    // Wire VLM worker
    VLMWorkerBridge.shared.workerUrl = vlmWorkerUrl;

    RunAnywhere.setVLMLoader({
      get isInitialized() {
        return VLMWorkerBridge.shared.isInitialized;
      },
      init: () => VLMWorkerBridge.shared.init(),
      loadModel: (params) => VLMWorkerBridge.shared.loadModel(params),
      unloadModel: () => VLMWorkerBridge.shared.unloadModel(),
    });
  })();

  return _initPromise;
}

// ---------------------------------------------------------------------------
// Load provided Language model (for chat)
// ---------------------------------------------------------------------------

export async function loadProvidedLanguageModel(): Promise<boolean> {
  // ✅ already ready
  if (_ready && ModelManager.getLoadedModel(ModelCategory.Language)) return true;

  // ✅ lock to prevent parallel loads
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    _loading = true;
    _lastError = null;

    try {
      await init();

      // If already loaded by category, mark ready and return
      if (ModelManager.getLoadedModel(ModelCategory.Language)) {
        _ready = true;
        return true;
      }

      // Download only if needed (downloadModel should cache)
      await ModelManager.downloadModel(LANGUAGE_MODEL_ID);

      // coexist = true so it doesn't unload other categories accidentally
      const ok = await ModelManager.loadModel(LANGUAGE_MODEL_ID, { coexist: true });

      if (!ok) {
        _ready = false;
        _lastError = "ModelManager.loadModel() returned false.";
        return false;
      }

      _ready = true;
      return true;
    } catch (e) {
      _ready = false;
      _lastError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      return false;
    } finally {
      _loading = false;
      _loadPromise = null;
    }
  })();

  return _loadPromise;
}

// ---------------------------------------------------------------------------
// Generate helper
// ---------------------------------------------------------------------------

/**
 * Generate text from the loaded model.
 * IMPORTANT: does NOT re-download repeatedly; load is locked by loadProvidedLanguageModel().
 */
export async function generate(
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const ok = await loadProvidedLanguageModel();
  if (!ok) throw new Error(_lastError ?? "Model not ready.");

  const maxTokens = opts?.maxTokens ?? 600;
  const temperature = opts?.temperature ?? 0.2;

  const anyLlama: any = LlamaCPP as any;

  // SDK variants: LlamaCPP.generate({ prompt, ... }) OR LlamaCPP.text.generate(prompt, opts)
  if (typeof anyLlama.generate === "function") {
    const out = await anyLlama.generate({ prompt, maxTokens, temperature });
    if (typeof out === "string") return out;
    return out?.text ?? out?.output ?? JSON.stringify(out);
  }

  if (anyLlama.text && typeof anyLlama.text.generate === "function") {
    const out = await anyLlama.text.generate(prompt, { maxTokens, temperature });
    if (typeof out === "string") return out;
    return out?.text ?? out?.output ?? JSON.stringify(out);
  }

  throw new Error(
    "No text generation API found in this SDK build. Check @runanywhere/web-llamacpp exports."
  );
}

// Convenience exports (used across app)
export { RunAnywhere, ModelManager, ModelCategory, VLMWorkerBridge };