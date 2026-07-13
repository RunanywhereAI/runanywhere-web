import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ModelCategory,
  RunAnywhere,
  VLMModelFamily,
  VLMStreamEventKind,
  vlmImageFromRawRGB,
  type VLMGenerationOptions,
} from '@runanywhere/web';
import { VideoCapture } from '@runanywhere/web/browser';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';

const LIVE_INTERVAL_MS = 2500;
const LIVE_MAX_TOKENS = 30;
const SINGLE_MAX_TOKENS = 80;
const CAPTURE_DIM = 256; // CLIP resizes internally; larger is wasted work

interface VisionResult {
  text: string;
  totalMs: number;
}

/** Full VLMGenerationOptions the SDK's proto ABI requires. */
function buildVlmOptions(prompt: string, maxTokens: number): VLMGenerationOptions {
  return {
    prompt,
    maxTokens,
    temperature: 0.6,
    topP: 0.9,
    topK: 40,
    stopSequences: [],
    streamingEnabled: true,
    systemPrompt: undefined,
    maxImageSize: CAPTURE_DIM,
    nThreads: 0,
    useGpu: true,
    modelFamily: VLMModelFamily.VLM_MODEL_FAMILY_AUTO,
    customChatTemplate: undefined,
    imageMarkerOverride: undefined,
    seed: 0,
    repetitionPenalty: 1.1,
    minP: 0.05,
    emitImageEmbeddings: false,
  };
}

export function VisionTab() {
  const loader = useModelLoader(ModelCategory.MODEL_CATEGORY_MULTIMODAL);
  const [cameraActive, setCameraActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('Describe what you see briefly.');

  const videoMountRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<VideoCapture | null>(null);
  const processingRef = useRef(false);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveModeRef = useRef(false);

  // Keep refs in sync with state so interval callbacks see latest values
  processingRef.current = processing;
  liveModeRef.current = liveMode;

  // ------------------------------------------------------------------
  // Camera
  // ------------------------------------------------------------------
  const startCamera = useCallback(async () => {
    if (captureRef.current?.isCapturing) return;

    setError(null);

    try {
      const cam = new VideoCapture({ facingMode: 'environment' });
      await cam.start();
      captureRef.current = cam;

      const mount = videoMountRef.current;
      if (mount) {
        const el = cam.videoElement;
        el.style.width = '100%';
        el.style.borderRadius = '12px';
        mount.appendChild(el);
      }

      setCameraActive(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes('NotAllowed') || msg.includes('Permission')) {
        setError(
          'Camera permission denied. On macOS, check System Settings → Privacy & Security → Camera and ensure your browser is allowed.',
        );
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
        setError('No camera found on this device.');
      } else if (msg.includes('NotReadable') || msg.includes('TrackStartError')) {
        setError('Camera is in use by another application.');
      } else {
        setError(`Camera error: ${msg}`);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      void RunAnywhere.visionLanguage.cancelVLMGeneration();
      const cam = captureRef.current;
      if (cam) {
        cam.stop();
        cam.videoElement.parentNode?.removeChild(cam.videoElement);
        captureRef.current = null;
      }
    };
  }, []);

  // ------------------------------------------------------------------
  // Core: capture + infer
  // ------------------------------------------------------------------
  const describeFrame = useCallback(async (maxTokens: number) => {
    if (processingRef.current) return;

    const cam = captureRef.current;
    if (!cam?.isCapturing) return;

    // Ensure model loaded
    if (loader.state !== 'ready') {
      const ok = await loader.ensure();
      if (!ok) return;
    }

    const frame = cam.captureFrame(CAPTURE_DIM);
    if (!frame) return;

    setProcessing(true);
    processingRef.current = true;
    setError(null);

    const t0 = performance.now();

    try {
      const image = vlmImageFromRawRGB(frame.rgbPixels, frame.width, frame.height);
      const options = buildVlmOptions(prompt, maxTokens);
      const stream = await RunAnywhere.visionLanguage.processImageStream(image, options);

      let text = '';
      for await (const event of stream) {
        if (event.kind === VLMStreamEventKind.VLM_STREAM_EVENT_KIND_TOKEN && event.token) {
          text += event.token;
        } else if (event.kind === VLMStreamEventKind.VLM_STREAM_EVENT_KIND_ERROR) {
          throw new Error(event.errorMessage || 'VLM stream failed');
        }
      }

      setResult({ text, totalMs: performance.now() - t0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isWasmCrash = msg.includes('memory access out of bounds')
        || msg.includes('RuntimeError');

      if (isWasmCrash) {
        setResult({ text: 'Recovering from memory error... next frame will retry.', totalMs: 0 });
      } else {
        setError(msg);
        if (liveModeRef.current) stopLive();
      }
    } finally {
      setProcessing(false);
      processingRef.current = false;
    }
  }, [loader, prompt]);

  // ------------------------------------------------------------------
  // Single-shot
  // ------------------------------------------------------------------
  const describeSingle = useCallback(async () => {
    if (!captureRef.current?.isCapturing) {
      await startCamera();
      return;
    }
    await describeFrame(SINGLE_MAX_TOKENS);
  }, [startCamera, describeFrame]);

  // ------------------------------------------------------------------
  // Live mode
  // ------------------------------------------------------------------
  const startLive = useCallback(async () => {
    if (!captureRef.current?.isCapturing) {
      await startCamera();
    }

    setLiveMode(true);
    liveModeRef.current = true;

    // Immediately describe first frame
    describeFrame(LIVE_MAX_TOKENS);

    // Then poll every 2.5s — skips ticks while inference is running
    liveIntervalRef.current = setInterval(() => {
      if (!processingRef.current && liveModeRef.current) {
        describeFrame(LIVE_MAX_TOKENS);
      }
    }, LIVE_INTERVAL_MS);
  }, [startCamera, describeFrame]);

  const stopLive = useCallback(() => {
    setLiveMode(false);
    liveModeRef.current = false;
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }
  }, []);

  const toggleLive = useCallback(() => {
    if (liveMode) {
      stopLive();
    } else {
      startLive();
    }
  }, [liveMode, startLive, stopLive]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="tab-panel vision-panel">
      <ModelBanner
        state={loader.state}
        progress={loader.progress}
        error={loader.error}
        onLoad={loader.ensure}
        label="VLM"
      />

      <div className="vision-camera">
        {!cameraActive && (
          <div className="empty-state">
            <h3>📷 Camera Preview</h3>
            <p>Tap below to start the camera</p>
          </div>
        )}
        <div ref={videoMountRef} />
      </div>

      <input
        className="vision-prompt"
        type="text"
        placeholder="What do you want to know about the image?"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={liveMode}
      />

      <div className="vision-actions">
        {!cameraActive ? (
          <button className="btn btn-primary" onClick={startCamera}>Start Camera</button>
        ) : (
          <>
            <button
              className="btn btn-primary"
              onClick={describeSingle}
              disabled={processing || liveMode}
            >
              {processing && !liveMode ? 'Analyzing...' : 'Describe'}
            </button>
            <button
              className={`btn ${liveMode ? 'btn-live-active' : ''}`}
              onClick={toggleLive}
              disabled={processing && !liveMode}
            >
              {liveMode ? '⏹ Stop Live' : '▶ Live'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="vision-result">
          <span className="error-text">Error: {error}</span>
        </div>
      )}

      {result && (
        <div className="vision-result">
          {liveMode && <span className="live-badge">LIVE</span>}
          <h4>Result</h4>
          <p>{result.text}</p>
          {result.totalMs > 0 && (
            <div className="message-stats">{(result.totalMs / 1000).toFixed(1)}s</div>
          )}
        </div>
      )}
    </div>
  );
}
