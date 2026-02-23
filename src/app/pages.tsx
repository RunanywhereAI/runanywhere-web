import { useEffect, useMemo, useState } from "react";
import type { WorkoutSession, WorkoutType } from "../types/workout";
import type { Route } from "../components/AppShell";

/* ---------------------------------
   DASHBOARD (PREMIUM)
---------------------------------- */

type QuickAction = {
  title: string;
  desc: string;
  routeHint: string;
  route: Route;
};

type PlanTier = "Starter" | "Pro" | "Elite";

type PricingPlan = {
  tier: PlanTier;
  price: number;
  subtitle: string;
  highlight?: boolean;
  includes: string[];
  badge?: string;
};

function inr(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₹${n}`;
  }
}

function pct(v: number, g: number) {
  return Math.max(0, Math.min(1, v / (g || 1)));
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/** tiny sparkline (no libs) */
function Sparkline({ points }: { points: number[] }) {
  const w = 220;
  const h = 64;
  const pad = 8;

  const { d, areaD } = useMemo(() => {
    if (!points.length) return { d: "", areaD: "" };

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = Math.max(1, max - min);

    const step = (w - pad * 2) / Math.max(1, points.length - 1);

    const xy = points.map((p, i) => {
      const x = pad + i * step;
      const y = pad + (1 - (p - min) / range) * (h - pad * 2);
      return { x, y };
    });

    const line = xy
      .map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(" ");

    const area =
      `${line} L ${(pad + (points.length - 1) * step).toFixed(2)} ${(h - pad).toFixed(2)} ` +
      `L ${pad.toFixed(2)} ${(h - pad).toFixed(2)} Z`;

    return { d: line, areaD: area };
  }, [points]);

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Activity chart">
      <defs>
        <linearGradient id="dashGradFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#dashGradFill)" />
      <path d={d} stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function PremiumModal({
  open,
  onClose,
  onBuy,
}: {
  open: boolean;
  onClose: () => void;
  onBuy: (tier: PlanTier) => void;
}) {
  const plans: PricingPlan[] = [
    {
      tier: "Starter",
      price: 3000,
      subtitle: "Good for basic tracking + guidance",
      includes: ["AI Coach chat (local)", "Workout library + schedules", "Basic history (last 30 days)", "Export sessions (JSON)"],
    },
    {
      tier: "Pro",
      price: 6000,
      subtitle: "Best for real daily training",
      highlight: true,
      badge: "Most popular",
      includes: [
        "Everything in Starter",
        "Camera posture check (rep scoring)",
        "Voice coach (speak + response)",
        "Advanced history + trends",
        "Personalized plan builder",
      ],
    },
    {
      tier: "Elite",
      price: 9999,
      subtitle: "Full coaching experience",
      badge: "Best value",
      includes: ["Everything in Pro", "Smart weekly goals + streak coaching", "Recovery insights (sleep + stress)", "Priority model updates", "Premium templates"],
    },
  ];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="card modal" onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>Upgrade to Premium</h3>
            <div className="muted" style={{ lineHeight: 1.45 }}>
              Choose a plan that feels real — posture + voice + history dashboard. Local-first privacy.
            </div>
          </div>
          <button className="btn secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          {plans.map((p) => (
            <div
              key={p.tier}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "1.25rem",
                padding: "1rem",
                background: p.highlight ? "var(--primary-soft)" : "var(--bg)",
                position: "relative",
              }}
            >
              {p.badge ? (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    fontSize: 12,
                    padding: "0.2rem 0.6rem",
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    fontWeight: 700,
                  }}
                >
                  {p.badge}
                </div>
              ) : null}

              <div style={{ fontWeight: 800, fontSize: 14 }}>{p.tier}</div>
              <div style={{ fontWeight: 900, fontSize: 26, marginTop: 8 }}>{inr(p.price)}</div>
              <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                {p.subtitle}
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                {p.includes.map((x) => (
                  <div key={x} className="muted" style={{ fontSize: 13 }}>
                    • {x}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12 }}>
                <button className="btn btn-primary" type="button" onClick={() => onBuy(p.tier)} style={{ width: "100%" }}>
                  Buy {p.tier}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ height: 12 }} />

        <div className="muted" style={{ fontSize: 12, lineHeight: 1.45 }}>
          Note: Payments are UI-only right now. Later you can connect Razorpay/Stripe.
        </div>
      </div>
    </div>
  );
}

export function DashboardPage({ onNavigate }: { onNavigate?: (route: Route) => void }) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const today = useMemo(
    () => ({
      steps: 7820,
      stepsGoal: 10000,
      calories: 2160,
      caloriesGoal: 2600,
      water: 2.4,
      waterGoal: 3.0,
      streakDays: 12,
      workoutsPlanned: 1,
      sleepHours: 7.1,
      stress: "Moderate",
      focus: "Good",
    }),
    []
  );

  const rings = useMemo(
    () => [
      { label: "Steps", value: today.steps, goal: today.stepsGoal, unit: "" },
      { label: "Calories", value: today.calories, goal: today.caloriesGoal, unit: "kcal" },
      { label: "Water", value: today.water, goal: today.waterGoal, unit: "L" },
    ],
    [today]
  );

  const quickActions: QuickAction[] = useMemo(
    () => [
      { title: "Start AI Coaching", desc: "Ask for plan, diet, recovery guidance.", routeHint: "AI Coach", route: "coach" },
      { title: "Posture Check", desc: "Track reps and form with camera.", routeHint: "Posture", route: "posture" },
      { title: "Workout History", desc: "Review sessions and trends.", routeHint: "Tracking", route: "tracking" },
    ],
    []
  );

  const recentSessions = useMemo(() => {
    const now = Date.now();
    return [
      { id: "s1", title: "Lower Strength + Core", date: now - 1 * 86400000, durationMin: 34, score: 86, notes: "Good depth, keep knees stable." },
      { id: "s2", title: "Mobility + Recovery", date: now - 3 * 86400000, durationMin: 22, score: 92, notes: "Smooth tempo. Great control." },
      { id: "s3", title: "Upper Body Push", date: now - 5 * 86400000, durationMin: 29, score: 78, notes: "Neutral neck. Slow reps." },
      { id: "s4", title: "Cardio + Steps", date: now - 7 * 86400000, durationMin: 31, score: 0, notes: "Keep zone-2 pace." },
    ];
  }, []);

  const activityPoints = useMemo(() => {
    const pts = recentSessions
      .slice()
      .reverse()
      .map((s, i) => {
        const score = s.score ? s.score / 100 : 0.6;
        return Math.round(s.durationMin * 2.2 * (0.65 + score * 0.5) + i * 3);
      });

    if (pts.length < 6) {
      const add = Array.from({ length: 6 - pts.length }, (_, i) => (pts[0] ?? 40) - (6 - i) * 4);
      return [...add, ...pts];
    }
    return pts;
  }, [recentSessions]);

  const formatDay = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const buyPlan = (tier: PlanTier) => {
    setUpgradeOpen(false);
    window.alert(`Selected: ${tier} plan`);
  };

  return (
    <div className="page dashboard">
      <section className="hero card">
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-left">
            <div className="hero-kicker">Privacy-first. On-device. No cloud required.</div>
            <h2 className="hero-title">Your Health Coach</h2>
            <p className="hero-subtitle">Track workouts, improve form, and get local AI guidance — built for real daily use.</p>

            <div className="hero-actions">
              <button className="btn btn-primary" type="button" onClick={() => onNavigate?.("coach")}>
                Open AI Coach
              </button>
              <button className="btn" type="button" onClick={() => onNavigate?.("posture")}>
                Start Posture Check
              </button>
              <button className="btn" type="button" onClick={() => setUpgradeOpen(true)}>
                Upgrade
              </button>
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

            <div style={{ marginTop: 14 }}>
              <div className="card-head" style={{ marginBottom: 10 }}>
                <h3>Activity trend</h3>
                <span className="muted">last sessions</span>
              </div>
              <div style={{ color: "var(--primary)" }}>
                <Sparkline points={activityPoints} />
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
                      <div className="ring-visual" style={{ ["--p" as any]: `${Math.round(p * 100)}` }}>
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

            <div style={{ marginTop: 12 }} className="card">
              <div className="card-head">
                <h3>Premium features</h3>
                <span className="muted">unlock</span>
              </div>
              <div className="muted" style={{ lineHeight: 1.5 }}>
                Camera posture + voice coach + advanced history dashboard — all local-first.
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn btn-primary" type="button" onClick={() => setUpgradeOpen(true)}>
                  Compare plans
                </button>
                <button className="btn" type="button" onClick={() => onNavigate?.("tracking")}>
                  View history
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="card">
          <div className="card-head">
            <h3>Quick actions</h3>
            <span className="muted">Jump back in instantly</span>
          </div>

          <div className="qa-grid">
            {quickActions.map((a) => (
              <button key={a.title} className="qa-item" type="button" onClick={() => onNavigate?.(a.route)}>
                <div className="qa-title">{a.title}</div>
                <div className="qa-desc">{a.desc}</div>
                <div className="qa-hint muted">{a.routeHint}</div>
              </button>
            ))}
          </div>
        </article>

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
            <button className="btn btn-primary" type="button" onClick={() => onNavigate?.("posture")}>
              Start session
            </button>
            <button className="btn" type="button" onClick={() => onNavigate?.("tracking")}>
              View history
            </button>
            <button className="btn" type="button" onClick={() => setUpgradeOpen(true)}>
              Upgrade
            </button>
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h3>Recent sessions</h3>
            <span className="muted">last 7 days</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 8px" }}>Date</th>
                  <th style={{ textAlign: "left", padding: "10px 8px" }}>Workout</th>
                  <th style={{ textAlign: "left", padding: "10px 8px" }}>Duration</th>
                  <th style={{ textAlign: "left", padding: "10px 8px" }}>Form</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ fontWeight: 800 }}>{formatDay(s.date)}</div>
                      <div className="muted">{formatTime(s.date)}</div>
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <div style={{ fontWeight: 800 }}>{s.title}</div>
                      <div className="muted">{s.notes}</div>
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <span className="pill">{s.durationMin} min</span>
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {s.score ? <span className="pill">{s.score}/100</span> : <button className="btn" onClick={() => setUpgradeOpen(true)}>Unlock Pro</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <PremiumModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} onBuy={buyPlan} />
    </div>
  );
}

/* ---------------------------------
   WORKOUT HISTORY PAGE
---------------------------------- */

const workoutTypes: WorkoutType[] = ["squat", "pushup", "cardio", "strength", "mobility"];

export function WorkoutHistoryPage({
  sessions = [],
  onDelete,
}: {
  sessions?: WorkoutSession[];
  onDelete: (id: string) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | WorkoutType>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState<WorkoutSession | null>(null);

  const filtered = useMemo(() => {
    return sessions.filter((session) => {
      if (typeFilter !== "all" && session.workoutType !== typeFilter) return false;
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
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | WorkoutType)}>
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
                {Math.round(s.durationSec / 60)} min · {s.reps} reps · {s.calories} kcal · score {s.avgFormScore ?? "n/a"}
              </p>
            </div>
            <div className="row">
              <button className="btn" type="button" onClick={() => setSelected(s)}>
                Details
              </button>
              <button
                className="btn danger"
                type="button"
                onClick={() => {
                  if (window.confirm("Delete this session?")) onDelete(s.id);
                }}
              >
                Delete
              </button>
            </div>
          </article>
        ))
      )}

      {selected && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={() => setSelected(null)}>
          <article className="card modal" onMouseDown={(e) => e.stopPropagation()}>
            <h3>{String(selected.workoutType).toUpperCase()} Session</h3>
            <p>Date: {new Date(selected.date).toLocaleString()}</p>
            <p>Duration: {selected.durationSec}s</p>
            <p>Reps: {selected.reps}</p>
            <p>Calories: {selected.calories}</p>
            <p>Avg Form Score: {selected.avgFormScore ?? "n/a"}</p>
            {selected.notes && <p>Notes: {selected.notes}</p>}
            <button className="btn" type="button" onClick={() => setSelected(null)}>
              Close
            </button>
          </article>
        </div>
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
        <button className="btn" type="button" onClick={onToggleAutoSpeak}>
          {autoSpeak ? "On" : "Off"}
        </button>
      </article>

      <article className="card row">
        <span>Low power mode (camera)</span>
        <button className="btn" type="button" onClick={onToggleLowPower}>
          {lowPowerMode ? "On" : "Off"}
        </button>
      </article>

      <article className="card row">
        <span>Sample demo data</span>
        <button className="btn" type="button" onClick={onToggleDemoData}>
          {demoDataEnabled ? "On" : "Off"}
        </button>
      </article>

      <article className="card">
        <h3>Model Status</h3>
        <p>
          Model ID: <code>{modelStatus.modelId}</code>
        </p>
        <p>SDK initialized: {modelStatus.initialized ? "Yes" : "No"}</p>
        <p>Model loaded: {modelStatus.modelLoaded ? "Yes" : "No"}</p>
        <p>
          Last inference:{" "}
          {modelStatus.lastInferenceAt ? new Date(modelStatus.lastInferenceAt).toLocaleString() : "Never"}
        </p>
        <p>Last error: {modelStatus.lastError ?? "None"}</p>
      </article>

      <article className="card">
        <button className="btn btn-primary" type="button" onClick={onExport}>
          Export JSON logs
        </button>
      </article>
    </div>
  );
}