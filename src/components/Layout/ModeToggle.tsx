import type { AppMode } from '../../types';

interface ModeToggleProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="mode-toggle">
      <button
        className={`mode-btn ${mode === 'dev' ? 'active' : ''}`}
        onClick={() => onModeChange('dev')}
      >
        <span className="mode-icon">{'</>'}</span>
        Dev
      </button>
      <button
        className={`mode-btn ${mode === 'research' ? 'active' : ''}`}
        onClick={() => onModeChange('research')}
      >
        <span className="mode-icon">📄</span>
        Research
      </button>
      <div
        className="mode-pill"
        style={{ transform: mode === 'research' ? 'translateX(100%)' : 'translateX(0)' }}
      />
    </div>
  );
}
