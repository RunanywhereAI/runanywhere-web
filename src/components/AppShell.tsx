import type { ReactNode } from 'react';

type Route = 'dashboard' | 'coach' | 'posture' | 'tracking' | 'workouts' | 'settings';

const navItems: { id: Route; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'coach', label: 'AI Coach', icon: '💬' },
  { id: 'posture', label: 'Posture', icon: '📷' },
  { id: 'tracking', label: 'Tracking', icon: '📈' },
  { id: 'workouts', label: 'Workouts', icon: '💪' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function AppShell({
  route,
  onRouteChange,
  darkMode,
  toggleDarkMode,
  children,
}: {
  route: Route;
  onRouteChange: (route: Route) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main navigation">
        <h1>Health Coach</h1>
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={route === item.id ? 'nav active' : 'nav'} onClick={() => onRouteChange(item.id)}>
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <button className="secondary" onClick={toggleDarkMode} aria-label="Toggle dark mode">
          {darkMode ? '☀️ Light mode' : '🌙 Dark mode'}
        </button>
      </aside>
      <section className="main-content">{children}</section>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <button key={item.id} className={route === item.id ? 'active' : ''} onClick={() => onRouteChange(item.id)}>
            <span>{item.icon}</span>
            <small>{item.label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}

export type { Route };
