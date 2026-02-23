import { useMemo, useState } from 'react';
import type { WorkoutSession, WorkoutType } from '../../types/workout';
import './workout-history.css';

const workoutTypes: WorkoutType[] = ['squat', 'pushup', 'cardio', 'strength', 'mobility'];

type Props = {
  sessions: WorkoutSession[];
  onDelete: (id: string) => void;
};

export function WorkoutHistoryPage({ sessions, onDelete }: Props) {
  const [typeFilter, setTypeFilter] = useState<'all' | WorkoutType>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState<WorkoutSession | null>(null);

  const filtered = useMemo(() => {
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    return sessions
      .filter((s) => {
        if (typeFilter !== 'all' && s.workoutType !== typeFilter) return false;
        if (fromTs !== null && s.date < fromTs) return false;
        if (toTs !== null && s.date > toTs) return false;
        return true;
      })
      .sort((a, b) => b.date - a.date);
  }, [sessions, typeFilter, fromDate, toDate]);

  const stats = useMemo(() => {
    const totalCalories = filtered.reduce((a, b) => a + (b.calories || 0), 0);
    const totalReps = filtered.reduce((a, b) => a + (b.reps || 0), 0);
    const totalMinutes = Math.round(filtered.reduce((a, b) => a + (b.durationSec || 0), 0) / 60);

    const scored = filtered.filter((s) => typeof s.avgFormScore === 'number') as Array<
      WorkoutSession & { avgFormScore: number }
    >;
    const avgScore = scored.length
      ? Math.round(scored.reduce((a, b) => a + b.avgFormScore, 0) / scored.length)
      : null;

    return { totalCalories, totalReps, totalMinutes, avgScore };
  }, [filtered]);

  return (
    <div className="page wh-page">
      {/* Header */}
      <div className="wh-header card">
        <div className="wh-title">
          <h2>Workout History</h2>
          <p className="muted">Sessions, trends, and performance at a glance.</p>
        </div>

        <div className="wh-filters">
          <label className="wh-field">
            <span className="wh-label">Type</span>
            <select
              className="wh-input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | WorkoutType)}
            >
              <option value="all">All</option>
              {workoutTypes.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="wh-field">
            <span className="wh-label">From</span>
            <input className="wh-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>

          <label className="wh-field">
            <span className="wh-label">To</span>
            <input className="wh-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
        </div>
      </div>

      {/* Stat strip */}
      <div className="wh-stats">
        <div className="wh-stat card">
          <span>Total Sessions</span>
          <strong>{filtered.length}</strong>
        </div>
        <div className="wh-stat card">
          <span>Total Minutes</span>
          <strong>{stats.totalMinutes}</strong>
        </div>
        <div className="wh-stat card">
          <span>Total Calories</span>
          <strong>{stats.totalCalories} kcal</strong>
        </div>
        <div className="wh-stat card">
          <span>Total Reps</span>
          <strong>{stats.totalReps}</strong>
        </div>
        <div className="wh-stat card">
          <span>Avg Form Score</span>
          <strong>{stats.avgScore ?? '—'}</strong>
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card empty">No sessions match your filters.</div>
      ) : (
        <div className="wh-list">
          {filtered.map((s) => (
            <article key={s.id} className="wh-item card">
              <div className="wh-item-left">
                <div className="wh-badge">{String(s.workoutType).toUpperCase()}</div>
                <div className="wh-item-meta">
                  <strong className="wh-item-title">
                    {String(s.workoutType).toUpperCase()} Session
                  </strong>
                  <div className="muted wh-item-sub">{new Date(s.date).toLocaleString()}</div>
                </div>
              </div>

              <div className="wh-chips">
                <span className="wh-chip">{Math.max(1, Math.round(s.durationSec / 60))} min</span>
                <span className="wh-chip">{s.reps} reps</span>
                <span className="wh-chip">{s.calories} kcal</span>
                <span className="wh-chip">Score {s.avgFormScore ?? '—'}</span>
              </div>

              <div className="wh-actions">
                <button className="btn" onClick={() => setSelected(s)} type="button">
                  Details
                </button>
                <button
                  className="btn danger"
                  type="button"
                  onClick={() => {
                    if (confirm('Delete this session?')) onDelete(s.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <div className="wh-modal-backdrop" role="dialog" aria-modal="true">
          <div className="wh-modal card">
            <div className="wh-modal-head">
              <div>
                <h3>{String(selected.workoutType).toUpperCase()} Session</h3>
                <div className="muted">{new Date(selected.date).toLocaleString()}</div>
              </div>
              <button className="btn" onClick={() => setSelected(null)} type="button">
                Close
              </button>
            </div>

            <div className="wh-modal-grid">
              <div className="wh-modal-item">
                <span>Duration</span>
                <strong>{selected.durationSec}s</strong>
              </div>
              <div className="wh-modal-item">
                <span>Reps</span>
                <strong>{selected.reps}</strong>
              </div>
              <div className="wh-modal-item">
                <span>Calories</span>
                <strong>{selected.calories}</strong>
              </div>
              <div className="wh-modal-item">
                <span>Average Form Score</span>
                <strong>{selected.avgFormScore ?? '—'}</strong>
              </div>
            </div>

            {selected.notes && (
              <div className="wh-modal-notes">
                <span>Notes</span>
                <p>{selected.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}