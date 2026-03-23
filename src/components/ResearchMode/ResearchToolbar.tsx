import { useState } from 'react';
import type { ResearchAction, CitationStyle } from '../../types';

interface ResearchToolbarProps {
  onAction: (action: ResearchAction, input: string, style?: CitationStyle) => void;
  disabled: boolean;
  hasDocuments: boolean;
}

export function ResearchToolbar({ onAction, disabled, hasDocuments }: ResearchToolbarProps) {
  const [question, setQuestion] = useState('');
  const [topic, setTopic] = useState('');
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA');
  const [activeInput, setActiveInput] = useState<ResearchAction | null>(null);

  const isDisabled = disabled || !hasDocuments;

  return (
    <div className="research-toolbar">
      <div className="research-buttons">
        <button
          className={`toolbar-btn ${activeInput === 'qa' ? 'active' : ''}`}
          onClick={() => setActiveInput(activeInput === 'qa' ? null : 'qa')}
          disabled={isDisabled}
          title="Ask a question (Ctrl+K)"
        >
          💬 Q&A
        </button>
        <button
          className={`toolbar-btn ${activeInput === 'outline' ? 'active' : ''}`}
          onClick={() => setActiveInput(activeInput === 'outline' ? null : 'outline')}
          disabled={isDisabled}
        >
          📋 Outline
        </button>
        <button
          className="toolbar-btn"
          onClick={() => onAction('citations', '', citationStyle)}
          disabled={isDisabled}
        >
          📚 Citations
        </button>
        <select
          className="citation-style-select"
          value={citationStyle}
          onChange={(e) => setCitationStyle(e.target.value as CitationStyle)}
        >
          <option value="APA">APA</option>
          <option value="MLA">MLA</option>
          <option value="IEEE">IEEE</option>
        </select>
      </div>

      {activeInput === 'qa' && (
        <div className="research-input-row">
          <input
            className="research-input"
            type="text"
            placeholder="Ask a question about your documents…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && question.trim()) {
                onAction('qa', question);
                setQuestion('');
              }
            }}
            autoFocus
          />
          <button
            className="send-btn"
            onClick={() => {
              if (question.trim()) {
                onAction('qa', question);
                setQuestion('');
              }
            }}
            disabled={!question.trim()}
          >
            ➤
          </button>
        </div>
      )}

      {activeInput === 'outline' && (
        <div className="research-input-row">
          <input
            className="research-input"
            type="text"
            placeholder="Describe your thesis topic…"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && topic.trim()) {
                onAction('outline', topic);
                setTopic('');
              }
            }}
            autoFocus
          />
          <button
            className="send-btn"
            onClick={() => {
              if (topic.trim()) {
                onAction('outline', topic);
                setTopic('');
              }
            }}
            disabled={!topic.trim()}
          >
            ➤
          </button>
        </div>
      )}

      {!hasDocuments && (
        <p className="toolbar-hint">Load PDFs above to enable Research AI features</p>
      )}
    </div>
  );
}
