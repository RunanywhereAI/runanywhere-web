import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ModelCategory } from "@runanywhere/web";
import { useModelLoader } from "../hooks/useModelLoader";
import { ModelBanner } from "./ModelBanner";

// ⚠️ Depending on RunAnywhere version, these exports can differ.
// If your build fails on this import, tell me your package versions and I’ll match it.
import { VideoCapture, VLMWorkerBridge } from "@runanywhere/web-llamacpp";

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
  const [prompt, setPrompt] = useState("Describe what you see briefly.");

  const videoMountRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<VideoCapture | null>(null);

  const processingRef = useRef(false);
  const liveModeRef = useRef(false);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs synced
  useEffect(() => {
    processingRef.current = processing;
  }, [processing]);

  useEffect(() => {
    liveModeRef.current = liveMode;
  }, [liveMode]);

  const clearLiveTimer = useCallback(() => {
    if (liveTimerRef.current) {
      clearTimeout(liveTimerRef.current);
      liveTimerRef.current = null;
    }
  }, []);

  // ----------------------------
  // Camera start/stop (safe)
  // ----------------------------
  const startCamera = useCallback(async () => {
    if (captureRef.current?.isCapturing) return;

    setError(null);

    try {
      // Use back camera for posture/fitness (better than selfie cam)
      const cam = new VideoCapture({ facingMode: "environment" });
      await cam.start();

      captureRef.current = cam;

      const mount = videoMountRef.current;
      if (mount) {
        // Prevent duplicate video elements
        mount.innerHTML = "";

        const el = cam.videoElement;
        el.style.width = "100%";
        el.style.borderRadius = "12px";
        mount.appendChild(el);
      }

      setCameraActive(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes("NotAllowed") || msg.includes("Permission")) {
        setError("Camera permission denied. Please allow camera access in your browser/site settings.");
      } else if (msg.includes("NotFound") || msg.includes("DevicesNotFound")) {
        setError("No camera found on this device.");
      } else if (msg.includes("NotReadable") || msg.includes("TrackStartError")) {
        setError("Camera is in use by another application.");
      } else {
        setError(`Camera error: ${msg}`);
      }

      setCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    clearLiveTimer();
    setLiveMode(false);
    liveModeRef.current = false;

    const cam = captureRef.current;
    if (cam) {
      try {
        cam.stop();
      } catch {
        // ignore
      }

      try {
        cam.videoElement.parentNode?.removeChild(cam.videoElement);
      } catch {
        // ignore
      }

      captureRef.current = null;
    }

    setCameraActive(false);
    setProcessing(false);
    processingRef.current = false;
  }, [clearLiveTimer]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // ----------------------------
  // Ensure model + worker ready (version-safe)
  // ----------------------------
  const ensureVLMReady = useCallback(async () => {
    setError(null);

    // 1) Ensure multimodal model is loaded
    if (loader.state !== "ready") {
      const ok = await loader.ensure();
      if (!ok) {
        setError(loader.error ?? "Failed to load VLM model.");
        return false;
      }
    }

    // 2) Ensure worker is initialized (without assuming flags exist)
    const bridge: any = VLMWorkerBridge.shared;

    try {
      // Some SDK versions need init(), some don’t.
      if (typeof bridge.init === "function") {
        await bridge.init();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Worker init warning: ${msg}`);
      // Don't block; process() will throw a clearer message if needed.
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

      // Capture frame safely
      const frame = cam.captureFrame(CAPTURE_DIM);
      if (!frame || !frame.rgbPixels) {
        setError("Failed to capture a valid frame from camera.");
        return;
      }

      setProcessing(true);
      processingRef.current = true;

      const t0 = performance.now();

      try {
        const bridge: any = VLMWorkerBridge.shared;

        if (typeof bridge.process !== "function") {
          throw new Error("VLMWorkerBridge.process() not available in this SDK version.");
        }

        const res = await bridge.process(
          frame.rgbPixels,
          frame.width,
          frame.height,
          prompt,
          { maxTokens, temperature: 0.6 }
        );

        const text = res?.text ?? "";
        setResult({
          text: text || "(No text returned)",
          totalMs: performance.now() - t0,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);

        // Stop live mode on failure to prevent infinite loops
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

  // Single shot
  const describeSingle = useCallback(async () => {
    if (!captureRef.current?.isCapturing) {
      await startCamera();
    }
    await describeFrame(SINGLE_MAX_TOKENS);
  }, [startCamera, describeFrame]);

  // Live loop
  const liveTick = useCallback(async () => {
    if (!liveModeRef.current) return;
    if (!captureRef.current?.isCapturing) return;

    if (!processingRef.current) {
      await describeFrame(LIVE_MAX_TOKENS);
    }

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

  const liveLabel = useMemo(() => (liveMode ? "Stop Live" : "Start Live"), [liveMode]);

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
              {processing && !liveMode ? "Analyzing" : "Describe"}
            </button>

            <button
              className={liveMode ? "btn btn-live-active" : "btn"}
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