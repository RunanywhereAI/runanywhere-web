import { useCallback, useState } from 'react';
import {
  ModelCategory,
  RunAnywhere,
  modelInfoIsAvailableForUse,
  ragQueryOptionsWithQuestion,
  type ModelInfo,
  type RAGSearchResult,
} from '@runanywhere/web';

const TOP_K = 3;

interface Answer {
  text: string;
  sources: RAGSearchResult[];
}

/** First registered model for a category, or null. */
function firstModel(category: ModelCategory): ModelInfo | null {
  const models = RunAnywhere.listModels()?.models ?? [];
  return models.find((m) => m.category === category) ?? null;
}

/**
 * Documents (RAG) tab. Mirrors the reference example's Documents view using the
 * public flat verbs: `ragCreatePipeline(embeddingId, llmId)`, `ragIngest`,
 * `ragQuery`, and the RAG statistics helpers. The pipeline pairs the catalog's
 * embedding model with its LLM; documents are session-only (not persisted).
 */
export function DocumentsTab() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [docCount, setDocCount] = useState(0);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<Answer | null>(null);

  const ensureDownloaded = useCallback(async (model: ModelInfo, label: string) => {
    if (modelInfoIsAvailableForUse(model)) return;
    setStatus(`Downloading ${label} model...`);
    await RunAnywhere.downloadModel({
      modelId: model.id,
      model,
      onProgress: (p) => {
        const pct = p.totalBytes > 0
          ? Math.round((Number(p.bytesDownloaded) / Number(p.totalBytes)) * 100)
          : Math.round((p.overallProgress ?? 0) * 100);
        setStatus(`Downloading ${label} model... ${pct}%`);
      },
    });
  }, []);

  const prepare = useCallback(async (): Promise<boolean> => {
    const embedding = firstModel(ModelCategory.MODEL_CATEGORY_EMBEDDING);
    const llm = firstModel(ModelCategory.MODEL_CATEGORY_LANGUAGE);
    if (!embedding || !llm) {
      setStatus('An embedding model and an LLM model must be registered.');
      return false;
    }
    setBusy(true);
    try {
      await ensureDownloaded(embedding, 'embedding');
      await ensureDownloaded(llm, 'LLM');
      setStatus('Creating RAG pipeline...');
      await RunAnywhere.ragCreatePipeline(embedding.id, llm.id);
      setReady(true);
      setStatus(`Pipeline ready (${embedding.name} + ${llm.name}).`);
      return true;
    } catch (err) {
      setStatus(`RAG init failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    } finally {
      setBusy(false);
    }
  }, [ensureDownloaded]);

  const ensureReady = useCallback(async (): Promise<boolean> => {
    if (ready) return true;
    return prepare();
  }, [ready, prepare]);

  const ingest = useCallback(async (files: FileList) => {
    if (!(await ensureReady())) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        setStatus(`Indexing ${file.name}...`);
        const text = await file.text();
        await RunAnywhere.ragIngest(
          text,
          JSON.stringify({
            docName: file.name,
            sourceUri: `web-file:${file.name}`,
            mediaType: file.type || 'text/plain',
          }),
        );
      }
      const stats = await RunAnywhere.ragGetStatistics();
      setDocCount(stats.indexedDocuments);
      setStatus(`Indexed. ${stats.indexedChunks} chunks across ${stats.indexedDocuments} document(s).`);
    } catch (err) {
      setStatus(`Indexing failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [ensureReady]);

  const clearDocs = useCallback(async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await RunAnywhere.ragClearDocuments();
      setDocCount(0);
      setAnswer(null);
      setStatus('All documents cleared.');
    } catch (err) {
      setStatus(`Clear failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [ready]);

  const ask = useCallback(async () => {
    const q = question.trim();
    if (!q || busy) return;
    if (!(await ensureReady())) return;

    const count = await RunAnywhere.ragGetDocumentCount();
    if (count === 0) {
      setStatus('Upload a document first.');
      return;
    }

    setBusy(true);
    setAnswer(null);
    setStatus('Searching...');
    try {
      const result = await RunAnywhere.ragQuery({
        ...ragQueryOptionsWithQuestion(q),
        retrievalTopK: TOP_K,
        maxTokens: 512,
        temperature: 0.4,
      });
      if (result.errorCode !== 0) {
        setStatus(`Failed: ${result.errorMessage ?? 'RAG query failed'}`);
        return;
      }
      setAnswer({ text: result.answer, sources: result.retrievedChunks });
      setStatus('');
    } catch (err) {
      setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [question, busy, ensureReady]);

  return (
    <div className="tab-panel scroll-panel">
      <div className="section">
        <h3>RAG pipeline</h3>
        <p className="text-muted">
          Pairs the catalog embedding model with its LLM. Documents are session-only and are not restored after reload.
        </p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={prepare} disabled={busy || ready}>
            {ready ? 'Pipeline ready' : 'Prepare pipeline'}
          </button>
        </div>
        {status && <div className="text-muted status-line">{status}</div>}
      </div>

      <div className="section">
        <h3>Documents ({docCount})</h3>
        <p className="text-muted">Upload <code>.txt</code>, <code>.md</code>, or <code>.json</code> files to index.</p>
        <input
          type="file"
          accept=".txt,.md,.json"
          multiple
          disabled={busy}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) void ingest(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="btn-row">
          <button className="btn" onClick={clearDocs} disabled={busy || !ready}>Clear all</button>
        </div>
      </div>

      <div className="section">
        <h3>Ask a question</h3>
        <textarea
          className="text-area"
          rows={2}
          placeholder="Ask something about your uploaded docs..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={busy}
        />
        <div className="btn-row">
          <button className="btn btn-primary" onClick={ask} disabled={busy || !question.trim()}>Ask</button>
        </div>
      </div>

      {answer && (
        <div className="section">
          <h3>Answer</h3>
          <div className="rag-answer">{answer.text}</div>
          {answer.sources.map((source, i) => (
            <div className="rag-source" key={i}>
              <strong>Source {i + 1}: {source.sourceDocument || 'Document'}</strong>
              <pre className="output-pre">
                {source.text.slice(0, 400)}{source.text.length > 400 ? '...' : ''}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
