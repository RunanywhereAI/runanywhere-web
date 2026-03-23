import { useState } from 'react';
import type { DevAction } from '../../types';

interface DevToolbarProps {
  onAction: (action: DevAction, errorMessage?: string) => void;
  disabled: boolean;
}

export function DevToolbar({ onAction, disabled }: DevToolbarProps) {
  const [showDebugInput, setShowDebugInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleDebug = () => {
    if (showDebugInput) {
      onAction('debug', errorMessage);
      setShowDebugInput(false);
      setErrorMessage('');
    } else {
      setShowDebugInput(true);
    }
  };

  return (
    <div className="dev-toolbar">
      <button
        className="toolbar-btn btn-explain"
        onClick={() => onAction('explain')}
        disabled={disabled}
        title="Explain code (Ctrl+Enter)"
      >
        💡 Explain
      </button>
      <button
        className="toolbar-btn btn-docstring"
        onClick={() => onAction('docstring')}
        disabled={disabled}
        title="Generate docstring"
      >
        📝 Docstring
      </button>
      <button
        className={`toolbar-btn btn-debug ${showDebugInput ? 'active' : ''}`}
        onClick={handleDebug}
        disabled={disabled}
        title="Debug code"
      >
        🐛 Debug
      </button>
      <button
        className="toolbar-btn btn-refactor"
        onClick={() => onAction('refactor')}
        disabled={disabled}
        title="Suggest refactoring"
      >
        🔧 Refactor
      </button>
      {showDebugInput && (
        <div className="debug-input-row">
          <input
            className="debug-input"
            type="text"
            placeholder="Paste error message here…"
            value={errorMessage}
            onChange={(e) => setErrorMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleDebug();
              if (e.key === 'Escape') setShowDebugInput(false);
            }}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
