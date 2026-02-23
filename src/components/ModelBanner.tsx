import type { LoaderState } from "../hooks/useModelLoader";

interface Props {
  state: LoaderState;
  progress: number;
  error: string | null;
  onLoad: () => Promise<boolean> | void;
  label: string;
}

export function ModelBanner({ state, progress, error, onLoad, label }: Props) {
  if (state === "ready") return null;

  const busy = state === "downloading" || state === "loading";

  return (
    <div className="model-banner" role="status" aria-live="polite">
      {state === "idle" && (
        <>
          <span>No {label} model loaded.</span>
          <button className="btn btn-sm" onClick={() => void onLoad()} disabled={busy}>
            Download &amp; Load
          </button>
        </>
      )}

      {state === "downloading" && (
        <>
          <span>
            Downloading {label} model… {(progress * 100).toFixed(0)}%
          </span>
          <div className="progress-bar" aria-label="Download progress">
            <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </>
      )}

      {state === "loading" && <span>Loading {label} model into engine…</span>}

      {state === "error" && (
        <>
          <span className="error-text">Error: {error || "Unknown error"}</span>
          <button className="btn btn-sm" onClick={() => void onLoad()} disabled={busy}>
            Retry
          </button>
        </>
      )}
    </div>
  );
}