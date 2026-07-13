/**
 * RunAnywhere SDK initialization and model catalog.
 *
 * This module:
 * 1. Initializes the core SDK (loads the commons WASM)
 * 2. Registers the LlamaCPP backend (loads LLM/VLM WASM — VLM runs in-process)
 * 3. Registers the ONNX backend (sherpa-onnx — STT/TTS/VAD)
 * 4. Registers the model catalog via the SDK's `RunAnywhere.registerModel*` facades
 *
 * Import this module once at app startup.
 */

import {
  RunAnywhere,
  SDKEnvironment,
  ModelCategory,
  InferenceFramework,
  ModelArtifactType,
  ModelFileRole,
} from '@runanywhere/web';

import { LlamaCPP } from '@runanywhere/web-llamacpp';
import { ONNX } from '@runanywhere/web-onnx';

// ---------------------------------------------------------------------------
// Model catalog — registered through the SDK's `RunAnywhere.registerModel*`
// facades (never hand-assembled proto `ModelInfo` messages; that's SDK logic).
// ---------------------------------------------------------------------------

function registerCatalog(): void {
  // LLM — Liquid AI LFM2 350M (small + fast for chat)
  RunAnywhere.registerModel(
    'https://huggingface.co/LiquidAI/LFM2-350M-GGUF/resolve/main/LFM2-350M-Q4_K_M.gguf',
    'LFM2 350M Q4_K_M',
    InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP,
    {
      id: 'lfm2-350m-q4_k_m',
      modality: ModelCategory.MODEL_CATEGORY_LANGUAGE,
      memoryRequirement: 250_000_000,
      downloadSizeBytes: 229_309_376,
    },
  );

  // LLM — Liquid AI LFM2 1.2B Tool (optimized for tool calling & function calling)
  RunAnywhere.registerModel(
    'https://huggingface.co/LiquidAI/LFM2-1.2B-Tool-GGUF/resolve/main/LFM2-1.2B-Tool-Q4_K_M.gguf',
    'LFM2 1.2B Tool Q4_K_M',
    InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP,
    {
      id: 'lfm2-1.2b-tool-q4_k_m',
      modality: ModelCategory.MODEL_CATEGORY_LANGUAGE,
      memoryRequirement: 800_000_000,
      downloadSizeBytes: 730_894_048,
    },
  );

  // VLM — Liquid AI LFM2-VL 450M (vision + language, primary GGUF + mmproj
  // sidecar). Mirrors the reference example's known-good Q8_0 entry.
  RunAnywhere.registerModelMultiFile({
    id: 'lfm2-vl-450m-q8_0',
    name: 'LFM2-VL 450M Q8_0',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP,
    modality: ModelCategory.MODEL_CATEGORY_MULTIMODAL,
    memoryRequirement: 650_000_000,
    files: [
      {
        url: 'https://huggingface.co/runanywhere/LFM2-VL-450M-GGUF/resolve/main/LFM2-VL-450M-Q8_0.gguf',
        filename: 'LFM2-VL-450M-Q8_0.gguf',
        role: ModelFileRole.MODEL_FILE_ROLE_PRIMARY_MODEL,
        sizeBytes: 379_215_264,
      },
      {
        url: 'https://huggingface.co/runanywhere/LFM2-VL-450M-GGUF/resolve/main/mmproj-LFM2-VL-450M-Q8_0.gguf',
        filename: 'mmproj-LFM2-VL-450M-Q8_0.gguf',
        role: ModelFileRole.MODEL_FILE_ROLE_VISION_PROJECTOR,
        sizeBytes: 103_890_016,
      },
    ],
  });

  // STT — Whisper Tiny English (sherpa-onnx archive)
  RunAnywhere.registerModelArchive(
    'https://huggingface.co/runanywhere/sherpa-onnx-whisper-tiny.en/resolve/main/sherpa-onnx-whisper-tiny.en.tar.gz',
    'Whisper Tiny English (ONNX)',
    InferenceFramework.INFERENCE_FRAMEWORK_SHERPA,
    ModelArtifactType.MODEL_ARTIFACT_TYPE_TAR_GZ_ARCHIVE,
    {
      id: 'sherpa-onnx-whisper-tiny.en',
      modality: ModelCategory.MODEL_CATEGORY_SPEECH_RECOGNITION,
      memoryRequirement: 105_000_000,
      downloadSizeBytes: 152_777_070,
    },
  );

  // TTS — Piper US English Lessac (sherpa-onnx archive)
  RunAnywhere.registerModelArchive(
    'https://huggingface.co/runanywhere/vits-piper-en_US-lessac-medium/resolve/main/vits-piper-en_US-lessac-medium.tar.gz',
    'Piper TTS US English (Lessac)',
    InferenceFramework.INFERENCE_FRAMEWORK_SHERPA,
    ModelArtifactType.MODEL_ARTIFACT_TYPE_TAR_GZ_ARCHIVE,
    {
      id: 'vits-piper-en_US-lessac-medium',
      modality: ModelCategory.MODEL_CATEGORY_SPEECH_SYNTHESIS,
      memoryRequirement: 65_000_000,
      downloadSizeBytes: 67_389_394,
    },
  );

  // VAD — Silero VAD v5 (single ONNX file). The id MUST be `silero-vad` to
  // match the SDK's `RunAnywhere.defaultVADModelID`, which the voice agent
  // uses to auto-load VAD in `initializeVoiceAgentWithLoadedModels()`.
  RunAnywhere.registerModel(
    'https://huggingface.co/runanywhere/silero-vad-v5/resolve/main/silero_vad.onnx',
    'Silero VAD',
    InferenceFramework.INFERENCE_FRAMEWORK_ONNX,
    {
      id: 'silero-vad',
      modality: ModelCategory.MODEL_CATEGORY_VOICE_ACTIVITY_DETECTION,
      memoryRequirement: 5_000_000,
      downloadSizeBytes: 2_327_524,
    },
  );

  // Embeddings — All MiniLM L6 v2 (ONNX model.onnx + vocab.txt sidecar). Used
  // by the Embeddings demo and as the RAG pipeline's embedding model.
  RunAnywhere.registerModelMultiFile({
    id: 'all-minilm-l6-v2',
    name: 'All MiniLM L6 v2',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_ONNX,
    modality: ModelCategory.MODEL_CATEGORY_EMBEDDING,
    memoryRequirement: 120_000_000,
    files: [
      {
        url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx',
        filename: 'model.onnx',
        role: ModelFileRole.MODEL_FILE_ROLE_PRIMARY_MODEL,
        sizeBytes: 90_387_606,
      },
      {
        url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/vocab.txt',
        filename: 'vocab.txt',
        role: ModelFileRole.MODEL_FILE_ROLE_VOCABULARY,
        sizeBytes: 231_508,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

let _initPromise: Promise<void> | null = null;

/** Initialize the RunAnywhere SDK. Safe to call multiple times. */
export async function initSDK(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    // Step 1: Initialize core SDK (loads racommons.wasm)
    RunAnywhere.setDebugMode(true);
    await RunAnywhere.initialize({
      environment: SDKEnvironment.SDK_ENVIRONMENT_DEVELOPMENT,
    });

    // Step 2: Register backends (loads their own WASM automatically). VLM
    // is wired in-process by LlamaCPP.register() — no separate worker bridge.
    await LlamaCPP.register();
    await ONNX.register();

    // Step 3: Register the model catalog
    registerCatalog();
  })();

  return _initPromise;
}

/** Get acceleration mode after init. */
export function getAccelerationMode(): string | null {
  return LlamaCPP.isRegistered ? LlamaCPP.accelerationMode : null;
}

// Re-export for convenience
export { RunAnywhere, ModelCategory };
