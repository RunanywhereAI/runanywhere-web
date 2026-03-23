interface ModelLoaderProps {
  progress: number; // 0–1
  message: string;
}

export function ModelLoader({ progress, message }: ModelLoaderProps) {
  const pct = Math.round(progress * 100);
  return (
    <div className="model-loader-overlay">
      <div className="model-loader-card">
        <div className="loader-icon">⌘</div>
        <h2 className="loader-title">PrivateIDE</h2>
        <p className="loader-subtitle">
          Downloading AI model (350 MB) — this happens once.
          <br />
          Everything runs locally after this.
        </p>
        <div className="loader-progress-track">
          <div
            className="loader-progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="loader-pct">{pct}%</span>
        <p className="loader-message">{message}</p>
      </div>
    </div>
  );
}
