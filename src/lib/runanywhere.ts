import {
  RunAnywhere,
  SDKEnvironment,
  EventBus,
  ModelManager,
  ModelCategory,
  LLMFramework,
  type CompactModelDef,
  type AccelerationMode,
} from '@runanywhere/web';
import { LlamaCPP, TextGeneration, VLMWorkerBridge } from '@runanywhere/web-llamacpp';
import { ONNX } from '@runanywhere/web-onnx';
import { buildFallbackResponse } from './chat-schema';

// @ts-ignore Vite worker url
import vlmWorkerUrl from '../workers/vlm-worker?worker&url';

export const LANGUAGE_MODEL_ID = 'lfm2-350m-q4_k_m';

const MODELS: CompactModelDef[] = [
  {
    id: LANGUAGE_MODEL_ID,
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
];

export interface ModelRuntimeStatus {
  initialized: boolean;
  modelLoaded: boolean;
  lastInferenceAt: number | null;
  lastError: string | null;
  modelId: string;
}

const status: ModelRuntimeStatus = {
  initialized: false,
  modelLoaded: false,
  lastInferenceAt: null,
  lastError: null,
  modelId: LANGUAGE_MODEL_ID,
};

let initPromise: Promise<void> | null = null;
let accelerationMode: AccelerationMode | null = null;

export async function init(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await RunAnywhere.initialize({ environment: SDKEnvironment.Development, debug: true });
    EventBus.shared.on('llamacpp.wasmLoaded', (evt) => {
      accelerationMode = (evt.accelerationMode as AccelerationMode) ?? 'cpu';
    });
    await LlamaCPP.register();
    await ONNX.register();
    RunAnywhere.registerModels(MODELS);
    VLMWorkerBridge.shared.workerUrl = vlmWorkerUrl;
    RunAnywhere.setVLMLoader({
      get isInitialized() {
        return VLMWorkerBridge.shared.isInitialized;
      },
      init: () => VLMWorkerBridge.shared.init(),
      loadModel: (params) => VLMWorkerBridge.shared.loadModel(params),
      unloadModel: () => VLMWorkerBridge.shared.unloadModel(),
    });
    status.initialized = true;
  })();
  return initPromise;
}

export async function loadProvidedLanguageModel(): Promise<boolean> {
  await init();
  try {
    const model = ModelManager.getModels().find((m) => m.id === LANGUAGE_MODEL_ID);
    if (!model) {
      status.lastError = `Provided model not registered: ${LANGUAGE_MODEL_ID}`;
      return false;
    }
    if (model.status !== 'downloaded' && model.status !== 'loaded') {
      await ModelManager.downloadModel(model.id);
    }
    const ok = await ModelManager.loadModel(model.id, { coexist: false });
    status.modelLoaded = ok;
    if (!ok) status.lastError = 'Model failed to load.';
    return ok;
  } catch (err) {
    status.lastError = err instanceof Error ? err.message : String(err);
    status.modelLoaded = false;
    return false;
  }
}

export async function generate(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string> {
  try {
    const out = await TextGeneration.generate(prompt, { maxTokens: options?.maxTokens ?? 700, temperature: options?.temperature ?? 0.2 });
    status.lastInferenceAt = Date.now();
    status.lastError = null;
    return out.text.trim();
  } catch {
    status.lastError = 'Inference failed. Ensure the local model is downloaded and loaded.';
    return JSON.stringify(buildFallbackResponse('Local generation failed. Please ensure the model is downloaded and retry.'));
  }
}

export function getModelStatus(): ModelRuntimeStatus {
  return { ...status };
}

export function getAccelerationMode(): AccelerationMode | null {
  return accelerationMode;
}

export { ModelCategory, ModelManager };
