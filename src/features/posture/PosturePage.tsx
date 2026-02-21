import { useEffect, useRef, useState } from 'react';
import type { ExerciseType, PostureSummary } from '../../types/posture';

export function PosturePage({ lowPowerMode, onSummary }: { lowPowerMode: boolean; onSummary: (summary: PostureSummary) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastImageRef = useRef<ImageData | null>(null);
  const downRef = useRef(false);
  const startedAtRef = useRef(0);
  const scoresRef = useRef<number[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [running, setRunning] = useState(false);
  const [exercise, setExercise] = useState<ExerciseType>('squat');
  const [reps, setReps] = useState(0);
  const [score, setScore] = useState(100);
  const [cue, setCue] = useState('Ready');
  const [mistakes, setMistakes] = useState<Record<string, number>>({});

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRunning(false);
    const endedAt = Date.now();
    if (startedAtRef.current && reps > 0) {
      onSummary({
        id: crypto.randomUUID(), exercise, startedAt: startedAtRef.current, endedAt,
        durationSec: Math.round((endedAt - startedAtRef.current) / 1000), reps,
        avgScore: Math.round(scoresRef.current.reduce((a, b) => a + b, 0) / Math.max(scoresRef.current.length, 1)),
        mistakeCounts: mistakes,
      });
    }
  };

  useEffect(() => () => stop(), []);

  const loop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let motion = 0;
    if (lastImageRef.current) {
      const cur = frame.data;
      const prev = lastImageRef.current.data;
      for (let i = 0; i < cur.length; i += lowPowerMode ? 64 : 32) {
        motion += Math.abs(cur[i] - prev[i]);
      }
    }
    lastImageRef.current = frame;

    const thresholdDown = exercise === 'squat' ? 18000 : 14000;
    const thresholdUp = exercise === 'squat' ? 10000 : 8000;

    if (motion > thresholdDown && !downRef.current) {
      downRef.current = true;
      setCue(exercise === 'squat' ? 'Descending squat...' : 'Lowering push-up...');
    }
    if (motion < thresholdUp && downRef.current) {
      downRef.current = false;
      setReps((r) => r + 1);
      setCue(exercise === 'squat' ? 'Drive up with your heels.' : 'Press up, keep core tight.');
    }

    let currentScore = 100;
    if (motion > thresholdDown * 1.8) {
      currentScore = 70;
      setMistakes((m) => ({ ...m, unstable_movement: (m.unstable_movement ?? 0) + 1 }));
    }
    scoresRef.current.push(currentScore);
    setScore(currentScore);

    // lightweight overlay
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.strokeRect(canvas.width * 0.35, canvas.height * 0.2, canvas.width * 0.3, canvas.height * 0.65);

    rafRef.current = requestAnimationFrame(() => {
      if (lowPowerMode) setTimeout(loop, 90);
      else loop();
    });
  };

  const start = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      startedAtRef.current = Date.now();
      setReps(0);
      setMistakes({});
      scoresRef.current = [];
      setRunning(true);
      loop();
    } catch {
      setCue('Camera permission denied or unavailable.');
    }
  };

  return (
    <div className="page card">
      <h2>Posture Check</h2>
      <p className="muted">Local camera processing only. No raw video storage.</p>
      <div className="row">
        <select value={exercise} onChange={(e) => setExercise(e.target.value as ExerciseType)}><option value="squat">Squat</option><option value="pushup">Push-up</option></select>
        {!running ? <button onClick={() => void start()}>Start camera</button> : <button className="danger" onClick={stop}>Stop</button>}
      </div>
      <div className="stats-grid"><div><strong>{reps}</strong><span>Reps</span></div><div><strong>{score}</strong><span>Form score</span></div><div><strong>{cue}</strong><span>Cue</span></div></div>
      <div className="camera-wrap"><video ref={videoRef} className="hidden" playsInline /><canvas ref={canvasRef} /></div>
    </div>
  );
}
