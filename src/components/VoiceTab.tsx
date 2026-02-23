import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type CSSProperties,
} from "react";
import { VoicePipeline, ModelCategory, ModelManager } from "@runanywhere/web";
import {
  AudioCapture,
  AudioPlayback,
  VAD,
  SpeechActivity,
} from "@runanywhere/web-onnx";
import { useModelLoader } from "../hooks/useModelLoader";
import { ModelBanner } from "./ModelBanner";

type VoiceState = "idle" | "loading-models" | "listening" | "processing" | "speaking";

export function VoiceTab() {
  const llmLoader = useModelLoader(ModelCategory.Language, true);
  const sttLoader = useModelLoader(ModelCategory.SpeechRecognition, true);
  const ttsLoader = useModelLoader(ModelCategory.SpeechSynthesis, true);
  const vadLoader = useModelLoader(ModelCategory.Audio, true);

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const micRef = useRef<AudioCapture | null>(null);
  const pipelineRef = useRef<VoicePipeline | null>(null);
  const vadUnsubRef = useRef<(() => void) | null>(null);

  const cleanupListening = useCallback(() => {
    try {
      micRef.current?.stop();
    } catch {
      // ignore
    }
    micRef.current = null;

    try {
      vadUnsubRef.current?.();
    } catch {
      // ignore
    }
    vadUnsubRef.current = null;

    setAudioLevel(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupListening();
    };
  }, [cleanupListening]);

  // Ensure all 4 models are loaded
  const ensureModels = useCallback(async (): Promise<boolean> => {
    setVoiceState("loading-models");
    setError(null);

    const results = await Promise.all([
      vadLoader.ensure(),
      sttLoader.ensure(),
      llmLoader.ensure(),
      ttsLoader.ensure(),
    ]);

    if (results.every(Boolean)) {
      setVoiceState("idle");
      return true;
    }

    setError(
      vadLoader.error ||
        sttLoader.error ||
        llmLoader.error ||
        ttsLoader.error ||
        "Failed to load one or more voice models"
    );
    setVoiceState("idle");
    return false;
  }, [vadLoader, sttLoader, llmLoader, ttsLoader]);

  // Process a speech segment through the full pipeline
  const processSpeech = useCallback(
    async (audioData: Float32Array) => {
      const pipeline = pipelineRef.current;
      if (!pipeline) return;

      cleanupListening();
      setVoiceState("processing");

      try {
        const result = await pipeline.processTurn(
          audioData,
          {
            maxTokens: 60,
            temperature: 0.7,
            systemPrompt:
              "You are a helpful voice assistant. Keep responses concise — 1-2 sentences max.",
          },
          {
            onTranscription: (text) => setTranscript(text),
            onResponseToken: (_token, accumulated) => setResponse(accumulated),
            onResponseComplete: (text) => setResponse(text),
            onSynthesisComplete: async (audio, sampleRate) => {
              setVoiceState("speaking");
              const player = new AudioPlayback({ sampleRate });
              await player.play(audio, sampleRate);
              player.dispose();
            },
            onStateChange: (s) => {
              if (s === "processingSTT") setVoiceState("processing");
              if (s === "generatingResponse") setVoiceState("processing");
              if (s === "playingTTS") setVoiceState("speaking");
            },
          }
        );

        if (result) {
          setTranscript(result.transcription || "");
          setResponse(result.response || "");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setVoiceState("idle");
        setAudioLevel(0);
      }
    },
    [cleanupListening]
  );

  // Start listening
  const startListening = useCallback(async () => {
    setTranscript("");
    setResponse("");
    setError(null);

    // Ensure models are loaded
    const anyMissing =
      !ModelManager.getLoadedModel(ModelCategory.Audio) ||
      !ModelManager.getLoadedModel(ModelCategory.SpeechRecognition) ||
      !ModelManager.getLoadedModel(ModelCategory.Language) ||
      !ModelManager.getLoadedModel(ModelCategory.SpeechSynthesis);

    if (anyMissing) {
      const ok = await ensureModels();
      if (!ok) return;
    }

    // Build pipeline once
    if (!pipelineRef.current) {
      pipelineRef.current = new VoicePipeline();
    }

    cleanupListening();
    setVoiceState("listening");

    try {
      const mic = new AudioCapture({ sampleRate: 16000 });
      micRef.current = mic;

      VAD.reset();

      vadUnsubRef.current = VAD.onSpeechActivity((activity) => {
        if (activity === SpeechActivity.Ended) {
          const segment = VAD.popSpeechSegment();
          if (segment?.samples && segment.samples.length > 1600) {
            void processSpeech(segment.samples);
          }
        }
      });

      await mic.start(
        (chunk) => {
          VAD.processSamples(chunk);
        },
        (level) => {
          setAudioLevel(level);
        }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Microphone error: ${msg}`);
      setVoiceState("idle");
      cleanupListening();
    }
  }, [ensureModels, cleanupListening, processSpeech]);

  const stopListening = useCallback(() => {
    cleanupListening();
    setVoiceState("idle");
  }, [cleanupListening]);

  // Loaders still loading?
  const pendingLoaders = [
    { label: "VAD", loader: vadLoader },
    { label: "STT", loader: sttLoader },
    { label: "LLM", loader: llmLoader },
    { label: "TTS", loader: ttsLoader },
  ].filter((l) => l.loader.state !== "ready");

  return (
    <div className="tab-panel voice-panel">
      {pendingLoaders.length > 0 && voiceState === "idle" && (
        <ModelBanner
          state={pendingLoaders[0].loader.state}
          progress={pendingLoaders[0].loader.progress}
          error={pendingLoaders[0].loader.error}
          onLoad={() => void ensureModels()}
          label={`Voice (${pendingLoaders.map((l) => l.label).join(", ")})`}
        />
      )}

      {error && (
        <div className="model-banner">
          <span className="error-text">{error}</span>
        </div>
      )}

      <div className="voice-center">
        <div
          className="voice-orb"
          data-state={voiceState}
          style={{ ["--level" as any]: audioLevel } as CSSProperties}
        >
          <div className="voice-orb-inner" />
        </div>

        <p className="voice-status">
          {voiceState === "idle" && "Tap to start listening"}
          {voiceState === "loading-models" && "Loading models..."}
          {voiceState === "listening" && "Listening... speak now"}
          {voiceState === "processing" && "Processing..."}
          {voiceState === "speaking" && "Speaking..."}
        </p>

        {(voiceState === "idle" || voiceState === "loading-models") && (
          <button
            className="btn btn-primary btn-lg"
            onClick={() => void startListening()}
            disabled={voiceState === "loading-models"}
          >
            Start Listening
          </button>
        )}

        {voiceState === "listening" && (
          <button className="btn btn-lg" onClick={stopListening}>
            Stop
          </button>
        )}
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