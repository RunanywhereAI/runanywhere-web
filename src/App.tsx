import { useCallback, useEffect, useMemo, useState } from 'react';

import { AppShell, type Route } from './components/AppShell';

import { CoachPage } from './features/chat/CoachPage';
import { PosturePage } from './features/posture/PosturePage';
import { NutritionPage } from './features/nutrition/NutritionPage';
import { WorkoutsPage } from './features/workouts/WorkoutsPage';
import { WorkoutHistoryPage } from './features/tracking/WorkoutHistoryPage';

import { DashboardPage, SettingsPage } from './app/pages';

import {
  addPostureSession,
  addWorkoutSession,
  createDemoWorkouts,
  loadData,
  saveData,
} from './lib/storage';

import {
  getAccelerationMode,
  getModelStatus,
  init,
} from './lib/runanywhere';

import type { StoredData } from './types/storage';

interface Toast {
  id: string;
  text: string;
  kind: 'error' | 'info';
}

export function App() {

  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<Route>('dashboard');
  const [data, setData] = useState<StoredData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // =========================
  // Toast helper
  // =========================
  const pushToast = useCallback(
    (text: string, kind: 'error' | 'info' = 'info') => {
      const id = crypto.randomUUID();

      setToasts((prev) => [...prev, { id, text, kind }]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    []
  );

  // =========================
  // Dark Mode
  // =========================
  const toggleDarkMode = useCallback(() => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            settings: {
              ...prev.settings,
              darkMode: !prev.settings.darkMode,
            },
          }
        : prev
    );
  }, []);

  // =========================
  // Load local data + init RunAnywhere
  // =========================
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const loaded = await loadData();
        if (cancelled) return;

        setData(loaded);
        document.body.classList.toggle('dark', loaded.settings.darkMode);

        await init();
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // =========================
  // Save local storage on change
  // =========================
  useEffect(() => {
    if (!data) return;

    void saveData(data);

    document.body.classList.toggle('dark', data.settings.darkMode);
  }, [data]);

  const accel = getAccelerationMode();

  // =========================
  // Routing
  // =========================
  const content = useMemo(() => {

    if (!data) return null;

    // Dashboard
    if (route === 'dashboard') {
      return <DashboardPage onNavigate={setRoute} />;
    }

    // Nutrition
    if (route === 'nutrition') {
      return <NutritionPage />;
    }

    // Workouts (NEW senior UI version)
    if (route === 'workouts') {
      return (
        <WorkoutsPage
          plans={data.savedPlans}
          onAddPlan={(newPlan) =>
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    savedPlans: [newPlan, ...prev.savedPlans],
                  }
                : prev
            )
          }
          onDeletePlan={(id) =>
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    savedPlans: prev.savedPlans.filter((p) => p.id !== id),
                  }
                : prev
            )
          }
        />
      );
    }

    // AI Coach
    if (route === 'coach') {
      return (
        <CoachPage
          session={data.chatSession}
          setSession={(updater) =>
            setData((prev) =>
              prev ? { ...prev, chatSession: updater(prev.chatSession) } : prev
            )
          }
          onSavePlan={(title, content) =>
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    savedPlans: [
                      {
                        id: crypto.randomUUID(),
                        title,
                        content,
                        createdAt: Date.now(),
                      },
                      ...prev.savedPlans,
                    ],
                  }
                : prev
            )
          }
          autoSpeak={data.settings.autoSpeak}
          pushToast={pushToast}
        />
      );
    }

    // Posture tracking
    if (route === 'posture') {
      return (
        <PosturePage
          lowPowerMode={data.settings.lowPowerMode}
          onSummary={(summary) =>
            setData((prev) => {
              if (!prev) return prev;

              const durationMin = summary.durationSec / 60;
              const calories = Math.round(
                durationMin * (summary.exercise === 'pushup' ? 9 : 7)
              );

              return {
                ...prev,
                postureSessions: addPostureSession(
                  prev.postureSessions,
                  summary
                ),
                workoutSessions: addWorkoutSession(prev.workoutSessions, {
                  id: crypto.randomUUID(),
                  date: summary.endedAt,
                  workoutType: summary.exercise,
                  durationSec: summary.durationSec,
                  reps: summary.reps,
                  calories,
                  avgFormScore: summary.avgScore,
                }),
              };
            })
          }
        />
      );
    }

    // Tracking history
    if (route === 'tracking') {
      return (
        <WorkoutHistoryPage
          sessions={data.workoutSessions}
          onDelete={(id) =>
            setData((prev) =>
              prev
                ? {
                    ...prev,
                    workoutSessions: prev.workoutSessions.filter(
                      (w) => w.id !== id
                    ),
                  }
                : prev
            )
          }
        />
      );
    }

    // Settings
    return (
      <SettingsPage
        autoSpeak={data.settings.autoSpeak}
        lowPowerMode={data.settings.lowPowerMode}
        demoDataEnabled={data.settings.demoDataEnabled}
        onToggleAutoSpeak={() =>
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  settings: {
                    ...prev.settings,
                    autoSpeak: !prev.settings.autoSpeak,
                  },
                }
              : prev
          )
        }
        onToggleLowPower={() =>
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  settings: {
                    ...prev.settings,
                    lowPowerMode: !prev.settings.lowPowerMode,
                  },
                }
              : prev
          )
        }
        onToggleDemoData={() =>
          setData((prev) => {
            if (!prev) return prev;

            const enabled = !prev.settings.demoDataEnabled;

            return {
              ...prev,
              settings: {
                ...prev.settings,
                demoDataEnabled: enabled,
              },
              workoutSessions: enabled
                ? [...createDemoWorkouts(), ...prev.workoutSessions]
                : prev.workoutSessions,
            };
          })
        }
        onExport={() => {
          const blob = new Blob(
            [JSON.stringify(data, null, 2)],
            { type: 'application/json' }
          );

          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'health-fitness-export.json';
          a.click();

          pushToast('Exported local data to JSON.', 'info');
        }}
        modelStatus={getModelStatus()}
      />
    );
  }, [data, route, pushToast]);

  // =========================
  // Loading States
  // =========================
  if (!ready) return <div className="loading">Loading local app...</div>;
  if (error) return <div className="loading">Failed: {error}</div>;
  if (!data) return <div className="loading">No data.</div>;

  // =========================
  // App Layout
  // =========================
  return (
    <AppShell
      route={route}
      onRouteChange={setRoute}
      darkMode={data.settings.darkMode}
      toggleDarkMode={toggleDarkMode}
    >
      <header className="topbar">
        <span>Acceleration: {accel ?? 'loading'}</span>
      </header>

      {content}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.kind}`}>
            {toast.text}
          </div>
        ))}
      </div>
    </AppShell>
  );
}