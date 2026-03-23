/**
 * RunAnywhere SDK singleton init + EventBus wiring.
 * All SDK imports are done here to keep them contained.
 */

import type { LLMStatus } from '../../types';

// ── State ──

export const MODEL_ID = 'lfm2-350m-q4_k_m';

type ProgressCallback = (progress: number) => void;
type StatusCallback = (status: string) => void;

let _progressCb: ProgressCallback | null = null;
let _statusCb: StatusCallback | null = null;

export function onProgress(cb: ProgressCallback) { _progressCb = cb; }
export function onStatus(cb: StatusCallback) { _statusCb = cb; }

let _initPromise: Promise<void> | null = null;
let _modelLoaded = false;
let _accelMode = 'cpu';

// Store SDK refs after dynamic import
let _TextGeneration: any = null;
let _ModelManager: any = null;
let _ModelCategory: any = null;

export async function initPrivateIDE(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      _statusCb?.('Initializing SDK…');

      // Dynamic imports to avoid module-level failures
      const webSDK = await import('@runanywhere/web');
      const llamaSDK = await import('@runanywhere/web-llamacpp');

      const { RunAnywhere, SDKEnvironment, ModelManager, ModelCategory, LLMFramework, EventBus, TextGeneration } = webSDK;
      const { LlamaCPP } = llamaSDK;

      _TextGeneration = TextGeneration;
      _ModelManager = ModelManager;
      _ModelCategory = ModelCategory;

      // Step 1: Initialize core SDK
      await RunAnywhere.initialize({
        environment: SDKEnvironment.Development,
        debug: false,
      });

      // Step 2: Register LlamaCPP backend
      await LlamaCPP.register();
      _accelMode = LlamaCPP.isRegistered ? LlamaCPP.accelerationMode : 'cpu';

      // Step 3: Register model catalog
      RunAnywhere.registerModels([
        {
          id: MODEL_ID,
          name: 'LFM2 350M Q4_K_M',
          repo: 'LiquidAI/LFM2-350M-GGUF',
          files: ['LFM2-350M-Q4_K_M.gguf'],
          framework: LLMFramework.LlamaCpp,
          modality: ModelCategory.Language,
          memoryRequirement: 250_000_000,
        },
      ]);

      // Step 4: Wire EventBus
      EventBus.shared.on('model.downloadProgress', (evt: any) => {
        const pct = evt.progress ?? 0;
        _progressCb?.(pct);
        _statusCb?.(`Downloading model… ${(pct * 100).toFixed(0)}%`);
      });

      EventBus.shared.on('model.downloadCompleted', () => {
        _statusCb?.('Download complete. Loading model…');
      });

      EventBus.shared.on('model.loadCompleted', () => {
        _statusCb?.('Model ready');
        _modelLoaded = true;
      });

      // Step 5: Download + load model
      _statusCb?.('Downloading model…');
      await ModelManager.downloadModel(MODEL_ID);

      _statusCb?.('Loading model into memory…');
      await ModelManager.loadModel(MODEL_ID);

      _modelLoaded = true;
      _statusCb?.('Model ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      _statusCb?.(`Init failed: ${msg}`);
      console.error('PrivateIDE init error:', err);
      throw err;
    }
  })();

  return _initPromise;
}

export function getAccelerationMode(): string {
  return _accelMode;
}

export function isModelLoaded(): boolean {
  return _modelLoaded;
}

// ── Generation APIs ──

export async function generate(
  prompt: string,
  opts?: { systemPrompt?: string; maxTokens?: number; temperature?: number }
) {
  if (!_TextGeneration) throw new Error('SDK not initialized');
  return _TextGeneration.generate(prompt, {
    maxTokens: opts?.maxTokens ?? 512,
    temperature: opts?.temperature ?? 0.3,
    systemPrompt: opts?.systemPrompt,
  });
}

export async function generateStream(
  prompt: string,
  opts?: { systemPrompt?: string; maxTokens?: number; temperature?: number }
) {
  if (!_TextGeneration) throw new Error('SDK not initialized');
  return _TextGeneration.generateStream(prompt, {
    maxTokens: opts?.maxTokens ?? 512,
    temperature: opts?.temperature ?? 0.3,
    systemPrompt: opts?.systemPrompt,
  });
}
