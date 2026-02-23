import type { ReactNode } from 'react';

export type Route =
  | 'dashboard'
  | 'coach'
  | 'posture'
  | 'tracking'
  | 'workouts'
  | 'nutrition'
  | 'settings';

type IconName =
  | 'home'
  | 'chat'
  | 'camera'
  | 'chart'
  | 'dumbbell'
  | 'nutrition'
  | 'settings'
  | 'sun'
  | 'moon';

function Icon({
  name,
  size = 18,
  className = '',
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg' as const,
    className,
  };

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path
            d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'chat':
      return (
        <svg {...common}>
          <path
            d="M7 18l-3 3V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M8 9h8M8 12h6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'camera':
      return (
        <svg {...common}>
          <path
            d="M7 7h2l1-2h4l1 2h2a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M12 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
            stroke="currentColor"
            strokeWidth="2.2"
          />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path
            d="M4 20V4"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M7 16l4-4 3 3 6-7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M20 8v4h-4"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'dumbbell':
      return (
        <svg {...common}>
          <path
            d="M4 10v4M7 9v6M17 9v6M20 10v4"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M7 12h10"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'nutrition':
      return (
        <svg {...common}>
          <path
            d="M7 21c6 0 10-4 10-10 0-3.5-2-6-5.5-7.5C10 2.8 8.5 4 8.1 5.7 7.4 8.4 5.2 9.7 4 11.4 2.7 13.2 3 21 7 21Z"
            stroke="currentColor"
            strokeWidth="2.0"
            strokeLinejoin="round"
          />
          <path
            d="M9 12c2.5 0 5-1.5 6-4"
            stroke="currentColor"
            strokeWidth="2.0"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <path
            d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="M19.4 15a7.9 7.9 0 0 0 .1-1l2-1.2-2-3.5-2.3.7a7.5 7.5 0 0 0-1.7-1L15 6h-6l-.5 2a7.5 7.5 0 0 0-1.7 1L4.5 8.3l-2 3.5 2 1.2a7.9 7.9 0 0 0 .1 1 7.9 7.9 0 0 0-.1 1l-2 1.2 2 3.5 2.3-.7a7.5 7.5 0 0 0 1.7 1L9 22h6l.5-2a7.5 7.5 0 0 0 1.7-1l2.3.7 2-3.5-2-1.2a7.9 7.9 0 0 0-.1-1Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'sun':
      return (
        <svg {...common}>
          <path
            d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'moon':
      return (
        <svg {...common}>
          <path
            d="M21 13.2A8 8 0 1 1 10.8 3a6.5 6.5 0 0 0 10.2 10.2Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

const navItems: { id: Route; label: string; icon: IconName }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'coach', label: 'AI Coach', icon: 'chat' },
  { id: 'posture', label: 'Posture', icon: 'camera' },
  { id: 'tracking', label: 'Tracking', icon: 'chart' },
  { id: 'workouts', label: 'Workouts', icon: 'dumbbell' },
  { id: 'nutrition', label: 'Nutrition', icon: 'nutrition' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
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
        <div className="brandRow">
          <div className="brandMark" aria-hidden="true" />
          <div>
            <div className="brandTitle">Health Coach</div>
            <div className="brandSub">On-device coaching</div>
          </div>
        </div>

        <nav className="navList">
          {navItems.map((item) => {
            const active = route === item.id;
            return (
              <button
                key={item.id}
                className={active ? 'nav active' : 'nav'}
                onClick={() => onRouteChange(item.id)}
                aria-current={active ? 'page' : undefined}
                type="button"
              >
                <span className="navIconWrap" aria-hidden="true">
                  <Icon name={item.icon} className="navIconSvg" />
                </span>
                <span className="navLabel">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebarFoot">
          <button className="themeToggle" onClick={toggleDarkMode} aria-label="Toggle theme" type="button">
            <span className="navIconWrap" aria-hidden="true">
              <Icon name={darkMode ? 'sun' : 'moon'} className="navIconSvg" />
            </span>
            <span>{darkMode ? 'Light mode' : 'Dark mode'}</span>
          </button>

          <div className="sidebarHint">
            Private by design. Your data stays on this device.
          </div>
        </div>
      </aside>

      <section className="mainContent">
        <div className="topbar">
          <div className="topbarTitle">
            {navItems.find((n) => n.id === route)?.label ?? 'Health Coach'}
          </div>
          <div className="topbarPill">Local</div>
        </div>

        <div className="content">{children}</div>
      </section>

      <nav className="bottomNav" aria-label="Mobile navigation">
        {navItems.map((item) => {
          const active = route === item.id;
          return (
            <button
              key={item.id}
              className={active ? 'bottomItem active' : 'bottomItem'}
              onClick={() => onRouteChange(item.id)}
              aria-current={active ? 'page' : undefined}
              type="button"
            >
              <span className="bottomIcon" aria-hidden="true">
                <Icon name={item.icon} />
              </span>
              <span className="bottomLabel">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}