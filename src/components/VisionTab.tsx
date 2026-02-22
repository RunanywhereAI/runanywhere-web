import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ModelCategory } from '@runanywhere/web';
import { VideoCapture, VLMWorkerBridge } from '@runanywhere/web-llamacpp';
import { useModelLoader } from '../hooks/useModelLoader';
import { ModelBanner } from './ModelBanner';

const LIVE_INTERVAL_MS = 2500;
const LIVE_MAX_TOKENS = 30;
const SINGLE_MAX_TOKENS = 80;
const CAPTURE_DIM = 256;

interface VisionResult {
  text: string;
  totalMs: number;
}

export function VisionTab() {
  const loader = useModelLoader(ModelCategory.Multimodal);

  const [cameraActive, setCameraActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [liveMode, setLiveMode] = useState(false);

  const [result, setResult] = useState<VisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('Describe what you see briefly.');

  const videoMountRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<VideoCapture | null>(null);

  const processingRef = useRef(false);
  const liveModeRef = useRef(false);

  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // keep refs synced
  useEffect(() => { processingRef.current = processing; }, [processing]);
  useEffect(() => { liveModeRef.current = liveMode; }, [liveMode]);

  const clearLiveTimer = useCallback(() => {
    if (liveTimerRef.current) {
      clearTimeout(liveTimerRef.current);
      liveTimerRef.current = null;
    }
  }, []);

  // ----------------------------
  // Camera start/stop
  // ----------------------------
  const startCamera = useCallback(async () => {
    if (captureRef.current?.isCapturing) return;

    setError(null);

    const cam = new VideoCapture({ facingMode: 'user' }); // laptops generally have user camera
    await cam.start();
    captureRef.current = cam;

    const mount = videoMountRef.current;
    if (mount) {
      // IMPORTANT: clear mount first (prevents duplicate video elements)
      mount.innerHTML = '';
      const el = cam.videoElement;
      el.style.width = '100%';
      el.style.borderRadius = '12px';
      mount.appendChild(el);
    }

    setCameraActive(true);
  }, []);

  const stopCamera = useCallback(() => {
    clearLiveTimer();
    setLiveMode(false);
    liveModeRef.current = false;

    const cam = captureRef.current;
    if (cam) {
      cam.stop();
      // remove video element safely
      cam.videoElement.parentNode?.removeChild(cam.videoElement);
      captureRef.current = null;
    }

    setCameraActive(false);
    setProcessing(false);
    processingRef.current = false;
  }, [clearLiveTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // ----------------------------
  // Ensure model + worker ready
  // ----------------------------
  const ensureVLMReady = useCallback(async () => {
    // Ensure model loaded via your loader hook
    if (loader.state !== 'ready') {
      const ok = await loader.ensure();
      if (!ok) return false;
    }

    // Ensure worker is initialized if needed
    const bridge = VLMWorkerBridge.shared;

    // Some versions use init() internally, some are already initialized.
    // This is safe to try.
    if (!bridge.isInitialized) {
      try {
        await bridge.init();
      } catch {
        // ignore; process() will still throw a meaningful error
      }
    }

    return true;
  }, [loader]);

  // ----------------------------
  // Core: capture + infer
  // ----------------------------
  const describeFrame = useCallback(
    async (maxTokens: number) => {
      if (processingRef.current) return;

      const cam = captureRef.current;
      if (!cam?.isCapturing) return;

      setError(null);

      const ready = await ensureVLMReady();
      if (!ready) return;

      const frame = cam.captureFrame(CAPTURE_DIM);
      if (!frame) return;

      setProcessing(true);
      processingRef.current = true;

      const t0 = performance.now();

      try {
        const bridge = VLMWorkerBridge.shared;

        // Do NOT hard-block on bridge.isModelLoaded (varies by version).
        // Let process() be the source of truth.
        const res = await bridge.process(
          frame.rgbPixels,
          frame.width,
          frame.height,
          prompt,
          { maxTokens, temperature: 0.6 }
        );

        setResult({ text: res.text, totalMs: performance.now() - t0 });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        // If something crashes, stop live mode immediately to avoid infinite retries
        setError(msg);
        if (liveModeRef.current) {
          setLiveMode(false);
          liveModeRef.current = false;
          clearLiveTimer();
        }
      } finally {
        setProcessing(false);
        processingRef.current = false;
      }
    },
    [prompt, ensureVLMReady, clearLiveTimer]
  );

  // ----------------------------
  // Single-shot
  // ----------------------------
  const describeSingle = useCallback(async () => {
    if (!captureRef.current?.isCapturing) {
      await startCamera();
      // Run one inference after camera starts (IMPORTANT)
      await describeFrame(SINGLE_MAX_TOKENS);
      return;
    }
    await describeFrame(SINGLE_MAX_TOKENS);
  }, [startCamera, describeFrame]);

  // ----------------------------
  // Live mode (safe loop)
  // ----------------------------
  const liveTick = useCallback(async () => {
    if (!liveModeRef.current) return;
    if (!captureRef.current?.isCapturing) return;

    // Skip if still processing
    if (!processingRef.current) {
      await describeFrame(LIVE_MAX_TOKENS);
    }

    // schedule next tick only if still live
    if (liveModeRef.current) {
      liveTimerRef.current = setTimeout(() => {
        void liveTick();
      }, LIVE_INTERVAL_MS);
    }
  }, [describeFrame]);

  const startLive = useCallback(async () => {
    clearLiveTimer();

    if (!captureRef.current?.isCapturing) {
      await startCamera();
    }

    setLiveMode(true);
    liveModeRef.current = true;

    // immediate tick
    void liveTick();
  }, [startCamera, liveTick, clearLiveTimer]);

  const stopLive = useCallback(() => {
    setLiveMode(false);
    liveModeRef.current = false;
    clearLiveTimer();
  }, [clearLiveTimer]);

  const toggleLive = useCallback(() => {
    if (liveModeRef.current) stopLive();
    else void startLive();
  }, [startLive, stopLive]);

  const liveLabel = useMemo(() => (liveMode ? 'Stop Live' : 'Start Live'), [liveMode]);

  // ----------------------------
  // Render (professional, no emojis)
  // ----------------------------
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
            <h3>Camera Preview</h3>
            <p>Start the camera to capture frames for analysis.</p>
          </div>
        )}
        <div ref={videoMountRef} />
      </div>

      <input
        className="vision-prompt"
        type="text"
        placeholder="Prompt for the image"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={liveMode}
      />

      <div className="vision-actions">
        {!cameraActive ? (
          <button className="btn btn-primary" onClick={() => void startCamera()}>
            Start Camera
          </button>
        ) : (
          <>
            <button className="btn" onClick={stopCamera} disabled={processing}>
              Stop Camera
            </button>

            <button
              className="btn btn-primary"
              onClick={() => void describeSingle()}
              disabled={processing || liveMode}
            >
              {processing && !liveMode ? 'Analyzing' : 'Describe'}
            </button>

            <button
              className={liveMode ? 'btn btn-live-active' : 'btn'}
              onClick={toggleLive}
              disabled={processing && !liveMode}
            >
              {liveLabel}
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
          <h4>Result</h4>
          <p>{result.text}</p>
          {result.totalMs > 0 && (
            <div className="message-stats">{(result.totalMs / 1000).toFixed(1)} s</div>
          )}
        </div>
      )}
    </div>
  );
}