import { useState, useCallback, useEffect } from 'react';
import { AppShell } from './components/Layout/AppShell';
import { ModelLoader } from './components/Shared/ModelLoader';
import { OutputPanel } from './components/Shared/OutputPanel';
import { CodeEditor } from './components/DevMode/CodeEditor';
import { DevToolbar } from './components/DevMode/DevToolbar';
import { PDFDropZone } from './components/ResearchMode/PDFDropZone';
import { PDFList } from './components/ResearchMode/PDFList';
import { ResearchToolbar } from './components/ResearchMode/ResearchToolbar';
import { useLLM } from './hooks/useLLM';
import { useDocuments } from './hooks/useIndexedDB';
import { detectLanguage, explainCode, generateDocstring, debugCode, suggestRefactor, answerQuestion, generateOutlinePrompt, formatCitationsPrompt } from './lib/llm/prompts';
import { findRelevantChunks, buildContextFromChunks, estimateTokenCount } from './lib/pdf/chunker';
import { parseOutline, parseCitations, formatAllCitations, toBibTeX } from './lib/llm/structured';
import type { AppMode, DevAction, ResearchAction, GenerationMetrics, CitationStyle } from './types';

const SAMPLE_CODE = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Find the 10th Fibonacci number
console.log(fibonacci(10));`;

export function App() {
  const [mode, setMode] = useState<AppMode>('dev');
  const [code, setCode] = useState(SAMPLE_CODE);
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [metrics, setMetrics] = useState<GenerationMetrics | null>(null);
  const [detectedLang, setDetectedLang] = useState('javascript');
  const [tokenCount, setTokenCount] = useState(0);

  const llm = useLLM();
  const docs = useDocuments();

  // Detect language when code changes
  useEffect(() => {
    if (code) {
      setDetectedLang(detectLanguage(code));
    }
  }, [code]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        if (mode === 'dev') handleDevAction('explain');
      }
      if (isMod && e.key === 'k') {
        e.preventDefault();
        // Focus Q&A — handled by ResearchToolbar
      }
      if (isMod && e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        setMode(m => m === 'dev' ? 'research' : 'dev');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, code]);

  // ── Dev Mode actions ──
  const handleDevAction = useCallback(async (action: DevAction, errorMessage?: string) => {
    if (llm.status !== 'ready' || !code.trim()) return;

    const lang = detectedLang;
    let prompt: string;

    switch (action) {
      case 'explain':
        prompt = explainCode(code, lang);
        break;
      case 'docstring':
        prompt = generateDocstring(code, lang);
        break;
      case 'debug':
        prompt = debugCode(code, errorMessage || 'Unknown error', lang);
        break;
      case 'refactor':
        prompt = suggestRefactor(code, lang);
        break;
    }

    setOutput('');
    setMetrics(null);
    setIsStreaming(true);

    try {
      const result = await llm.streamGenerate(
        prompt,
        (fullText) => setOutput(fullText),
        { maxTokens: 512, temperature: 0.3 }
      );
      setMetrics(result.metrics);
      setTokenCount(result.metrics.tokensUsed);
    } catch (err) {
      setOutput(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsStreaming(false);
    }
  }, [llm, code, detectedLang]);

  // ── Research Mode actions ──
  const handleResearchAction = useCallback(async (
    action: ResearchAction,
    input: string,
    style?: CitationStyle
  ) => {
    if (llm.status !== 'ready') return;

    const allChunks = docs.getAllChunks();
    if (allChunks.length === 0) return;

    setOutput('');
    setMetrics(null);
    setIsStreaming(true);

    try {
      let prompt: string;

      switch (action) {
        case 'qa': {
          const relevant = findRelevantChunks(allChunks, input, 5);
          const context = buildContextFromChunks(relevant.length > 0 ? relevant : allChunks.slice(0, 5));
          prompt = answerQuestion(input, context);
          break;
        }
        case 'outline': {
          const context = buildContextFromChunks(allChunks.slice(0, 8));
          prompt = generateOutlinePrompt(input, context);
          break;
        }
        case 'citations': {
          const context = buildContextFromChunks(allChunks.slice(0, 6));
          prompt = formatCitationsPrompt(context);
          break;
        }
      }

      const result = await llm.streamGenerate(
        prompt,
        (fullText) => setOutput(fullText),
        { maxTokens: 768, temperature: 0.2 }
      );

      setMetrics(result.metrics);
      setTokenCount(result.metrics.tokensUsed);

      // Post-process structured output
      if (action === 'outline') {
        const outline = parseOutline(result.text);
        if (outline) {
          const formatted = `# ${outline.title}\n\n` +
            outline.chapters.map(ch =>
              `## Chapter ${ch.number}: ${ch.title}\n${ch.summary}\n*Sources: ${ch.sources.join(', ')}*`
            ).join('\n\n');
          setOutput(formatted);
        }
      }

      if (action === 'citations') {
        const parsed = parseCitations(result.text);
        if (parsed) {
          const formatted = formatAllCitations(parsed.citations, style || 'APA');
          const bibtex = toBibTeX(parsed.citations);
          setOutput(`## Citations (${style || 'APA'})\n\n${formatted}\n\n---\n\n## BibTeX\n\n\`\`\`bibtex\n${bibtex}\n\`\`\``);
        }
      }
    } catch (err) {
      setOutput(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsStreaming(false);
    }
  }, [llm, docs]);

  // ── PDF handling ──
  const handlePDFDrop = useCallback(async (files: File[]) => {
    for (const file of files) {
      await docs.addPDF(file);
    }
    const totalTokens = estimateTokenCount(docs.getAllChunks());
    if (totalTokens > 4000) {
      console.warn(`Total context: ~${totalTokens} tokens. May exceed model context window.`);
    }
  }, [docs]);

  // ── Model not loaded yet ──
  if (llm.status === 'downloading' || llm.status === 'loading' || llm.status === 'idle') {
    return <ModelLoader progress={llm.progress} message={llm.statusMessage} />;
  }

  // ── Dev Mode Left Panel ──
  const devLeftPanel = (
    <div className="dev-left">
      <DevToolbar onAction={handleDevAction} disabled={isStreaming || llm.status !== 'ready'} />
      <CodeEditor code={code} onChange={setCode} language={detectedLang} />
    </div>
  );

  // ── Research Mode Left Panel ──
  const researchLeftPanel = (
    <div className="research-left">
      <PDFDropZone onFilesDropped={handlePDFDrop} loading={docs.loading} />
      <PDFList documents={docs.documents} onRemove={docs.removePDF} />
      <ResearchToolbar
        onAction={handleResearchAction}
        disabled={isStreaming || llm.status !== 'ready'}
        hasDocuments={docs.documents.length > 0}
      />
    </div>
  );

  // ── Right Panel (shared) ──
  const rightPanel = (
    <OutputPanel
      content={output}
      isStreaming={isStreaming}
      metrics={metrics}
      title={mode === 'dev' ? 'AI Analysis' : 'Research Output'}
      emptyMessage={
        mode === 'dev'
          ? 'Paste your code on the left and select an action.\n\n💡 Explain — understand what code does\n📝 Docstring — generate documentation\n🐛 Debug — find and fix errors\n🔧 Refactor — improve code quality\n\nKeyboard: Ctrl+Enter to run'
          : 'Load PDFs on the left, then use the Research tools.\n\n💬 Q&A — ask questions about your documents\n📋 Outline — generate thesis chapter structure\n📚 Citations — extract and format references\n\nAll processing is 100% local.'
      }
    />
  );

  return (
    <AppShell
      mode={mode}
      onModeChange={setMode}
      llmStatus={llm.status}
      statusMessage={llm.statusMessage}
      acceleration={llm.acceleration}
      tokenCount={tokenCount}
      detectedLanguage={mode === 'dev' ? detectedLang : undefined}
      leftPanel={mode === 'dev' ? devLeftPanel : researchLeftPanel}
      rightPanel={rightPanel}
    />
  );
}
