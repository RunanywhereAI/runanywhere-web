import { useCallback, useEffect, useRef, useState } from 'react';
import { ModelCategory, RunAnywhere, type VADResult } from '@runanywhere/web';
import { AudioCapture } from '@runanywhere/web/browser';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';

interface LogEntry {
  label: 'Speech Started' | 'Speech Ended';
  time: string;
}

/**
 * Voice-activity-detection tab. Mirrors the reference example's VAD view: mic
 * chunks are fed straight into `RunAnywhere.streamVAD(...)`; the SDK owns model
 * framing and emits one `VADResult` per chunk. Speech-state transitions are
 * logged to an activity list.
 */
export function VadTab() {
  const loader = useModelLoader(ModelCategory.MODEL_CATEGORY_VOICE_ACTIVITY_DETECTION);
  const [listening, setListening] = useState(false);
  const [speech, setSpeech] = useState(false);
  const [last, setLast] = useState<VADResult | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const captureRef = useRef<AudioCapture | null>(null);
  // Push-queue bridging mic-chunk callbacks into the SDK's pull-style iterable.
  const queueRef = useRef<Float32Array[]>([]);
  const notifyRef = useRef<(() => void) | null>(null);
  const doneRef = useRef(false);
  const listeningRef = useRef(false);

  const stop = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
    doneRef.current = true;
    notifyRef.current?.();
    listeningRef.current = false;
    setListening(false);
    setSpeech(false);
  }, []);

  useEffect(() => stop, [stop]);

  async function* micChunks(): AsyncIterable<Float32Array> {
    while (!doneRef.current) {
      const next = queueRef.current.shift();
      if (next) {
        yield next;
        continue;
      }
      await new Promise<void>((resolve) => { notifyRef.current = resolve; });
      notifyRef.current = null;
    }
  }

  const consume = useCallback(async () => {
    let wasActive = false;
    try {
      for await (const result of RunAnywhere.streamVAD(micChunks())) {
        if (!listeningRef.current) break;
        if (result.errorMessage) {
          setError(result.errorMessage);
          continue;
        }
        setLast(result);
        setSpeech(result.isSpeech);
        if (result.isSpeech && !wasActive) {
          wasActive = true;
          const entry: LogEntry = { label: 'Speech Started', time: new Date().toLocaleTimeString() };
          setLog((l) => [entry, ...l].slice(0, 50));
        } else if (!result.isSpeech && wasActive) {
          wasActive = false;
          const entry: LogEntry = { label: 'Speech Ended', time: new Date().toLocaleTimeString() };
          setLog((l) => [entry, ...l].slice(0, 50));
        }
      }
    } catch (err) {
      setError(`VAD stream failed: ${err instanceof Error ? err.message : String(err)}`);
      stop();
    }
  }, [stop]);

  const start = useCallback(async () => {
    setError(null);
    setLast(null);
    if (loader.state !== 'ready') {
      const ok = await loader.ensure();
      if (!ok) return;
    }
    queueRef.current = [];
    doneRef.current = false;
    try {
      const capture = new AudioCapture({ sampleRate: 16000, channels: 1 });
      await capture.start((chunk) => {
        queueRef.current.push(chunk);
        notifyRef.current?.();
      });
      captureRef.current = capture;
      listeningRef.current = true;
      setListening(true);
      void consume();
    } catch (err) {
      setError(`Failed to start recording: ${err instanceof Error ? err.message : String(err)}`);
      stop();
    }
  }, [loader, consume, stop]);

  return (
    <div className="tab-panel scroll-panel">
      <ModelBanner
        state={loader.state}
        progress={loader.progress}
        error={loader.error}
        onLoad={loader.ensure}
        label="VAD"
      />

      <div className="section">
        <h3>Voice activity detection</h3>
        <p className="text-muted">
          Mic chunks feed <code>RunAnywhere.streamVAD(...)</code>; the SDK emits one result per chunk.
        </p>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => (listening ? stop() : start())}>
            {listening ? 'Stop listening' : 'Start listening'}
          </button>
          <button className="btn" onClick={() => setLog([])} disabled={listening}>Clear log</button>
        </div>
        {error && <div className="error-text status-line">{error}</div>}
      </div>

      <div className="section">
        <h3>Status</h3>
        <span className={`pill ${speech ? 'pill-green' : 'pill-grey'}`}>
          {speech ? 'Speech detected' : listening ? 'No speech' : 'Idle'}
        </span>
        <ul className="stat-list">
          <li>Confidence: <code>{last ? last.confidence.toFixed(3) : '-'}</code></li>
          <li>Energy (RMS): <code>{last ? last.energy.toFixed(4) : '-'}</code></li>
          <li>Frame: <code>{last ? `${last.durationMs} ms` : '-'}</code></li>
        </ul>
      </div>

      <div className="section">
        <h3>Activity log</h3>
        {log.length === 0 ? (
          <p className="text-muted">No speech activity yet</p>
        ) : (
          <ul className="stat-list">
            {log.map((entry, i) => (
              <li key={i}>{entry.label} <span className="text-muted">· {entry.time}</span></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
