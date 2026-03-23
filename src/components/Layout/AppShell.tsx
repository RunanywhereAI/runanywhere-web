import { useState, useEffect, type ReactNode } from 'react';
import { ModeToggle } from './ModeToggle';
import { StatusBar } from './StatusBar';
import type { AppMode, LLMStatus } from '../../types';

interface AppShellProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  llmStatus: LLMStatus;
  statusMessage: string;
  acceleration: string;
  tokenCount?: number;
  detectedLanguage?: string;
  leftPanel: ReactNode;
  rightPanel: ReactNode;
}

export function AppShell({
  mode,
  onModeChange,
  llmStatus,
  statusMessage,
  acceleration,
  tokenCount,
  detectedLanguage,
  leftPanel,
  rightPanel,
}: AppShellProps) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="app-shell">
      {isOffline && (
        <div className="offline-banner">
          <span className="offline-dot" />
          Offline mode — all AI features still work
        </div>
      )}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">
            <span className="title-icon">⌘</span>
            PrivateIDE
          </h1>
          <span className="header-badge">local AI</span>
        </div>
        <ModeToggle mode={mode} onModeChange={onModeChange} />
        <div className="header-right">
          <span className="accel-badge">{acceleration === 'webgpu' ? '⚡ WebGPU' : '🖥 CPU'}</span>
        </div>
      </header>
      <main className="main-panels">
        <div className="panel panel-left">{leftPanel}</div>
        <div className="panel-divider" />
        <div className="panel panel-right">{rightPanel}</div>
      </main>
      <StatusBar
        status={llmStatus}
        message={statusMessage}
        mode={mode}
        tokenCount={tokenCount}
        detectedLanguage={detectedLanguage}
      />
    </div>
  );
}
