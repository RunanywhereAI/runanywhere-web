import { useState, useRef, useCallback, useEffect } from 'react';
import { RunAnywhere, ModelCategory } from '@runanywhere/web';
import { VoiceAgentMicDriver } from '@runanywhere/web/browser';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';

type VoiceState = 'idle' | 'loading-models' | 'listening' | 'processing' | 'speaking';

export function VoiceTab() {
  const llmLoader = useModelLoader(ModelCategory.MODEL_CATEGORY_LANGUAGE);
  const sttLoader = useModelLoader(ModelCategory.MODEL_CATEGORY_SPEECH_RECOGNITION);
  const ttsLoader = useModelLoader(ModelCategory.MODEL_CATEGORY_SPEECH_SYNTHESIS);

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const micDriverRef = useRef<VoiceAgentMicDriver | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      micDriverRef.current?.stop();
      void RunAnywhere.cleanupVoiceAgent();
    };
  }, []);

  // Ensure the LLM/STT/TTS trio is loaded. VAD is auto-loaded by the SDK
  // inside RunAnywhere.initializeVoiceAgentWithLoadedModels().
  const ensureModels = useCallback(async (): Promise<boolean> => {
    setVoiceState('loading-models');
    setError(null);

    const results = await Promise.all([
      sttLoader.ensure(),
      llmLoader.ensure(),
      ttsLoader.ensure(),
    ]);

    if (results.every(Boolean)) {
      setVoiceState('idle');
      return true;
    }

    setError('Failed to load one or more voice models');
    setVoiceState('idle');
    return false;
  }, [sttLoader, llmLoader, ttsLoader]);

  // Start listening
  const startListening = useCallback(async () => {
    setTranscript('');
    setResponse('');
    setError(null);

    const anyMissing =
      sttLoader.state !== 'ready' || llmLoader.state !== 'ready' || ttsLoader.state !== 'ready';

    if (anyMissing) {
      const ok = await ensureModels();
      if (!ok) return;
    }

    try {
      // The SDK composes the currently-loaded STT/LLM/TTS models (and
      // auto-loads the default VAD model) into a ready voice-agent session.
      await RunAnywhere.initializeVoiceAgentWithLoadedModels();

      const driver = new VoiceAgentMicDriver();
      micDriverRef.current = driver;

      setVoiceState('listening');

      await driver.start({
        onLevel: (level) => setAudioLevel(level),
        onPhase: (phase) => {
          setVoiceState(phase === 'processing' ? 'processing' : 'listening');
        },
        onTurn: (turn) => {
          setTranscript(turn.userText);
          setResponse(turn.assistantText);
          // The driver plays the synthesized reply next; reflect that in the
          // UI until `onPhase('listening')` fires once playback completes.
          setVoiceState('speaking');
        },
        onError: (err) => {
          setError(err.message);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setVoiceState('idle');
    }
  }, [ensureModels, sttLoader.state, llmLoader.state, ttsLoader.state]);

  const stopListening = useCallback(() => {
    micDriverRef.current?.stop();
    micDriverRef.current = null;
    void RunAnywhere.cleanupVoiceAgent();
    setVoiceState('idle');
    setAudioLevel(0);
  }, []);

  // Which loaders are still loading?
  const pendingLoaders = [
    { label: 'STT', loader: sttLoader },
    { label: 'LLM', loader: llmLoader },
    { label: 'TTS', loader: ttsLoader },
  ].filter((l) => l.loader.state !== 'ready');

  return (
    <div className="tab-panel voice-panel">
      {pendingLoaders.length > 0 && voiceState === 'idle' && (
        <ModelBanner
          state={pendingLoaders[0].loader.state}
          progress={pendingLoaders[0].loader.progress}
          error={pendingLoaders[0].loader.error}
          onLoad={ensureModels}
          label={`Voice (${pendingLoaders.map((l) => l.label).join(', ')})`}
        />
      )}

      {error && <div className="model-banner"><span className="error-text">{error}</span></div>}

      <div className="voice-center">
        <div className="voice-orb" data-state={voiceState} style={{ '--level': audioLevel } as React.CSSProperties}>
          <div className="voice-orb-inner" />
        </div>

        <p className="voice-status">
          {voiceState === 'idle' && 'Tap to start listening'}
          {voiceState === 'loading-models' && 'Loading models...'}
          {voiceState === 'listening' && 'Listening... speak now'}
          {voiceState === 'processing' && 'Processing...'}
          {voiceState === 'speaking' && 'Speaking...'}
        </p>

        {voiceState === 'idle' || voiceState === 'loading-models' ? (
          <button
            className="btn btn-primary btn-lg"
            onClick={startListening}
            disabled={voiceState === 'loading-models'}
          >
            Start Listening
          </button>
        ) : voiceState === 'listening' ? (
          <button className="btn btn-lg" onClick={stopListening}>
            Stop
          </button>
        ) : null}
      </div>

      {transcript && (
        <div className="voice-transcript">
          <h4>You said:</h4>
          <p>{transcript}</p>
        </div>
      )}

      {response && (
        <div className="voice-response">
          <h4>AI response:</h4>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}
