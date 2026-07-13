import { useState, useCallback, useRef } from 'react';
import {
  RunAnywhere,
  ModelCategory,
  modelInfoIsAvailableForUse,
  type ModelInfo,
} from '@runanywhere/web';

export type LoaderState = 'idle' | 'downloading' | 'loading' | 'ready' | 'error';

interface ModelLoaderResult {
  state: LoaderState;
  progress: number;
  error: string | null;
  ensure: () => Promise<boolean>;
}

/** True when the C++ lifecycle reports a loaded model for `category`. */
function isCategoryLoaded(category: ModelCategory): boolean {
  try {
    return Boolean(
      RunAnywhere.currentModel({ category, includeModelMetadata: false })?.found,
    );
  } catch {
    return false;
  }
}

/** First catalog-registered model for `category`, or `null` if none. */
function findModelForCategory(category: ModelCategory): ModelInfo | null {
  const models = RunAnywhere.listModels()?.models ?? [];
  return models.find((model) => model.category === category) ?? null;
}

/**
 * Hook to download + load a model for a given category.
 * Tracks download progress and loading state. A category has one native
 * "current" model — loading a new model in the same category replaces the
 * previous one, while different categories (LLM/STT/TTS/VAD) coexist.
 *
 * @param category - Which model category to ensure is loaded.
 */
export function useModelLoader(category: ModelCategory): ModelLoaderResult {
  const [state, setState] = useState<LoaderState>(() =>
    isCategoryLoaded(category) ? 'ready' : 'idle',
  );
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const ensure = useCallback(async (): Promise<boolean> => {
    // Already loaded
    if (isCategoryLoaded(category)) {
      setState('ready');
      return true;
    }

    if (loadingRef.current) return false;
    loadingRef.current = true;

    try {
      const model = findModelForCategory(category);
      if (!model) {
        setError(`No ${category} model registered`);
        setState('error');
        return false;
      }

      // Download if needed
      if (!modelInfoIsAvailableForUse(model)) {
        setState('downloading');
        setProgress(0);

        await RunAnywhere.downloadModel({
          modelId: model.id,
          model,
          onProgress: (next) => {
            setProgress(Math.max(0, Math.min(1, next.overallProgress)));
          },
        });
        setProgress(1);
      }

      // Load
      setState('loading');
      const result = await RunAnywhere.loadModel({
        modelId: model.id,
        forceReload: false,
        validateAvailability: true,
      });
      if (result?.success) {
        setState('ready');
        return true;
      }

      setError(result?.errorMessage || 'Failed to load model');
      setState('error');
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
      return false;
    } finally {
      loadingRef.current = false;
    }
  }, [category]);

  return { state, progress, error, ensure };
}
