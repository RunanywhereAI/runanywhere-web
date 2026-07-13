import { useCallback, useState } from 'react';
import {
  ModelCategory,
  RunAnywhere,
  structuredOutputResultSuccess,
  type StructuredOutputResult,
} from '@runanywhere/web';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';

const DEFAULT_PROMPT =
  'Ada Lovelace was a 19th-century English mathematician, born in 1815, ' +
  'widely regarded as the first computer programmer.';

const DEFAULT_SCHEMA = `{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "birth_year": { "type": "number" },
    "nationality": { "type": "string" },
    "known_for": { "type": "string" }
  },
  "required": ["name", "birth_year"]
}`;

function prettyParsed(result: StructuredOutputResult): string {
  const extracted = result.validation?.extractedJson;
  const raw = extracted && extracted.length > 0
    ? extracted
    : new TextDecoder().decode(result.parsedJson);
  if (!raw) return result.rawText ?? '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/**
 * Structured-output tab. Uses the public flat verb
 * `RunAnywhere.generateStructured(prompt, schema, options)` to drive the LLM to
 * schema-constrained JSON, and `structuredOutputResultSuccess(result)` to report
 * whether the output validated against the schema.
 */
export function StructuredOutputTab() {
  const loader = useModelLoader(ModelCategory.MODEL_CATEGORY_LANGUAGE);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [schema, setSchema] = useState(DEFAULT_SCHEMA);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StructuredOutputResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    const text = prompt.trim();
    if (!text) return;

    // Validate the schema is parseable before dispatching.
    try {
      JSON.parse(schema);
    } catch {
      setError('Schema is not valid JSON.');
      return;
    }

    if (loader.state !== 'ready') {
      const ok = await loader.ensure();
      if (!ok) return;
    }

    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const output = await RunAnywhere.generateStructured(
        text,
        { jsonSchema: schema },
        { maxTokens: 256, temperature: 0.2 },
      );
      setResult(output);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [prompt, schema, loader]);

  const valid = result ? structuredOutputResultSuccess(result) : false;

  return (
    <div className="tab-panel scroll-panel">
      <ModelBanner
        state={loader.state}
        progress={loader.progress}
        error={loader.error}
        onLoad={loader.ensure}
        label="LLM"
      />

      <div className="section">
        <h3>Prompt</h3>
        <textarea className="text-area" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={busy} />
      </div>

      <div className="section">
        <h3>JSON schema</h3>
        <textarea className="text-area mono" rows={9} value={schema} onChange={(e) => setSchema(e.target.value)} disabled={busy} />
        <div className="btn-row">
          <button className="btn btn-primary" onClick={generate} disabled={busy || !prompt.trim()}>
            {busy ? 'Generating...' : 'Generate structured output'}
          </button>
        </div>
        {error && <div className="error-text status-line">{error}</div>}
      </div>

      {result && (
        <div className="section">
          <h3>
            Result{' '}
            <span className={`pill ${valid ? 'pill-green' : 'pill-grey'}`}>
              {valid ? 'valid' : 'invalid'}
            </span>
          </h3>
          <pre className="output-pre">{prettyParsed(result)}</pre>
          {result.validation?.validationErrors && result.validation.validationErrors.length > 0 && (
            <ul className="stat-list">
              {result.validation.validationErrors.map((e, i) => (
                <li key={i} className="error-text">{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
