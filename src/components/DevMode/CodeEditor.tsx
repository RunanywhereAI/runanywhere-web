import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  language?: string;
}

export function CodeEditor({ code, onChange, language }: CodeEditorProps) {
  return (
    <div className="code-editor-container">
      <Editor
        height="100%"
        defaultLanguage={language || 'javascript'}
        language={language || 'javascript'}
        theme="vs-dark"
        value={code}
        onChange={(v) => onChange(v ?? '')}
        options={{
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          minimap: { enabled: true },
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          padding: { top: 16 },
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          renderLineHighlight: 'all',
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
        }}
      />
    </div>
  );
}
