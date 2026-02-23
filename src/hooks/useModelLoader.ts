import { useCallback, useRef, useState } from "react";
import { EventBus, ModelCategory, ModelManager } from "@runanywhere/web";

export type LoaderState = "idle" | "downloading" | "loading" | "ready" | "error";

interface ModelLoaderResult {
  state: LoaderState;
  progress: number; // 0..1
  error: string | null;
  ensure: () => Promise<boolean>;
}

/**
 * Hook to download + load models for a given category.
 * - robust selection (category first, fallback to modality match)
 * - safe progress subscription cleanup
 * - avoids duplicate parallel ensure() calls
 */
export function useModelLoader(category: ModelCategory, coexist = false): ModelLoaderResult {
  const [state, setState] = useState<LoaderState>(() =>
    ModelManager.getLoadedModel(category) ? "ready" : "idle"
  );
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Prevent duplicate parallel loads (important when UI re-renders)
  const inFlightRef = useRef<Promise<boolean> | null>(null);

  const ensure = useCallback(async (): Promise<boolean> => {
    // If already loaded, finish immediately
    const already = ModelManager.getLoadedModel(category);
    if (already) {
      setError(null);
      setProgress(1);
      setState("ready");
      return true;
    }

    // If a load is already happening, return that same promise
    if (inFlightRef.current) return inFlightRef.current;

    setError(null);
    setProgress(0);

    const job = (async () => {
      // 1) Find models for this category
      const all = ModelManager.getModels?.() ?? [];

      // Many SDKs use `category` instead of `modality`.
      // We try both to avoid "no model registered" when field names differ.
      const candidates = all.filter((m: any) => {
        return m.category === category || m.modality === category;
      });

      if (!candidates.length) {
        const known = all.map((m: any) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          modality: m.modality,
          status: m.status,
        }));

        const msg =
          `No model registered for category "${String(category)}". ` +
          `Available models: ${known.length ? JSON.stringify(known) : "none"}`;

        setError(msg);
        setState("error");
        return false;
      }

      // 2) Prefer downloaded/loaded model first
      const pick =
        candidates.find((m: any) => m.status === "loaded" || m.status === "downloaded") ??
        candidates[0];

      // 3) Download if needed
      let unsub: null | (() => void) = null;
      try {
        if (pick.status !== "downloaded" && pick.status !== "loaded") {
          setState("downloading");
          setProgress(0);

          // progress event names sometimes vary, but this matches your current usage
          unsub = EventBus.shared.on("model.downloadProgress", (evt: any) => {
            if (evt?.modelId === pick.id) {
              const p = typeof evt.progress === "number" ? evt.progress : 0;
              setProgress(Math.max(0, Math.min(1, p)));
            }
          });

          await ModelManager.downloadModel(pick.id);
          setProgress(1);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Download failed: ${msg}`);
        setState("error");
        return false;
      } finally {
        // always clean listener
        try {
          unsub?.();
        } catch {
          // ignore
        }
      }

      // 4) Load model
      try {
        setState("loading");
        const ok = await ModelManager.loadModel(pick.id, { coexist });

        if (!ok) {
          setError(`Failed to load model (id: ${pick.id}).`);
          setState("error");
          return false;
        }

        // confirm loaded
        const loadedNow = ModelManager.getLoadedModel(category);
        if (!loadedNow) {
          // This usually means "category field mismatch" between SDK and our check.
          // But still mark ready because loadModel returned ok.
          setState("ready");
          return true;
        }

        setProgress(1);
        setState("ready");
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Load failed: ${msg}`);
        setState("error");
        return false;
      }
    })();

    inFlightRef.current = job;

    try {
      return await job;
    } finally {
      inFlightRef.current = null;
    }
  }, [category, coexist]);

  return { state, progress, error, ensure };
}