import { useRef, useEffect } from 'react';
import type { GenerationMetrics } from '../../types';

interface OutputPanelProps {
  content: string;
  isStreaming: boolean;
  metrics?: GenerationMetrics | null;
  emptyMessage?: string;
  title?: string;
}

export function OutputPanel({ content, isStreaming, metrics, emptyMessage, title }: OutputPanelProps) {
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="output-panel">
      <div className="output-header">
        <span className="output-title">{title || 'Output'}</span>
        {content && (
          <div className="output-actions">
            <button className="output-btn" onClick={handleCopy} title="Copy to clipboard">
              📋 Copy
            </button>
            <button className="output-btn" onClick={handleDownload} title="Download as .md">
              ⬇ Download
            </button>
          </div>
        )}
      </div>
      <div className="output-body" ref={outputRef}>
        {content ? (
          <pre className="output-text">
            {content}
            {isStreaming && <span className="cursor-blink">▌</span>}
          </pre>
        ) : (
          <div className="output-empty">
            {emptyMessage || 'AI output will appear here. Select an action to begin.'}
          </div>
        )}
      </div>
      {metrics && (
        <div className="output-metrics">
          <span>{metrics.tokensPerSecond.toFixed(1)} tok/s</span>
          <span>{metrics.latencyMs}ms</span>
          <span>{metrics.tokensUsed} tokens</span>
        </div>
      )}
    </div>
  );
}
