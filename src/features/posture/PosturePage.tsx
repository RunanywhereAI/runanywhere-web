import { useEffect, useRef, useState } from 'react';
import type { ExerciseType, PostureSummary } from '../../types/posture';

const WARMUP_MS = 1200;          // ignore early auto-exposure noise
const MIN_REP_GAP_MS = 900;      // cooldown between reps
const MIN_DOWN_MS = 250;         // must stay "down" at least this long
const EMA_ALPHA = 0.25;          // smoothing (0.1–0.35 good range)

export function PosturePage({
  lowPowerMode,
  onSummary,
}: {
  lowPowerMode: boolean;
  onSummary: (summary: PostureSummary) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const lastImageRef = useRef<ImageData | null>(null);

  // rep state machine
  const phaseRef = useRef<'idle' | 'down'>('idle');
  const downAtRef = useRef<number>(0);
  const lastRepAtRef = useRef<number>(0);

  // session
  const startedAtRef = useRef(0);
  const scoresRef = useRef<number[]>([]);
  const mistakesRef = useRef<Record<string, number>>({});

  // motion smoothing
  const emaMotionRef = useRef<number>(0);
  const stableBaselineRef = useRef<number>(0);

  const [running, setRunning] = useState(false);
  const [exercise, setExercise] = useState<ExerciseType>('squat');
  const [reps, setReps] = useState(0);
  const [score, setScore] = useState(0);
  const [cue, setCue] = useState('Ready');
  const [mistakes, setMistakes] = useState<Record<string, number>>({});

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setRunning(false);

    const endedAt = Date.now();
    const repCount = reps;

    if (startedAtRef.current && repCount > 0) {
      const avgScore =
        scoresRef.current.length > 0
          ? Math.round(scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length)
          : 0;

      onSummary({
        id: crypto.randomUUID(),
        exercise,
        startedAt: startedAtRef.current,
        endedAt,
        durationSec: Math.round((endedAt - startedAtRef.current) / 1000),
        reps: repCount,
        avgScore,
        mistakeCounts: mistakesRef.current,
      });
    }
  };

  useEffect(() => () => stop(), []);

  const calcMotion = (cur: Uint8ClampedArray, prev: Uint8ClampedArray, step: number) => {
    let sum = 0;
    // sample only R channel is enough (fast)
    for (let i = 0; i < cur.length; i += step) {
      sum += Math.abs(cur[i] - prev[i]);
    }
    return sum;
  };

  const loop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 360;
    canvas.width = w;
    canvas.height = h;

    ctx.drawImage(video, 0, 0, w, h);
    const frame = ctx.getImageData(0, 0, w, h);

    const now = Date.now();
    const sinceStart = startedAtRef.current ? now - startedAtRef.current : 0;

    let motion = 0;
    if (lastImageRef.current) {
      const step = lowPowerMode ? 96 : 48; // fewer samples = lower CPU, less noise sensitivity
      motion = calcMotion(frame.data, lastImageRef.current.data, step);
    }
    lastImageRef.current = frame;

    // smooth motion using EMA
    const emaPrev = emaMotionRef.current;
    const ema = emaPrev + EMA_ALPHA * (motion - emaPrev);
    emaMotionRef.current = ema;

    // warmup: build a baseline for "stillness" (camera auto exposure settles)
    if (sinceStart < WARMUP_MS) {
      stableBaselineRef.current = Math.max(stableBaselineRef.current, ema);
      setCue('Hold still… calibrating camera.');
      setScore(0);

      rafRef.current = requestAnimationFrame(() => {
        if (lowPowerMode) setTimeout(loop, 90);
        else loop();
      });
      return;
    }

    // adaptive thresholds based on baseline + exercise tuning
    const base = Math.max(8000, stableBaselineRef.current * 1.1); // never too low
    const downFactor = exercise === 'squat' ? 1.9 : 1.6;
    const upFactor = exercise === 'squat' ? 1.25 : 1.15;

    const thresholdDown = base * downFactor;
    const thresholdUp = base * upFactor;

    // update baseline slowly when idle to adapt to lighting
    if (phaseRef.current === 'idle') {
      stableBaselineRef.current = stableBaselineRef.current * 0.98 + ema * 0.02;
    }

    // state machine with duration + cooldown
    const phase = phaseRef.current;

    if (phase === 'idle') {
      if (ema > thresholdDown) {
        phaseRef.current = 'down';
        downAtRef.current = now;
        setCue(exercise === 'squat' ? 'Descending…' : 'Lowering…');
      } else {
        setCue('Ready');
      }
    } else if (phase === 'down') {
      const downFor = now - downAtRef.current;

      // Only count a rep if:
      // 1) motion returns below thresholdUp
      // 2) user stayed down long enough
      // 3) cooldown has passed
      if (
        ema < thresholdUp &&
        downFor >= MIN_DOWN_MS &&
        now - lastRepAtRef.current >= MIN_REP_GAP_MS
      ) {
        lastRepAtRef.current = now;
        phaseRef.current = 'idle';
        setReps((r) => r + 1);
        setCue(exercise === 'squat' ? 'Drive up through your heels.' : 'Press up, keep core tight.');
      }
    }

    // score: 0..100 based on smoothness (less spiky = better)
    // We treat extremely high ema as unstable movement
    let currentScore = 95;
    if (ema > thresholdDown * 1.8) currentScore = 70;
    if (ema > thresholdDown * 2.4) currentScore = 55;

    // if basically still, don’t show 100; show neutral
    if (ema < thresholdUp * 0.9) currentScore = 0;

    setScore(currentScore);

    if (currentScore > 0) scoresRef.current.push(currentScore);

    if (currentScore <= 70 && phaseRef.current !== 'idle') {
      mistakesRef.current = {
        ...mistakesRef.current,
        unstable_movement: (mistakesRef.current.unstable_movement ?? 0) + 1,
      };
      setMistakes(mistakesRef.current);
    }

    // clean overlay (frame border + status line)
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
    ctx.strokeRect(10, 10, w - 20, h - 20);

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(10, 10, 260, 34);
    ctx.fillStyle = 'white';
    ctx.font = '14px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.fillText(
      `Motion: ${Math.round(ema)}  Base: ${Math.round(stableBaselineRef.current)}`,
      20,
      32
    );
    ctx.restore();

    rafRef.current = requestAnimationFrame(() => {
      if (lowPowerMode) setTimeout(loop, 90);
      else loop();
    });
  };

  const start = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      // reset everything (IMPORTANT)
      setReps(0);
      setScore(0);
      setCue('Starting camera…');
      setMistakes({});
      mistakesRef.current = {};
      scoresRef.current = [];

      lastImageRef.current = null;
      emaMotionRef.current = 0;
      stableBaselineRef.current = 0;

      phaseRef.current = 'idle';
      downAtRef.current = 0;
      lastRepAtRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();

      startedAtRef.current = Date.now();
      setRunning(true);

      loop();
    } catch {
      setCue('Camera permission denied or unavailable.');
      setRunning(false);
    }
  };

  // reset counters when exercise changes (prevents old reps)
  useEffect(() => {
    if (!running) return;
    setReps(0);
    setScore(0);
    setCue('Exercise changed. Ready.');
    phaseRef.current = 'idle';
    downAtRef.current = 0;
    lastRepAtRef.current = 0;
    scoresRef.current = [];
    mistakesRef.current = {};
    setMistakes({});
  }, [exercise, running]);

  return (
    <div className="page card">
      <h2>Posture Check</h2>
      <p className="muted">Local camera processing only. No raw video storage.</p>

      <div className="row">
        <select value={exercise} onChange={(e) => setExercise(e.target.value as ExerciseType)}>
          <option value="squat">Squat</option>
          <option value="pushup">Push-up</option>
        </select>

        {!running ? (
          <button onClick={() => void start()}>Start camera</button>
        ) : (
          <button className="danger" onClick={stop}>
            Stop
          </button>
        )}
      </div>

      <div className="stats-grid">
        <div>
          <strong>{reps}</strong>
          <span>Reps</span>
        </div>
        <div>
          <strong>{score}</strong>
          <span>Form score</span>
        </div>
        <div>
          <strong>{cue}</strong>
          <span>Cue</span>
        </div>
      </div>

      <div className="camera-wrap">
        <video ref={videoRef} className="hidden" playsInline />
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}