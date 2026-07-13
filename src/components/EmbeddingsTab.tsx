import { useCallback, useState } from 'react';
import {
  ModelCategory,
  RunAnywhere,
  embeddingCosineSimilarity,
  type EmbeddingVector,
} from '@runanywhere/web';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';

/** First registered embedding model id, or null. */
function embeddingModelId(): string | null {
  const models = RunAnywhere.listModels()?.models ?? [];
  return models.find((m) => m.category === ModelCategory.MODEL_CATEGORY_EMBEDDING)?.id ?? null;
}

interface Report {
  dimension: number;
  similarity: number;
  processingMs: number;
}

/**
 * Embeddings tab. Uses the public `RunAnywhere.embeddings.embed(text, modelId)`
 * facade to produce a vector per input, then compares them with the public
 * `embeddingCosineSimilarity(a, b)` helper.
 */
export function EmbeddingsTab() {
  const loader = useModelLoader(ModelCategory.MODEL_CATEGORY_EMBEDDING);
  const [textA, setTextA] = useState('The cat sat on the warm windowsill.');
  const [textB, setTextB] = useState('A feline rested by the sunny window.');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const compute = useCallback(async () => {
    const a = textA.trim();
    const b = textB.trim();
    if (!a || !b) return;

    if (loader.state !== 'ready') {
      const ok = await loader.ensure();
      if (!ok) return;
    }
    const modelId = embeddingModelId();
    if (!modelId) {
      setError('No embedding model registered.');
      return;
    }

    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const t0 = performance.now();
      const [resultA, resultB] = await Promise.all([
        RunAnywhere.embeddings.embed(a, modelId),
        RunAnywhere.embeddings.embed(b, modelId),
      ]);
      const processingMs = performance.now() - t0;

      const vecA: EmbeddingVector | undefined = resultA.vectors[0];
      const vecB: EmbeddingVector | undefined = resultB.vectors[0];
      if (!vecA || !vecB) {
        setError('Embedding produced no vectors.');
        return;
      }

      setReport({
        dimension: vecA.values.length,
        similarity: embeddingCosineSimilarity(vecA, vecB),
        processingMs,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [textA, textB, loader]);

  return (
    <div className="tab-panel scroll-panel">
      <ModelBanner
        state={loader.state}
        progress={loader.progress}
        error={loader.error}
        onLoad={loader.ensure}
        label="Embeddings"
      />

      <div className="section">
        <h3>Semantic similarity</h3>
        <p className="text-muted">
          Embed two sentences on-device and compare them with cosine similarity (1.0 = identical meaning).
        </p>
        <label className="field-label">Text A</label>
        <textarea className="text-area" rows={2} value={textA} onChange={(e) => setTextA(e.target.value)} disabled={busy} />
        <label className="field-label">Text B</label>
        <textarea className="text-area" rows={2} value={textB} onChange={(e) => setTextB(e.target.value)} disabled={busy} />
        <div className="btn-row">
          <button className="btn btn-primary" onClick={compute} disabled={busy || !textA.trim() || !textB.trim()}>
            {busy ? 'Embedding...' : 'Compute similarity'}
          </button>
        </div>
        {error && <div className="error-text status-line">{error}</div>}
      </div>

      {report && (
        <div className="section">
          <h3>Result</h3>
          <div className="similarity-value">{report.similarity.toFixed(3)}</div>
          <ul className="stat-list">
            <li>Vector dimension: <code>{report.dimension}</code></li>
            <li>Cosine similarity: <code>{report.similarity.toFixed(4)}</code></li>
            <li>Processing: <code>{report.processingMs.toFixed(0)} ms</code></li>
          </ul>
        </div>
      )}
    </div>
  );
}
