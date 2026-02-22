import { useMemo, useState } from 'react';
import type { WorkoutSession, WorkoutType } from '../types/workout';

/* ---------------------------------
   DASHBOARD
---------------------------------- */

type QuickAction = {
  title: string;
  desc: string;
  routeHint: string; // display only (routing is in AppShell)
};

export function DashboardPage() {
  const today = useMemo(() => {
    return {
      steps: 7820,
      stepsGoal: 10000,
      calories: 2160,
      caloriesGoal: 2600,
      water: 2.4,
      waterGoal: 3.0,
      streakDays: 12,
      workoutsPlanned: 1,
      sleepHours: 7.1,
      stress: 'Moderate',
      focus: 'Good',
    };
  }, []);

  const pct = (v: number, g: number) => Math.max(0, Math.min(1, v / (g || 1)));

  const rings = [
    { label: 'Steps', value: today.steps, goal: today.stepsGoal, unit: '' },
    { label: 'Calories', value: today.calories, goal: today.caloriesGoal, unit: 'kcal' },
    { label: 'Water', value: today.water, goal: today.waterGoal, unit: 'L' },
  ];

  const quickActions: QuickAction[] = [
    { title: 'Start AI Coaching', desc: 'Ask for a plan, diet, or recovery guidance.', routeHint: 'AI Coach' },
    { title: 'Posture Check', desc: 'Track reps and form with your camera.', routeHint: 'Posture' },
    { title: 'Workout History', desc: 'Review your sessions and trends.', routeHint: 'Tracking' },
  ];

  return (
    <div className="page dashboard">
      {/* HERO */}
      <section className="hero card">
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-left">
            <div className="hero-kicker">Privacy-first. On-device. No cloud required.</div>
            <h2 className="hero-title">Your Health Coach</h2>
            <p className="hero-subtitle">
              Track workouts, improve form, and get local AI guidance — built for real daily use.
            </p>

            <div className="hero-actions">
              <button className="btn btn-primary" type="button">Open AI Coach</button>
              <button className="btn" type="button">Start Posture Check</button>
            </div>

            <div className="hero-meta">
              <div className="meta-chip">
                <div className="meta-label">Streak</div>
                <div className="meta-value">{today.streakDays} days</div>
              </div>
              <div className="meta-chip">
                <div className="meta-label">Planned</div>
                <div className="meta-value">{today.workoutsPlanned} workout</div>
              </div>
              <div className="meta-chip">
                <div className="meta-label">Sleep</div>
                <div className="meta-value">{today.sleepHours} h</div>
              </div>
            </div>
          </div>

          <div className="hero-right">
            <div className="rings card">
              <div className="rings-head">
                <h3>Today</h3>
                <span className="muted">Progress overview</span>
              </div>

              <div className="rings-grid">
                {rings.map((r) => {
                  const p = pct(r.value, r.goal);
                  return (
                    <div key={r.label} className="ring">
                      <div className="ring-visual" style={{ ['--p' as any]: `${Math.round(p * 100)}` }}>
                        <div className="ring-center">
                          <div className="ring-big">
                            {r.value.toLocaleString()}
                            {r.unit ? <span className="ring-unit"> {r.unit}</span> : null}
                          </div>
                          <div className="ring-small">
                            Goal {r.goal.toLocaleString()}
                            {r.unit ? <span> {r.unit}</span> : null}
                          </div>
                        </div>
                      </div>
                      <div className="ring-label">{r.label}</div>
                    </div>
                  );
                })}
              </div>

              <div className="rings-foot muted">Local-only tracking. You control your data.</div>
            </div>
          </div>
        </div>
      </section>

      {/* GRID */}
      <section className="dashboard-grid">
        {/* QUICK ACTIONS */}
        <article className="card">
          <div className="card-head">
            <h3>Quick actions</h3>
            <span className="muted">Jump back in instantly</span>
          </div>

          <div className="qa-grid">
            {quickActions.map((a) => (
              <button key={a.title} className="qa-item" type="button">
                <div className="qa-title">{a.title}</div>
                <div className="qa-desc">{a.desc}</div>
                <div className="qa-hint muted">{a.routeHint}</div>
              </button>
            ))}
          </div>
        </article>

        {/* INSIGHTS */}
        <article className="card">
          <div className="card-head">
            <h3>Insights</h3>
            <span className="muted">Today at a glance</span>
          </div>

          <div className="insights">
            <div className="insight">
              <div className="insight-k">Recovery</div>
              <div className="insight-v">Good</div>
              <div className="insight-s muted">Keep hydration consistent.</div>
            </div>

            <div className="insight">
              <div className="insight-k">Stress</div>
              <div className="insight-v">{today.stress}</div>
              <div className="insight-s muted">Try a 5-min cooldown walk.</div>
            </div>

            <div className="insight">
              <div className="insight-k">Focus</div>
              <div className="insight-v">{today.focus}</div>
              <div className="insight-s muted">Great day for strength work.</div>
            </div>
          </div>
        </article>

        {/* FEATURE STRIP */}
        <article className="card feature">
          <div className="feature-inner">
            <div>
              <h3>Private AI coaching</h3>
              <p className="muted">
                Ask anything about workouts, diet, mobility, or recovery. Your guidance runs locally and stays on-device.
              </p>
            </div>
            <div className="feature-bullets">
              <div className="bullet">
                <div className="bullet-title">No cloud dependency</div>
                <div className="bullet-desc muted">Works even offline once models are ready.</div>
              </div>
              <div className="bullet">
                <div className="bullet-title">Form coaching</div>
                <div className="bullet-desc muted">Camera-based feedback designed for daily practice.</div>
              </div>
              <div className="bullet">
                <div className="bullet-title">History & trends</div>
                <div className="bullet-desc muted">Review sessions and improve over time.</div>
              </div>
            </div>
          </div>
        </article>

        {/* MEDIA SECTION */}
        <article className="card media">
          <div className="media-top">
            <h3>Form preview</h3>
            <span className="muted">A clean, real-world experience</span>
          </div>

          <div className="media-frame" role="img" aria-label="Workout preview media">
            <div className="media-overlay">
              <div className="media-badge">Demo preview</div>
              <div className="media-title">Posture & Reps</div>
              <div className="media-sub muted">Real-time feedback while you train.</div>
            </div>
          </div>

          <div className="media-actions">
            <button className="btn btn-primary" type="button">Start session</button>
            <button className="btn" type="button">View history</button>
          </div>
        </article>
      </section>
    </div>
  );
}

/* ---------------------------------
   WORKOUT HISTORY PAGE
---------------------------------- */

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
        <label>
          Type
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | WorkoutType)}>
            <option value="all">All</option>
            {workoutTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label>
          From <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>

        <label>
          To <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
      </article>

      {filtered.length === 0 ? (
        <div className="card empty">No workout sessions match your filters.</div>
      ) : (
        filtered.map((s) => (
          <article key={s.id} className="card row session-item">
            <div>
              <strong>{String(s.workoutType).toUpperCase()}</strong>
              <p>{new Date(s.date).toLocaleString()}</p>
              <p>
                {Math.round(s.durationSec / 60)} min · {s.reps} reps · {s.calories} kcal · score {s.avgFormScore ?? 'n/a'}
              </p>
            </div>
            <div className="row">
              <button className="btn" onClick={() => setSelected(s)}>Details</button>
              <button
                className="btn danger"
                onClick={() => {
                  if (confirm('Delete this session?')) onDelete(s.id);
                }}
              >
                Delete
              </button>
            </div>
          </article>
        ))
      )}

      {selected && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <article className="card modal">
            <h3>{String(selected.workoutType).toUpperCase()} Session</h3>
            <p>Date: {new Date(selected.date).toLocaleString()}</p>
            <p>Duration: {selected.durationSec}s</p>
            <p>Reps: {selected.reps}</p>
            <p>Calories: {selected.calories}</p>
            <p>Avg Form Score: {selected.avgFormScore ?? 'n/a'}</p>
            {selected.notes && <p>Notes: {selected.notes}</p>}
            <button className="btn" onClick={() => setSelected(null)}>Close</button>
          </article>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------
   WORKOUTS PAGE
---------------------------------- */

export function WorkoutsPage({ plans }: { plans: { id: string; title: string; content: string }[] }) {
  return (
    <div className="page">
      <h2>Workouts & Plans</h2>
      {plans.length === 0 ? (
        <div className="card empty">Saved plans will appear here.</div>
      ) : (
        plans.map((p) => (
          <article key={p.id} className="card">
            <h3>{p.title}</h3>
            <pre>{p.content}</pre>
          </article>
        ))
      )}
    </div>
  );
}

/* ---------------------------------
   SETTINGS PAGE
---------------------------------- */

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
  modelStatus: {
    initialized: boolean;
    modelLoaded: boolean;
    lastInferenceAt: number | null;
    lastError: string | null;
    modelId: string;
  };
}) {
  return (
    <div className="page">
      <h2>Settings</h2>

      <article className="card">
        <h3>Privacy</h3>
        <p>Data stays on this device by default. No raw camera video is persisted.</p>
      </article>

      <article className="card row">
        <span>Auto-speak AI responses</span>
        <button className="btn" onClick={onToggleAutoSpeak}>{autoSpeak ? 'On' : 'Off'}</button>
      </article>

      <article className="card row">
        <span>Low power mode (camera)</span>
        <button className="btn" onClick={onToggleLowPower}>{lowPowerMode ? 'On' : 'Off'}</button>
      </article>

      <article className="card row">
        <span>Sample demo data</span>
        <button className="btn" onClick={onToggleDemoData}>{demoDataEnabled ? 'On' : 'Off'}</button>
      </article>

      <article className="card">
        <h3>Model Status</h3>
        <p>Model ID: <code>{modelStatus.modelId}</code></p>
        <p>SDK initialized: {modelStatus.initialized ? 'Yes' : 'No'}</p>
        <p>Model loaded: {modelStatus.modelLoaded ? 'Yes' : 'No'}</p>
        <p>Last inference: {modelStatus.lastInferenceAt ? new Date(modelStatus.lastInferenceAt).toLocaleString() : 'Never'}</p>
        <p>Last error: {modelStatus.lastError ?? 'None'}</p>
      </article>

      <article className="card">
        <button className="btn btn-primary" onClick={onExport}>Export JSON logs</button>
      </article>
    </div>
  );
}