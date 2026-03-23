import type { AppMode, LLMStatus } from '../../types';

interface StatusBarProps {
  status: LLMStatus;
  message: string;
  mode: AppMode;
  tokenCount?: number;
  detectedLanguage?: string;
}

export function StatusBar({ status, message, mode, tokenCount, detectedLanguage }: StatusBarProps) {
  const statusColor = status === 'ready' ? 'status-green' : status === 'generating' ? 'status-cyan' : 'status-dim';
  return (
    <footer className="status-bar">
      <div className="status-left">
        <span className={`status-dot ${statusColor}`} />
        <span className="status-text">{message}</span>
      </div>
      <div className="status-center">
        {detectedLanguage && (
          <span className="status-item">📝 {detectedLanguage}</span>
        )}
      </div>
      <div className="status-right">
        <span className="status-item">{mode === 'dev' ? '</> Dev' : '📄 Research'}</span>
        {tokenCount !== undefined && tokenCount > 0 && (
          <span className="status-item">🔤 {tokenCount} tokens</span>
        )}
        <span className="status-item">LFM2-350M</span>
      </div>
    </footer>
  );
}
