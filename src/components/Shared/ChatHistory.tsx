import type { ChatSession } from '../../types';

interface ChatHistoryProps {
  sessions: ChatSession[];
  onSelect: (session: ChatSession) => void;
  onDelete: (id: string) => void;
}

export function ChatHistory({ sessions, onSelect, onDelete }: ChatHistoryProps) {
  if (sessions.length === 0) {
    return (
      <div className="chat-history-empty">
        No previous sessions
      </div>
    );
  }

  return (
    <div className="chat-history">
      <h3 className="chat-history-title">History</h3>
      <div className="chat-history-list">
        {sessions.slice(0, 20).map((s) => (
          <div key={s.id} className="chat-history-item" onClick={() => onSelect(s)}>
            <div className="history-item-header">
              <span className="history-mode">{s.mode === 'dev' ? '</>' : '📄'}</span>
              <span className="history-title">{s.title}</span>
              <button
                className="history-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
              >
                ✕
              </button>
            </div>
            <span className="history-date">
              {new Date(s.updatedAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
