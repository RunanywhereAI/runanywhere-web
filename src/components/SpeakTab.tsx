import { useCallback, useEffect, useState } from 'react';
import { ModelCategory, RunAnywhere } from '@runanywhere/web';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';

const DEFAULT_TEXT =
  'Hello — this speech was synthesized entirely on-device through the ' +
  'RunAnywhere Web SDK.';

/**
 * Text-to-speech tab. Mirrors the reference example's Speak view: the SDK
 * synthesizes AND plays the audio via `RunAnywhere.speak(text, { speakingRate })`.
 * In-flight playback is stopped with `RunAnywhere.stopSpeaking()`.
 */
export function SpeakTab() {
  const loader = useModelLoader(ModelCategory.MODEL_CATEGORY_SPEECH_SYNTHESIS);
  const [text, setText] = useState(DEFAULT_TEXT);
  const [rate, setRate] = useState(1.0);
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    return () => { RunAnywhere.stopSpeaking(); };
  }, []);

  const speak = useCallback(async () => {
    const value = text.trim();
    if (!value) return;

    if (loader.state !== 'ready') {
      const ok = await loader.ensure();
      if (!ok) return;
    }

    setSpeaking(true);
    setStatus(null);
    try {
      const result = await RunAnywhere.speak(value, { speakingRate: rate });
      setStatus(`Synthesized ${((result.durationMs ?? 0) / 1000).toFixed(2)}s of audio.`);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSpeaking(false);
    }
  }, [text, rate, loader]);

  const stop = useCallback(() => {
    RunAnywhere.stopSpeaking();
    setSpeaking(false);
  }, []);

  return (
    <div className="tab-panel scroll-panel">
      <ModelBanner
        state={loader.state}
        progress={loader.progress}
        error={loader.error}
        onLoad={loader.ensure}
        label="TTS"
      />

      <div className="section">
        <h3>Synthesize</h3>
        <p className="text-muted">Type text and let on-device TTS render + play it.</p>
        <textarea
          className="text-area"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={speaking}
        />
        <div className="slider-row">
          <strong>Rate</strong>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            disabled={speaking}
          />
          <span>{rate.toFixed(1)}x</span>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={speak} disabled={speaking || !text.trim()}>
            {speaking ? 'Speaking...' : 'Speak'}
          </button>
          <button className="btn" onClick={stop} disabled={!speaking}>Stop</button>
        </div>
        {status && <div className="text-muted status-line">{status}</div>}
      </div>
    </div>
  );
}
