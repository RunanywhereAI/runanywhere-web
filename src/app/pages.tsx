import { useMemo, useState } from 'react';
import type { WorkoutSession, WorkoutType } from '../types/workout';

export function DashboardPage() {
  const cards = [
    ['Steps', '7,820'],
    ['Calories', '2,160'],
    ['Water', '2.4 L'],
    ['Workouts', '1 planned'],
    ['Streak', '12 days'],
  ];
  return (
    <div className="page">
      <h2>Today Summary</h2>
      <div className="card-grid">{cards.map(([k, v]) => <article key={k} className="card"><span>{k}</span><strong>{v}</strong></article>)}</div>
      <article className="card"><h3>Quick actions</h3><p className="muted">Use AI Coach, then review your workout history and form trends.</p></article>
    </div>
  );
}

const workoutTypes: WorkoutType[] = ['squat', 'pushup', 'cardio', 'strength', 'mobility'];

export function WorkoutHistoryPage({
  sessions,
  onDelete,
}: {
  sessions: WorkoutSession[];
  onDelete: (id: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<'all' | WorkoutType>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState<WorkoutSession | null>(null);

  const filtered = useMemo(() => {
    return sessions.filter((session) => {
      if (typeFilter !== 'all' && session.workoutType !== typeFilter) return false;
      if (fromDate && session.date < new Date(fromDate).getTime()) return false;
      if (toDate && session.date > new Date(`${toDate}T23:59:59`).getTime()) return false;
      return true;
    });
  }, [sessions, typeFilter, fromDate, toDate]);

  return (
    <div className="page">
      <h2>Workout History</h2>
      <article className="card filters">
        <label>Type
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | WorkoutType)}>
            <option value="all">All</option>
            {workoutTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label>From <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label>
        <label>To <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></label>
      </article>

      {filtered.length === 0 ? (
        <div className="card empty">No workout sessions match your filters.</div>
      ) : (
        filtered.map((s) => (
          <article key={s.id} className="card row session-item">
            <div>
              <strong>{s.workoutType.toUpperCase()}</strong>
              <p>{new Date(s.date).toLocaleString()}</p>
              <p>{Math.round(s.durationSec / 60)} min · {s.reps} reps · {s.calories} kcal · score {s.avgFormScore ?? 'n/a'}</p>
            </div>
            <div className="row">
              <button className="secondary" onClick={() => setSelected(s)}>Details</button>
              <button className="danger" onClick={() => { if (confirm('Delete this session?')) onDelete(s.id); }}>Delete</button>
            </div>
          </article>
        ))
      )}

      {selected && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="card modal">
            <h3>{selected.workoutType.toUpperCase()} Session</h3>
            <p>Date: {new Date(selected.date).toLocaleString()}</p>
            <p>Duration: {selected.durationSec}s</p>
            <p>Reps: {selected.reps}</p>
            <p>Calories: {selected.calories}</p>
            <p>Avg Form Score: {selected.avgFormScore ?? 'n/a'}</p>
            {selected.notes && <p>Notes: {selected.notes}</p>}
            <button onClick={() => setSelected(null)}>Close</button>
          </article>
        </div>
      )}
    </div>
  );
}

export function WorkoutsPage({ plans }: { plans: { id: string; title: string; content: string }[] }) {
  return (
    <div className="page">
      <h2>Workouts & Plans</h2>
      {plans.length === 0 ? <div className="card empty">Saved plans will appear here.</div> : plans.map((p) => <article key={p.id} className="card"><h3>{p.title}</h3><pre>{p.content}</pre></article>)}
    </div>
  );
}

export function SettingsPage({
  autoSpeak,
  lowPowerMode,
  demoDataEnabled,
  onToggleAutoSpeak,
  onToggleLowPower,
  onToggleDemoData,
  onExport,
  modelStatus,
}: {
  autoSpeak: boolean;
  lowPowerMode: boolean;
  demoDataEnabled: boolean;
  onToggleAutoSpeak: () => void;
  onToggleLowPower: () => void;
  onToggleDemoData: () => void;
  onExport: () => void;
  modelStatus: { initialized: boolean; modelLoaded: boolean; lastInferenceAt: number | null; lastError: string | null; modelId: string };
}) {
  return (
    <div className="page">
      <h2>Settings</h2>
      <article className="card"><h3>Privacy</h3><p>Data stays on this device by default. No raw camera video is persisted.</p></article>
      <article className="card row"><span>Auto-speak AI responses</span><button onClick={onToggleAutoSpeak}>{autoSpeak ? 'On' : 'Off'}</button></article>
      <article className="card row"><span>Low power mode (camera)</span><button onClick={onToggleLowPower}>{lowPowerMode ? 'On' : 'Off'}</button></article>
      <article className="card row"><span>Sample demo data</span><button onClick={onToggleDemoData}>{demoDataEnabled ? 'On' : 'Off'}</button></article>
      <article className="card">
        <h3>Model Status</h3>
        <p>Model ID: <code>{modelStatus.modelId}</code></p>
        <p>SDK initialized: {modelStatus.initialized ? 'Yes' : 'No'}</p>
        <p>Model loaded: {modelStatus.modelLoaded ? 'Yes' : 'No'}</p>
        <p>Last inference: {modelStatus.lastInferenceAt ? new Date(modelStatus.lastInferenceAt).toLocaleString() : 'Never'}</p>
        <p>Last error: {modelStatus.lastError ?? 'None'}</p>
      </article>
      <article className="card"><button onClick={onExport}>Export JSON logs</button></article>
    </div>
  );
}
