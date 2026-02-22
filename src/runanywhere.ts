import {
  RunAnywhere,
  SDKEnvironment,
  EventBus,
  ModelCategory,
  LLMFramework,
  type CompactModelDef,
  TextGeneration,
} from '@runanywhere/web';

import { LlamaCPP, VLMWorkerBridge } from '@runanywhere/web-llamacpp';
import { ONNX } from '@runanywhere/web-onnx';
import type { AccelerationMode } from '@runanywhere/web';

// @ts-ignore — Vite-specific ?worker&url query
import vlmWorkerUrl from './workers/vlm-worker?worker&url';

// ✅ IMPORTANT: Use the INSTANCE, not .shared
import { ModelManager } from '@runanywhere/web';

// ---------------------------------------------------------------------------
// Model catalog (yours)
// ---------------------------------------------------------------------------

const MODELS: CompactModelDef[] = [
  {
    id: 'lfm2-350m-q4_k_m',
    name: 'LFM2 350M Q4_K_M',
    repo: 'LiquidAI/LFM2-350M-GGUF',
    files: ['LFM2-350M-Q4_K_M.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Language,
    memoryRequirement: 250_000_000,
  },
  {
    id: 'lfm2-vl-450m-q4_0',
    name: 'LFM2-VL 450M Q4_0',
    repo: 'runanywhere/LFM2-VL-450M-GGUF',
    files: ['LFM2-VL-450M-Q4_0.gguf', 'mmproj-LFM2-VL-450M-Q8_0.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Multimodal,
    memoryRequirement: 500_000_000,
  },
  {
    id: 'sherpa-onnx-whisper-tiny.en',
    name: 'Whisper Tiny English (ONNX)',
    url: 'https://huggingface.co/runanywhere/sherpa-onnx-whisper-tiny.en/resolve/main/sherpa-onnx-whisper-tiny.en.tar.gz',
    framework: LLMFramework.ONNX,
    modality: ModelCategory.SpeechRecognition,
    memoryRequirement: 105_000_000,
    artifactType: 'archive' as const,
  },
  {
    id: 'vits-piper-en_US-lessac-medium',
    name: 'Piper TTS US English (Lessac)',
    url: 'https://huggingface.co/runanywhere/vits-piper-en_US-lessac-medium/resolve/main/vits-piper-en_US-lessac-medium.tar.gz',
    framework: LLMFramework.ONNX,
    modality: ModelCategory.SpeechSynthesis,
    memoryRequirement: 65_000_000,
    artifactType: 'archive' as const,
  },
  {
    id: 'silero-vad-v5',
    name: 'Silero VAD v5',
    url: 'https://huggingface.co/runanywhere/silero-vad-v5/resolve/main/silero_vad.onnx',
    files: ['silero_vad.onnx'],
    framework: LLMFramework.ONNX,
    modality: ModelCategory.Audio,
    memoryRequirement: 5_000_000,
  },
];

const LANGUAGE_MODEL_ID =
  (import.meta as any).env?.VITE_LANGUAGE_MODEL_ID || 'lfm2-350m-q4_k_m';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _initPromise: Promise<void> | null = null;
let _accelerationMode: AccelerationMode | null = null;

let _loading = false;
let _ready = false;
let _lastError: string | null = null;

// ---------------------------------------------------------------------------
// Public API (used by your app)
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

export async function init(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    await RunAnywhere.initialize({
      environment: SDKEnvironment.Development,
      debug: true,
    });

    EventBus.shared.on('llamacpp.wasmLoaded', (evt) => {
      _accelerationMode = (evt.accelerationMode as AccelerationMode) ?? 'cpu';
    });

    await LlamaCPP.register();
    await ONNX.register();

    // Register catalog
    RunAnywhere.registerModels(MODELS);

    // Wire up VLM worker
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

/**
 * Downloads + loads the provided model from your catalog.
 * (First run will take time because it downloads into OPFS.)
 */


export async function loadProvidedLanguageModel(): Promise<boolean> {
  _loading = true;
  _lastError = null;

  try {
    await init();

    // download first (this is where most errors happen)
    await ModelManager.downloadModel(LANGUAGE_MODEL_ID);

    const ok = await ModelManager.loadModel(LANGUAGE_MODEL_ID, { coexist: true });
    if (!ok) {
      // IMPORTANT: get error stored inside registry if available
      const loaded = ModelManager.getLoadedModel?.(ModelCategory.Language);
      _lastError = loaded?.error ?? 'ModelManager.loadModel() returned false.';
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
  }
}
/**
 * Generate text from the loaded model.
 * Web SDK uses TextGeneration.generate(). :contentReference[oaicite:1]{index=1}
 */
export async function generate(
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const ok = await loadProvidedLanguageModel();
  if (!ok) throw new Error(_lastError ?? 'Model not ready.');

  const maxTokens = opts?.maxTokens ?? 600;
  const temperature = opts?.temperature ?? 0.2;

  // ✅ Try newer API shapes first, then fall back
  const anyLlama: any = LlamaCPP as any;

  // Variant A: LlamaCPP.generate(...)
  if (typeof anyLlama.generate === 'function') {
    const out = await anyLlama.generate({
      prompt,
      maxTokens,
      temperature,
    });
    if (typeof out === 'string') return out;
    return out?.text ?? out?.output ?? JSON.stringify(out);
  }

  // Variant B: LlamaCPP.text.generate(...)
  if (anyLlama.text && typeof anyLlama.text.generate === 'function') {
    const out = await anyLlama.text.generate(prompt, { maxTokens, temperature });
    if (typeof out === 'string') return out;
    return out?.text ?? out?.output ?? JSON.stringify(out);
  }

  // Variant C: ModelManager might expose an LLM runner in your build (rare)
  const anyMM: any = ModelManager as any;
  if (typeof anyMM.generate === 'function') {
    const out = await anyMM.generate({
      prompt,
      maxTokens,
      temperature,
    });
    if (typeof out === 'string') return out;
    return out?.text ?? out?.output ?? JSON.stringify(out);
  }

  throw new Error(
    'No text generation API found in this SDK build. Please paste your @runanywhere/web-llamacpp type exports.'
  );
}