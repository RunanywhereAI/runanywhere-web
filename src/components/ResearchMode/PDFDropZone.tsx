import { useCallback, useRef, useState } from 'react';

interface PDFDropZoneProps {
  onFilesDropped: (files: File[]) => void;
  loading: boolean;
}

export function PDFDropZone({ onFilesDropped, loading }: PDFDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === 'application/pdf'
      );
      if (files.length > 0) onFilesDropped(files);
    },
    [onFilesDropped]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) onFilesDropped(files);
    },
    [onFilesDropped]
  );

  return (
    <div
      className={`pdf-dropzone ${isDragOver ? 'drag-over' : ''} ${loading ? 'loading' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        multiple
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />
      <div className="dropzone-content">
        {loading ? (
          <>
            <span className="dropzone-icon spinning">⏳</span>
            <p className="dropzone-text">Parsing PDF…</p>
          </>
        ) : (
          <>
            <span className="dropzone-icon">📄</span>
            <p className="dropzone-text">Drop PDFs here or click to browse</p>
            <p className="dropzone-hint">Files are processed 100% locally</p>
          </>
        )}
      </div>
    </div>
  );
}
