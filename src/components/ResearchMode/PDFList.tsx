import type { StoredDocument } from '../../types';

interface PDFListProps {
  documents: StoredDocument[];
  onRemove: (filename: string) => void;
}

export function PDFList({ documents, onRemove }: PDFListProps) {
  if (documents.length === 0) return null;

  return (
    <div className="pdf-list">
      <h3 className="pdf-list-title">
        Loaded Documents ({documents.length})
      </h3>
      <div className="pdf-list-items">
        {documents.map((doc) => (
          <div key={doc.filename} className="pdf-list-item">
            <span className="pdf-item-icon">📄</span>
            <div className="pdf-item-info">
              <span className="pdf-item-name">{doc.filename}</span>
              <span className="pdf-item-meta">
                {doc.totalPages} pages · {doc.chunks.length} chunks
              </span>
            </div>
            <button
              className="pdf-item-remove"
              onClick={() => onRemove(doc.filename)}
              title="Remove document"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
