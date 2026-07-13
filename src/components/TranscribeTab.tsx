import { useCallback, useEffect, useRef, useState } from 'react';
import { ModelCategory, RunAnywhere } from '@runanywhere/web';
import { AudioCapture, AudioFileLoader } from '@runanywhere/web/browser';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';

type Mode = 'batch' | 'live';

/**
 * Speech-to-text tab. Mirrors the reference example's Transcribe view:
 *  - Batch: record, then one-shot `RunAnywhere.transcribe(samples)`.
 *  - Live:  `RunAnywhere.transcribeStream(samples)` streams partial + final
 *           hypotheses; partials preview the utterance, the final replaces them.
 * A file-upload path decodes audio through `AudioFileLoader`.
 */
export function TranscribeTab() {
  const loader = useModelLoader(ModelCategory.MODEL_CATEGORY_SPEECH_RECOGNITION);
  const [mode, setMode] = useState<Mode>('batch');
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState('');
  const captureRef = useRef<AudioCapture | null>(null);

  useEffect(() => {
    return () => captureRef.current?.stop();
  }, []);

  const ensureModel = useCallback(async (): Promise<boolean> => {
    if (loader.state === 'ready') return true;
    return loader.ensure();
  }, [loader]);

  const runBatch = useCallback(async (samples: Float32Array) => {
    setProcessing(true);
    setStatus(`Transcribing ${(samples.length / 16000).toFixed(1)}s of audio...`);
    try {
      const output = await RunAnywhere.transcribe(samples);
      setTranscript(output.text);
      setStatus('Done.');
    } catch (err) {
      setStatus(`Transcribe failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProcessing(false);
    }
  }, []);

  const runLive = useCallback(async (samples: Float32Array) => {
    setProcessing(true);
    setStatus(`Streaming ${(samples.length / 16000).toFixed(1)}s of audio...`);
    try {
      setTranscript('');
      for await (const partial of RunAnywhere.transcribeStream(samples)) {
        const text = partial.text.trim();
        if (text) setTranscript(text);
      }
      setStatus('Done.');
    } catch (err) {
      setStatus(`Transcribe failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProcessing(false);
    }
  }, []);

  const dispatch = useCallback(
    (samples: Float32Array) => (mode === 'live' ? runLive(samples) : runBatch(samples)),
    [mode, runLive, runBatch],
  );

  const toggleRecording = useCallback(async () => {
    if (recording) {
      const capture = captureRef.current;
      if (!capture) return;
      const samples = capture.getAudioBuffer();
      capture.stop();
      captureRef.current = null;
      setRecording(false);
      if (samples.length === 0) {
        setStatus('No audio captured.');
        return;
      }
      await dispatch(samples);
      return;
    }

    if (!(await ensureModel())) return;
    try {
      const capture = new AudioCapture({ sampleRate: 16000 });
      await capture.start();
      captureRef.current = capture;
      setTranscript('');
      setStatus('Recording... speak, then stop to transcribe.');
      setRecording(true);
    } catch (err) {
      setStatus(`Microphone error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [recording, ensureModel, dispatch]);

  const onFile = useCallback(
    async (file: File) => {
      if (!(await ensureModel())) return;
      setProcessing(true);
      setStatus(`Decoding ${file.name}...`);
      try {
        const decoded = await AudioFileLoader.toFloat32Array(file, 16000);
        await dispatch(decoded.samples);
      } catch (err) {
        setStatus(`Failed to decode file: ${err instanceof Error ? err.message : String(err)}`);
        setProcessing(false);
      }
    },
    [ensureModel, dispatch],
  );

  return (
    <div className="tab-panel scroll-panel">
      <ModelBanner
        state={loader.state}
        progress={loader.progress}
        error={loader.error}
        onLoad={loader.ensure}
        label="STT"
      />

      <div className="section">
        <h3>Mode</h3>
        <div className="btn-row">
          <button
            className={`btn btn-sm ${mode === 'batch' ? 'btn-primary' : ''}`}
            onClick={() => setMode('batch')}
            disabled={recording || processing}
          >
            Batch
          </button>
          <button
            className={`btn btn-sm ${mode === 'live' ? 'btn-primary' : ''}`}
            onClick={() => setMode('live')}
            disabled={recording || processing}
          >
            Live
          </button>
        </div>
        <p className="text-muted">
          {mode === 'batch'
            ? 'Record first, then transcribe in one shot.'
            : 'Stream partial hypotheses; the final result replaces them.'}
        </p>
      </div>

      <div className="section">
        <h3>Microphone</h3>
        <div className="btn-row">
          <button
            className="btn btn-primary"
            onClick={toggleRecording}
            disabled={processing}
          >
            {recording ? 'Stop & transcribe' : 'Start recording'}
          </button>
          <button
            className="btn"
            onClick={() => { setTranscript(''); setStatus(''); }}
            disabled={recording || processing}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="section">
        <h3>From file</h3>
        <p className="text-muted">Upload an audio file (wav, mp3, m4a, ogg, flac...).</p>
        <input
          type="file"
          accept="audio/*"
          disabled={recording || processing}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.target.value = '';
          }}
        />
      </div>

      <div className="section">
        <h3>Result</h3>
        {status && <div className="text-muted status-line">{status}</div>}
        <pre className="output-pre">{transcript || '(no transcript yet)'}</pre>
      </div>
    </div>
  );
}
