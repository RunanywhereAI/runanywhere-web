// src/features/workouts/WorkoutsPage.tsx
import { useEffect, useMemo, useRef, useState } from 'react';

export type WorkoutDay = {
  day: string; // e.g. "Mon"
  title: string; // e.g. "Lower Body Strength"
  durationMin: number;
  focus: string; // e.g. "Quads + Glutes"
  items: { name: string; sets?: number; reps?: string; notes?: string }[];
};

export type SavedPlan = {
  id: string;
  title: string;
  goal: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  daysPerWeek: 3 | 4 | 5 | 6;
  durationWeeks: 2 | 4 | 6 | 8 | 10 | 12;
  targetCalories?: number;
  tags: string[];
  notes?: string;
  createdAt: number;
  schedule: WorkoutDay[];
};

function uid() {
  return (crypto?.randomUUID?.() ?? `id_${Math.random().toString(16).slice(2)}`);
}

function formatDate(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function initials(title: string) {
  const parts = title.trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('');
}

const LEVELS: SavedPlan['level'][] = ['Beginner', 'Intermediate', 'Advanced'];

const DEFAULT_SCHEDULE: WorkoutDay[] = [
  {
    day: 'Mon',
    title: 'Strength A',
    durationMin: 35,
    focus: 'Full Body',
    items: [
      { name: 'Squat', sets: 3, reps: '10–12', notes: 'Controlled tempo' },
      { name: 'Push-up', sets: 3, reps: '8–12', notes: 'Core tight' },
      { name: 'Plank', sets: 3, reps: '30–45s' },
    ],
  },
  {
    day: 'Wed',
    title: 'Mobility + Core',
    durationMin: 25,
    focus: 'Mobility',
    items: [
      { name: 'Hip opener flow', sets: 1, reps: '8–10 min' },
      { name: 'Dead bug', sets: 3, reps: '10–12' },
      { name: 'Glute bridge', sets: 3, reps: '12–15' },
    ],
  },
  {
    day: 'Fri',
    title: 'Strength B',
    durationMin: 35,
    focus: 'Lower + Upper',
    items: [
      { name: 'Split squat', sets: 3, reps: '10 each side' },
      { name: 'Pike push-up', sets: 3, reps: '6–10' },
      { name: 'Side plank', sets: 3, reps: '20–30s each' },
    ],
  },
];

function buildSchedule(daysPerWeek: number): WorkoutDay[] {
  const base = [...DEFAULT_SCHEDULE];
  if (daysPerWeek <= 3) return base.slice(0, 3);

  const extra4: WorkoutDay = {
    day: 'Sat',
    title: 'Cardio + Steps',
    durationMin: 30,
    focus: 'Cardio',
    items: [
      { name: 'Brisk walk / light jog', sets: 1, reps: '20–25 min' },
      { name: 'Cooldown stretch', sets: 1, reps: '5–8 min' },
    ],
  };

  const extra5: WorkoutDay = {
    day: 'Tue',
    title: 'Upper Body',
    durationMin: 30,
    focus: 'Push + Core',
    items: [
      { name: 'Incline push-up', sets: 3, reps: '10–15' },
      { name: 'Chair dips', sets: 3, reps: '8–12' },
      { name: 'Hollow hold', sets: 3, reps: '20–30s' },
    ],
  };

  const extra6: WorkoutDay = {
    day: 'Thu',
    title: 'Lower Body',
    durationMin: 35,
    focus: 'Glutes + Legs',
    items: [
      { name: 'Goblet squat (or bodyweight)', sets: 4, reps: '10–12' },
      { name: 'Calf raises', sets: 4, reps: '12–15' },
      { name: 'Wall sit', sets: 3, reps: '30–45s' },
    ],
  };

  if (daysPerWeek === 4) return [...base, extra4];
  if (daysPerWeek === 5) return [extra5, ...base, extra4];
  return [extra5, ...base, extra6, extra4];
}

function humanTagForGoal(goal: string) {
  const g = goal.toLowerCase();
  if (g.includes('fat') || g.includes('cut') || g.includes('weight loss')) return 'Fat loss';
  if (g.includes('muscle') || g.includes('bulk') || g.includes('strength')) return 'Strength';
  if (g.includes('mobility') || g.includes('flex')) return 'Mobility';
  if (g.includes('cardio') || g.includes('endurance')) return 'Endurance';
  return 'General';
}

function makePlanFromForm(form: {
  title: string;
  goal: string;
  level: SavedPlan['level'];
  daysPerWeek: number;
  durationWeeks: number;
  notes?: string;
}): SavedPlan {
  const tag = humanTagForGoal(form.goal);
  const tags = Array.from(new Set([tag, form.level, `${form.daysPerWeek} days/wk`]));
  return {
    id: uid(),
    title: form.title.trim(),
    goal: form.goal.trim(),
    level: form.level,
    daysPerWeek: clamp(form.daysPerWeek, 3, 6) as SavedPlan['daysPerWeek'],
    durationWeeks: clamp(form.durationWeeks, 2, 12) as SavedPlan['durationWeeks'],
    tags,
    notes: (form.notes ?? '').trim() || undefined,
    createdAt: Date.now(),
    schedule: buildSchedule(form.daysPerWeek),
  };
}

function mergeFromLegacy(plans: { id: string; title: string; content: string }[]): SavedPlan[] {
  return plans.map((p) => {
    let parsed: any = null;
    try {
      parsed = JSON.parse(p.content);
    } catch {
      parsed = null;
    }
    const title = p.title || 'Saved plan';
    const goal = parsed?.goal || 'General fitness';
    const level = (parsed?.level as SavedPlan['level']) || 'Beginner';
    const dpw = Number(parsed?.daysPerWeek ?? 3);
    const weeks = Number(parsed?.durationWeeks ?? 4);

    const base = makePlanFromForm({
      title,
      goal,
      level: LEVELS.includes(level) ? level : 'Beginner',
      daysPerWeek: clamp(dpw, 3, 6),
      durationWeeks: clamp(weeks, 2, 12),
      notes: typeof p.content === 'string' ? p.content : undefined,
    });

    base.id = p.id || base.id;
    return base;
  });
}

function Icon({
  name,
  size = 18,
}: {
  name:
    | 'plus'
    | 'search'
    | 'spark'
    | 'trash'
    | 'clock'
    | 'calendar'
    | 'tag'
    | 'close'
    | 'chev'
    | 'copy'
    | 'download'
    | 'lock'
    | 'shield'
    | 'star';
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg' as const,
  };

  switch (name) {
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <path
            d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'spark':
      return (
        <svg {...common}>
          <path
            d="M12 2l1.2 4.2L17.5 8l-4.3 1.8L12 14l-1.2-4.2L6.5 8l4.3-1.8L12 2Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M19 12l.7 2.5 2.3 1-2.3 1-.7 2.5-.7-2.5-2.3-1 2.3-1L19 12Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common}>
          <path
            d="M9 3h6M4 6h16M7 6l1 15h8l1-15"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M10 10v7M14 10v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <path
            d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <path
            d="M7 3v3M17 3v3M4.5 8h15"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'tag':
      return (
        <svg {...common}>
          <path
            d="M20 13l-7 7-10-10V3h7l10 10Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M7.5 7.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'chev':
      return (
        <svg {...common}>
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'copy':
      return (
        <svg {...common}>
          <path
            d="M9 9h10v12H9V9Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'download':
      return (
        <svg {...common}>
          <path d="M12 3v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...common}>
          <path
            d="M7 11V8a5 5 0 0 1 10 0v3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M6 11h12v10H6V11Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path
            d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M9.5 12l1.7 1.7 3.6-3.6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'star':
      return (
        <svg {...common}>
          <path
            d="M12 3.2l2.6 5.4 6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.4 9.5l6-.9L12 3.2Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

function Chip({ children }: { children: string }) {
  return <span className="wChip">{children}</span>;
}

function Modal({
  title,
  children,
  onClose,
  footer,
  subtitle,
  size = 'lg',
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  subtitle?: string;
  size?: 'md' | 'lg';
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div className="wModalBg" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div
        className={`wModal ${size === 'md' ? 'wModalMd' : ''}`}
        tabIndex={-1}
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="wModalHead">
          <div>
            <div className="wModalTitle">{title}</div>
            <div className="wModalSub">{subtitle ?? 'Local plans. Export anytime.'}</div>
          </div>
          <button className="wIconBtn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="wModalBody">{children}</div>
        {footer ? <div className="wModalFoot">{footer}</div> : null}
      </div>
    </div>
  );
}

function exportPlan(plan: SavedPlan) {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${plan.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'plan'}.json`;
  a.click();
}

function copyToClipboard(text: string) {
  void navigator.clipboard?.writeText(text);
}

/** -------- Pricing models -------- */
type PricingPlan = {
  id: 'starter' | 'pro' | 'elite';
  name: string;
  priceInr: number;
  badge?: string;
  tagline: string;
  includes: string[];
  notIncludes?: string[];
};

function inr(n: number) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `₹${n}`;
  }
}

const PRICING: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceInr: 3000,
    tagline: 'Perfect to begin with structure.',
    includes: [
      'Personalized workout plan builder',
      'Workout library + saved schedules',
      'Progress notes + plan export (JSON)',
      'Basic AI Q&A (fitness + nutrition)',
      'Email support',
    ],
    notIncludes: ['Posture camera analysis', 'Voice coach', 'Workout history dashboard'],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceInr: 6000,
    badge: 'Most Popular',
    tagline: 'Best value for serious consistency.',
    includes: [
      'Everything in Starter',
      'Posture camera analysis (real-time)',
      'Voice coach + hands-free Q&A',
      'Workout history dashboard',
      'Smart reminders + streak tracking',
      'Priority support',
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
    priceInr: 9000,
    badge: 'All Access',
    tagline: 'For maximum coaching + insights.',
    includes: [
      'Everything in Pro',
      'Advanced form scoring + tips',
      'Custom plan templates (cut/bulk/recomp)',
      'Weekly AI check-ins + recovery hints',
      'Early access features',
    ],
  },
];

export function WorkoutsPage({
  plans,
  onAddPlan,
  onDeletePlan,
}: {
  plans: any[];
  onAddPlan?: (plan: { id: string; title: string; content: string; createdAt: number }) => void;
  onDeletePlan?: (id: string) => void;
}) {
  const normalized: SavedPlan[] = useMemo(() => {
    if (!plans || plans.length === 0) return [];
    if (plans[0]?.schedule && plans[0]?.daysPerWeek) return plans as SavedPlan[];
    return mergeFromLegacy(plans as { id: string; title: string; content: string }[]);
  }, [plans]);

  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<'all' | SavedPlan['level']>('all');
  const [days, setDays] = useState<'all' | 3 | 4 | 5 | 6>('all');
  const [sort, setSort] = useState<'newest' | 'title' | 'goal'>('newest');

  const [createOpen, setCreateOpen] = useState(false);
  const [viewPlan, setViewPlan] = useState<SavedPlan | null>(null);

  // NEW: pricing modal + checkout confirm
  const [pricingOpen, setPricingOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan>(PRICING[1]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [promo, setPromo] = useState('');

  const [form, setForm] = useState({
    title: '',
    goal: 'Fat loss',
    level: 'Beginner' as SavedPlan['level'],
    daysPerWeek: 4,
    durationWeeks: 4,
    notes: '',
  });

  const filtered = useMemo(() => {
    let out = [...normalized];

    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((p) => {
        const hay = `${p.title} ${p.goal} ${p.tags.join(' ')} ${p.notes ?? ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    if (level !== 'all') out = out.filter((p) => p.level === level);
    if (days !== 'all') out = out.filter((p) => p.daysPerWeek === days);

    out.sort((a, b) => {
      if (sort === 'newest') return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      if (sort === 'title') return a.title.localeCompare(b.title);
      return a.goal.localeCompare(b.goal);
    });

    return out;
  }, [normalized, query, level, days, sort]);

  const stats = useMemo(() => {
    const total = normalized.length;
    const week = normalized.reduce((acc, p) => acc + (p.daysPerWeek ?? 0), 0);
    const avgDays = total ? (week / total) : 0;
    const recent = normalized.slice().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
    return { total, avgDays: Number(avgDays.toFixed(1)), recentTitle: recent?.title ?? '—' };
  }, [normalized]);

  const handleCreate = () => {
    const plan = makePlanFromForm({
      title: form.title || 'Custom Plan',
      goal: form.goal,
      level: form.level,
      daysPerWeek: form.daysPerWeek,
      durationWeeks: form.durationWeeks,
      notes: form.notes,
    });

    const storagePlan = {
      id: plan.id,
      title: plan.title,
      content: JSON.stringify(plan, null, 2),
      createdAt: plan.createdAt,
    };

    onAddPlan?.(storagePlan);
    setCreateOpen(false);
    setForm({
      title: '',
      goal: 'Fat loss',
      level: 'Beginner',
      daysPerWeek: 4,
      durationWeeks: 4,
      notes: '',
    });
  };

  const empty = normalized.length === 0;

  // Fake checkout for now (UI only)
  const finalPrice = useMemo(() => {
    const code = promo.trim().toUpperCase();
    let discount = 0;
    if (code === 'FIT10') discount = 0.10;
    if (code === 'NEW15') discount = 0.15;
    const base = selectedPlan.priceInr;
    return Math.max(0, Math.round(base * (1 - discount)));
  }, [promo, selectedPlan.priceInr]);

  return (
    <div className="workoutsWrap">
      <style>{`
        :root{
          --w-bg: #0b1020;
          --w-card: rgba(255,255,255,.06);
          --w-card2: rgba(255,255,255,.08);
          --w-border: rgba(255,255,255,.10);
          --w-text: rgba(255,255,255,.92);
          --w-muted: rgba(255,255,255,.68);
          --w-dim: rgba(255,255,255,.52);
          --w-shadow: 0 18px 45px rgba(0,0,0,.35);
          --w-shadow2: 0 10px 25px rgba(0,0,0,.26);
          --w-radius: 18px;
          --w-radius2: 14px;
          --w-focus: 0 0 0 4px rgba(99,102,241,.25);
        }
        body:not(.dark){
          --w-bg: #f6f7fb;
          --w-card: rgba(16,24,40,.04);
          --w-card2: rgba(16,24,40,.06);
          --w-border: rgba(16,24,40,.10);
          --w-text: rgba(16,24,40,.92);
          --w-muted: rgba(16,24,40,.66);
          --w-dim: rgba(16,24,40,.52);
          --w-shadow: 0 18px 45px rgba(16,24,40,.10);
          --w-shadow2: 0 10px 25px rgba(16,24,40,.10);
          --w-focus: 0 0 0 4px rgba(99,102,241,.18);
        }

        .workoutsWrap{
          padding: 20px 20px 24px;
          max-width: 1200px;
          margin: 0 auto;
          color: var(--w-text);
        }

        .wTop{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 14px;
          margin-bottom: 16px;
        }
        .wTitle{
          display:flex;
          flex-direction:column;
          gap: 6px;
        }
        .wTitle h2{
          margin:0;
          font-size: 24px;
          letter-spacing: -0.02em;
        }
        .wTitle p{
          margin:0;
          color: var(--w-muted);
        }

        .wActions{
          display:flex;
          gap: 10px;
          align-items:center;
          flex-wrap: wrap;
          justify-content:flex-end;
        }

        .wBtn{
          appearance:none;
          border:1px solid var(--w-border);
          background: var(--w-card);
          color: var(--w-text);
          padding: 10px 12px;
          border-radius: 14px;
          cursor:pointer;
          display:inline-flex;
          align-items:center;
          gap: 8px;
          box-shadow: var(--w-shadow2);
          transition: transform .12s ease, background .12s ease, border-color .12s ease;
          user-select:none;
          font-weight: 600;
        }
        .wBtn:hover{ transform: translateY(-1px); background: var(--w-card2); }
        .wBtn:active{ transform: translateY(0px); }
        .wBtn:focus{ outline:none; box-shadow: var(--w-shadow2), var(--w-focus); }

        .wBtnPrimary{
          border-color: rgba(99,102,241,.35);
          background: linear-gradient(135deg, rgba(99,102,241,.95), rgba(79,70,229,.85));
          color: white;
        }
        body:not(.dark) .wBtnPrimary{
          background: linear-gradient(135deg, rgba(99,102,241,.95), rgba(79,70,229,.95));
        }

        /* NEW: Secondary gradient for pricing button */
        .wBtnAccent{
          border-color: rgba(34,197,94,.30);
          background: linear-gradient(135deg, rgba(34,197,94,.95), rgba(16,185,129,.80));
          color: white;
        }

        .wGrid{
          display:grid;
          grid-template-columns: 1.35fr .65fr;
          gap: 14px;
        }
        @media (max-width: 980px){
          .wGrid{ grid-template-columns: 1fr; }
        }

        .wPanel{
          border:1px solid var(--w-border);
          background: var(--w-card);
          border-radius: var(--w-radius);
          box-shadow: var(--w-shadow);
          overflow:hidden;
        }

        .wPanelHead{
          padding: 14px 14px 0;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
        }
        .wPanelHead h3{
          margin:0;
          font-size: 14px;
          letter-spacing: .02em;
          text-transform: uppercase;
          color: var(--w-muted);
        }

        .wFilters{
          padding: 12px 14px 14px;
          display:grid;
          grid-template-columns: 1.2fr .8fr .7fr .8fr;
          gap: 10px;
        }
        @media (max-width: 980px){
          .wFilters{ grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 520px){
          .wFilters{ grid-template-columns: 1fr; }
        }

        .wField{
          display:flex;
          flex-direction:column;
          gap: 6px;
        }
        .wLabel{
          font-size: 12px;
          color: var(--w-muted);
        }
        .wInput, .wSelect{
          border:1px solid var(--w-border);
          background: rgba(0,0,0,0);
          color: var(--w-text);
          border-radius: 14px;
          padding: 10px 12px;
          outline:none;
        }
        body:not(.dark) .wInput, body:not(.dark) .wSelect{
          background: rgba(255,255,255,.6);
        }
        .wInput:focus, .wSelect:focus{
          box-shadow: var(--w-focus);
          border-color: rgba(99,102,241,.35);
        }

        .wSearch{
          position:relative;
        }
        .wSearch svg{
          position:absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--w-dim);
        }
        .wSearch input{
          padding-left: 38px;
        }

        .wList{
          padding: 0 14px 14px;
          display:grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 520px){
          .wList{ grid-template-columns: 1fr; }
        }

        .wCard{
          border:1px solid var(--w-border);
          background: linear-gradient(180deg, var(--w-card2), var(--w-card));
          border-radius: var(--w-radius);
          padding: 14px;
          box-shadow: var(--w-shadow2);
          cursor:pointer;
          transition: transform .12s ease, border-color .12s ease, background .12s ease;
          position:relative;
          overflow:hidden;
        }
        .wCard:hover{
          transform: translateY(-2px);
          border-color: rgba(99,102,241,.35);
          background: linear-gradient(180deg, rgba(99,102,241,.12), var(--w-card));
        }

        .wCardTop{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        .wAvatar{
          width: 40px;
          height: 40px;
          border-radius: 14px;
          display:grid;
          place-items:center;
          font-weight: 800;
          color: white;
          background: linear-gradient(135deg, rgba(99,102,241,.95), rgba(34,197,94,.85));
          box-shadow: 0 10px 25px rgba(0,0,0,.25);
          flex: 0 0 auto;
        }
        body:not(.dark) .wAvatar{
          box-shadow: 0 10px 25px rgba(16,24,40,.12);
        }

        .wCardTitle{
          margin:0;
          font-size: 16px;
          letter-spacing: -0.01em;
        }
        .wCardGoal{
          margin: 6px 0 0;
          color: var(--w-muted);
          font-size: 13px;
          line-height: 1.35;
        }

        .wMetaRow{
          display:flex;
          gap: 10px;
          flex-wrap:wrap;
          margin-top: 12px;
          color: var(--w-muted);
          font-size: 12px;
        }

        .wMeta{
          display:inline-flex;
          gap: 6px;
          align-items:center;
          border:1px solid var(--w-border);
          background: rgba(0,0,0,0);
          padding: 7px 10px;
          border-radius: 999px;
        }

        .wChipRow{
          display:flex;
          flex-wrap:wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .wChip{
          border:1px solid var(--w-border);
          background: rgba(0,0,0,0);
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          color: var(--w-text);
        }

        .wRight{
          padding: 14px;
          display:flex;
          flex-direction:column;
          gap: 12px;
        }

        .wStatCard{
          border:1px solid var(--w-border);
          background: linear-gradient(180deg, rgba(99,102,241,.10), var(--w-card));
          border-radius: var(--w-radius);
          padding: 14px;
          box-shadow: var(--w-shadow2);
        }
        .wStatTitle{
          margin:0;
          font-size: 13px;
          color: var(--w-muted);
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .wStatBig{
          margin: 10px 0 2px;
          font-size: 28px;
          letter-spacing: -0.03em;
          font-weight: 800;
        }
        .wStatSmall{
          color: var(--w-muted);
          font-size: 13px;
        }

        .wTip{
          border:1px solid var(--w-border);
          background: var(--w-card);
          border-radius: var(--w-radius);
          padding: 14px;
        }
        .wTip h4{
          margin:0 0 6px;
          font-size: 14px;
        }
        .wTip p{
          margin:0;
          color: var(--w-muted);
          font-size: 13px;
          line-height: 1.5;
        }

        .wEmpty{
          padding: 26px 14px 18px;
          border:1px dashed var(--w-border);
          border-radius: var(--w-radius);
          margin: 0 14px 14px;
          color: var(--w-muted);
          text-align:center;
        }
        .wEmpty strong{
          color: var(--w-text);
        }

        /* Modal */
        .wModalBg{
          position:fixed;
          inset:0;
          background: rgba(0,0,0,.55);
          display:flex;
          align-items:center;
          justify-content:center;
          padding: 18px;
          z-index: 50;
          backdrop-filter: blur(8px);
        }
        body:not(.dark) .wModalBg{
          background: rgba(15,23,42,.45);
        }
        .wModal{
          width:min(920px, 100%);
          max-height: 86vh;
          overflow:auto;
          border:1px solid var(--w-border);
          background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
          border-radius: 22px;
          box-shadow: var(--w-shadow);
        }
        body:not(.dark) .wModal{
          background: #ffffff;
        }
        .wModalMd{
          width: min(640px, 100%);
        }
        .wModalHead{
          padding: 14px 14px 10px;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 10px;
          border-bottom: 1px solid var(--w-border);
        }
        .wModalTitle{
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .wModalSub{
          margin-top: 4px;
          font-size: 13px;
          color: var(--w-muted);
        }
        .wIconBtn{
          border:1px solid var(--w-border);
          background: rgba(0,0,0,0);
          color: var(--w-text);
          border-radius: 14px;
          padding: 9px;
          cursor:pointer;
        }
        .wIconBtn:hover{
          background: var(--w-card);
        }
        .wModalBody{
          padding: 14px;
        }
        .wModalFoot{
          padding: 12px 14px;
          border-top: 1px solid var(--w-border);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          flex-wrap: wrap;
        }

        .wSchedule{
          display:grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-top: 12px;
        }
        @media (max-width: 720px){
          .wSchedule{ grid-template-columns: 1fr; }
        }
        .wDay{
          border:1px solid var(--w-border);
          background: var(--w-card);
          border-radius: var(--w-radius);
          padding: 12px;
        }
        .wDayTop{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 10px;
          margin-bottom: 8px;
        }
        .wDayTitle{
          font-weight: 800;
          letter-spacing: -0.01em;
        }
        .wDayMeta{
          color: var(--w-muted);
          font-size: 12px;
          margin-top: 2px;
        }
        .wListItems{
          margin-top: 10px;
          display:flex;
          flex-direction:column;
          gap: 8px;
        }
        .wItem{
          border:1px solid var(--w-border);
          border-radius: 14px;
          padding: 10px;
          background: rgba(0,0,0,0);
        }
        .wItemName{
          font-weight: 700;
        }
        .wItemSub{
          margin-top: 3px;
          font-size: 12px;
          color: var(--w-muted);
          line-height: 1.35;
        }

        .wForm{
          display:grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 10px;
        }
        @media (max-width: 720px){
          .wForm{ grid-template-columns: 1fr; }
        }
        .wTextArea{
          min-height: 92px;
          resize: vertical;
        }

        .wDanger{
          border-color: rgba(239,68,68,.35);
          background: rgba(239,68,68,.12);
          color: var(--w-text);
        }
        body:not(.dark) .wDanger{
          background: rgba(239,68,68,.10);
        }

        /* -------- PRICING (NEW) -------- */
        .wPricingHero{
          border: 1px solid var(--w-border);
          border-radius: 18px;
          padding: 14px;
          background: radial-gradient(800px 300px at 20% 0%, rgba(99,102,241,.28), transparent 60%),
                      radial-gradient(700px 260px at 90% 20%, rgba(34,197,94,.22), transparent 55%),
                      linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
          box-shadow: var(--w-shadow2);
        }

        .wPricingTop{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .wPricingTop h3{
          margin:0;
          font-size: 18px;
          letter-spacing: -0.02em;
        }
        .wPricingTop p{
          margin: 6px 0 0;
          color: var(--w-muted);
          font-size: 13px;
          line-height: 1.5;
          max-width: 520px;
        }

        .wPricingGrid{
          margin-top: 12px;
          display:grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap: 12px;
        }
        @media (max-width: 860px){
          .wPricingGrid{ grid-template-columns: 1fr; }
        }

        .wPriceCard{
          border: 1px solid var(--w-border);
          border-radius: 18px;
          padding: 14px;
          background: rgba(0,0,0,0);
          transition: transform .12s ease, border-color .12s ease, background .12s ease;
          cursor:pointer;
          position:relative;
          overflow:hidden;
          box-shadow: 0 12px 30px rgba(0,0,0,.22);
        }
        body:not(.dark) .wPriceCard{
          box-shadow: 0 12px 30px rgba(16,24,40,.10);
        }

        .wPriceCard:hover{
          transform: translateY(-2px);
          border-color: rgba(99,102,241,.35);
          background: rgba(255,255,255,.04);
        }
        .wPriceCardActive{
          border-color: rgba(34,197,94,.45);
          background: rgba(34,197,94,.08);
        }

        .wBadge{
          position:absolute;
          top: 12px;
          right: 12px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          color: white;
          background: linear-gradient(135deg, rgba(99,102,241,.95), rgba(34,197,94,.90));
          box-shadow: 0 10px 24px rgba(0,0,0,.22);
        }

        .wPriceName{
          font-weight: 900;
          letter-spacing: -0.01em;
          font-size: 16px;
        }
        .wPriceLine{
          margin-top: 10px;
          display:flex;
          align-items:flex-end;
          gap: 8px;
        }
        .wPrice{
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -0.03em;
          line-height: 1;
        }
        .wPriceSmall{
          color: var(--w-muted);
          font-size: 12px;
          padding-bottom: 3px;
        }
        .wTagline{
          margin-top: 8px;
          color: var(--w-muted);
          font-size: 13px;
          line-height: 1.45;
        }

        .wFeat{
          margin-top: 12px;
          display:flex;
          flex-direction:column;
          gap: 8px;
        }
        .wFeatRow{
          display:flex;
          gap: 10px;
          align-items:flex-start;
          font-size: 13px;
          color: var(--w-text);
        }
        .wFeatDot{
          width: 8px;
          height: 8px;
          border-radius: 999px;
          margin-top: 6px;
          background: rgba(34,197,94,.9);
          flex: 0 0 auto;
          box-shadow: 0 0 0 4px rgba(34,197,94,.12);
        }
        .wFeatOff{
          color: var(--w-muted);
        }
        .wFeatOff .wFeatDot{
          background: rgba(255,255,255,.25);
          box-shadow: none;
        }

        .wCheckoutRow{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid var(--w-border);
        }

        .wTrust{
          display:flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items:center;
          color: var(--w-muted);
          font-size: 12px;
        }
        .wTrustItem{
          display:inline-flex;
          align-items:center;
          gap: 7px;
          border: 1px solid var(--w-border);
          padding: 8px 10px;
          border-radius: 999px;
          background: rgba(0,0,0,0);
        }

        .wDivider{
          height: 1px;
          background: var(--w-border);
          margin: 12px 0;
        }

        .wSummary{
          border: 1px solid var(--w-border);
          border-radius: 18px;
          padding: 12px;
          background: rgba(255,255,255,.03);
        }
        body:not(.dark) .wSummary{
          background: rgba(16,24,40,.03);
        }
        .wSummaryTop{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .wSummaryTitle{
          font-weight: 900;
          letter-spacing: -0.01em;
        }
        .wSummaryPrice{
          font-weight: 900;
        }

        .wPromoRow{
          margin-top: 10px;
          display:flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items:flex-end;
        }
        .wPromoRow input{
          flex: 1 1 220px;
        }
        .wHint{
          margin-top: 8px;
          font-size: 12px;
          color: var(--w-muted);
        }

      `}</style>

      <div className="wTop">
        <div className="wTitle">
          <h2>Workouts and Plans</h2>
          <p>Create, organize, and review training plans stored on your device.</p>
        </div>

        <div className="wActions">
          <button className="wBtn wBtnAccent" type="button" onClick={() => setPricingOpen(true)}>
            <Icon name="star" />
            <span>Upgrade</span>
          </button>

          <button className="wBtn" type="button" onClick={() => setCreateOpen(true)}>
            <Icon name="plus" />
            <span>New plan</span>
          </button>

          <button className="wBtn wBtnPrimary" type="button" onClick={() => setCreateOpen(true)}>
            <Icon name="spark" />
            <span>Build a plan</span>
          </button>
        </div>
      </div>

      <div className="wGrid">
        {/* Left */}
        <div className="wPanel">
          <div className="wPanelHead">
            <h3>Library</h3>
            <div style={{ color: 'var(--w-muted)', fontSize: 12 }}>
              {filtered.length} shown
            </div>
          </div>

          <div className="wFilters">
            <div className="wField wSearch">
              <div className="wLabel">Search</div>
              <Icon name="search" />
              <input
                className="wInput"
                placeholder="Plan title, goal, tags"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="wField">
              <div className="wLabel">Level</div>
              <select className="wSelect" value={level} onChange={(e) => setLevel(e.target.value as any)}>
                <option value="all">All</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div className="wField">
              <div className="wLabel">Days/week</div>
              <select className="wSelect" value={days} onChange={(e) => setDays(e.target.value as any)}>
                <option value="all">All</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
                <option value={6}>6</option>
              </select>
            </div>

            <div className="wField">
              <div className="wLabel">Sort</div>
              <select className="wSelect" value={sort} onChange={(e) => setSort(e.target.value as any)}>
                <option value="newest">Newest</option>
                <option value="title">Title</option>
                <option value="goal">Goal</option>
              </select>
            </div>
          </div>

          {empty ? (
            <div className="wEmpty">
              <strong>No saved plans yet.</strong>
              <div style={{ marginTop: 6 }}>
                Create your first plan to see it here.
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="wBtn wBtnPrimary" type="button" onClick={() => setCreateOpen(true)}>
                  <Icon name="plus" />
                  <span>Create plan</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="wList">
              {filtered.map((p) => (
                <div key={p.id} className="wCard" onClick={() => setViewPlan(p)} role="button" tabIndex={0}>
                  <div className="wCardTop">
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div className="wAvatar">{initials(p.title)}</div>
                      <div>
                        <div className="wCardTitle">{p.title}</div>
                        <div className="wCardGoal">{p.goal}</div>
                      </div>
                    </div>

                    <div style={{ color: 'var(--w-dim)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatDate(p.createdAt).split(',')[0]}
                    </div>
                  </div>

                  <div className="wChipRow">
                    {p.tags.slice(0, 3).map((t) => (
                      <Chip key={t}>{t}</Chip>
                    ))}
                  </div>

                  <div className="wMetaRow">
                    <span className="wMeta">
                      <Icon name="calendar" size={16} />
                      <span>{p.durationWeeks} weeks</span>
                    </span>
                    <span className="wMeta">
                      <Icon name="clock" size={16} />
                      <span>{p.daysPerWeek} days/week</span>
                    </span>
                    <span className="wMeta">
                      <Icon name="tag" size={16} />
                      <span>{p.level}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right */}
        <div className="wRight">
          <div className="wStatCard">
            <div className="wStatTitle">Plans</div>
            <div className="wStatBig">{stats.total}</div>
            <div className="wStatSmall">Average {stats.avgDays} days/week</div>
          </div>

          <div className="wStatCard">
            <div className="wStatTitle">Most recent</div>
            <div className="wStatBig" style={{ fontSize: 20, lineHeight: 1.2, marginTop: 10 }}>
              {stats.recentTitle}
            </div>
            <div className="wStatSmall">Tap a card to view full schedule</div>
          </div>

          <div className="wTip">
            <h4>Tip</h4>
            <p>
              Keep plans simple. Train consistently 3–5 days/week, track form with posture check, and update your plan every 4 weeks.
            </p>
          </div>
        </div>
      </div>

      {/* Create modal */}
      {createOpen && (
        <Modal
          title="Create a plan"
          onClose={() => setCreateOpen(false)}
          footer={
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <button className="wBtn" type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button
                className="wBtn wBtnPrimary"
                type="button"
                onClick={handleCreate}
                disabled={!form.title.trim()}
              >
                <Icon name="spark" />
                <span>Create</span>
              </button>
            </div>
          }
        >
          <div className="wForm">
            <div className="wField">
              <div className="wLabel">Plan title</div>
              <input
                className="wInput"
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="Example: 4-week strength and fat loss"
              />
            </div>

            <div className="wField">
              <div className="wLabel">Goal</div>
              <input
                className="wInput"
                value={form.goal}
                onChange={(e) => setForm((s) => ({ ...s, goal: e.target.value }))}
                placeholder="Example: Fat loss, strength, mobility"
              />
            </div>

            <div className="wField">
              <div className="wLabel">Level</div>
              <select
                className="wSelect"
                value={form.level}
                onChange={(e) => setForm((s) => ({ ...s, level: e.target.value as SavedPlan['level'] }))}
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div className="wField">
              <div className="wLabel">Days/week</div>
              <select
                className="wSelect"
                value={form.daysPerWeek}
                onChange={(e) => setForm((s) => ({ ...s, daysPerWeek: Number(e.target.value) }))}
              >
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
                <option value={6}>6</option>
              </select>
            </div>

            <div className="wField">
              <div className="wLabel">Duration</div>
              <select
                className="wSelect"
                value={form.durationWeeks}
                onChange={(e) => setForm((s) => ({ ...s, durationWeeks: Number(e.target.value) }))}
              >
                <option value={2}>2 weeks</option>
                <option value={4}>4 weeks</option>
                <option value={6}>6 weeks</option>
                <option value={8}>8 weeks</option>
                <option value={10}>10 weeks</option>
                <option value={12}>12 weeks</option>
              </select>
            </div>

            <div className="wField" style={{ gridColumn: '1 / -1' }}>
              <div className="wLabel">Notes (optional)</div>
              <textarea
                className="wInput wTextArea"
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                placeholder="Example: Knee discomfort — keep squat depth comfortable. Add 10-min walk after dinner."
              />
            </div>

            <div style={{ gridColumn: '1 / -1', color: 'var(--w-muted)', fontSize: 12, lineHeight: 1.4 }}>
              This creates a local plan with a default schedule. You can replace schedule items later with AI-generated content.
            </div>
          </div>
        </Modal>
      )}

      {/* View plan modal */}
      {viewPlan && (
        <Modal
          title={viewPlan.title}
          onClose={() => setViewPlan(null)}
          footer={
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className="wBtn"
                  type="button"
                  onClick={() => {
                    copyToClipboard(JSON.stringify(viewPlan, null, 2));
                  }}
                >
                  <Icon name="copy" />
                  <span>Copy JSON</span>
                </button>

                <button className="wBtn" type="button" onClick={() => exportPlan(viewPlan)}>
                  <Icon name="download" />
                  <span>Export</span>
                </button>
              </div>

              <button
                className="wBtn wDanger"
                type="button"
                onClick={() => {
                  if (confirm('Delete this plan?')) {
                    onDeletePlan?.(viewPlan.id);
                    setViewPlan(null);
                  }
                }}
              >
                <Icon name="trash" />
                <span>Delete</span>
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Chip>{viewPlan.level}</Chip>
            <Chip>{viewPlan.daysPerWeek} days/week</Chip>
            <Chip>{viewPlan.durationWeeks} weeks</Chip>
            <Chip>{humanTagForGoal(viewPlan.goal)}</Chip>
          </div>

          <div style={{ marginTop: 10, color: 'var(--w-muted)', lineHeight: 1.55 }}>
            <div><strong style={{ color: 'var(--w-text)' }}>Goal:</strong> {viewPlan.goal}</div>
            <div style={{ marginTop: 6 }}>
              <strong style={{ color: 'var(--w-text)' }}>Created:</strong> {formatDate(viewPlan.createdAt)}
            </div>
            {viewPlan.notes ? (
              <div style={{ marginTop: 10 }}>
                <strong style={{ color: 'var(--w-text)' }}>Notes:</strong>
                <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{viewPlan.notes}</div>
              </div>
            ) : null}
          </div>

          <div className="wSchedule">
            {viewPlan.schedule.map((d) => (
              <div key={`${d.day}-${d.title}`} className="wDay">
                <div className="wDayTop">
                  <div>
                    <div className="wDayTitle">{d.day} · {d.title}</div>
                    <div className="wDayMeta">{d.focus} · {d.durationMin} min</div>
                  </div>
                  <div style={{ color: 'var(--w-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="chev" />
                  </div>
                </div>

                <div className="wListItems">
                  {d.items.map((it, idx) => (
                    <div key={idx} className="wItem">
                      <div className="wItemName">{it.name}</div>
                      <div className="wItemSub">
                        {[it.sets ? `${it.sets} sets` : null, it.reps ? `${it.reps}` : null].filter(Boolean).join(' · ')}
                        {it.notes ? ` · ${it.notes}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* PRICING MODAL (NEW) */}
      {pricingOpen && (
        <Modal
          title="Upgrade your coaching"
          subtitle="Choose a plan. Cancel anytime. Unlock posture camera + voice coach in Pro."
          onClose={() => setPricingOpen(false)}
          footer={
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10 }}>
              <div className="wTrust">
                <span className="wTrustItem"><Icon name="lock" size={16} /> Secure checkout</span>
                <span className="wTrustItem"><Icon name="shield" size={16} /> 7-day refund window</span>
              </div>
              <button
                className="wBtn wBtnPrimary"
                type="button"
                onClick={() => {
                  setCheckoutOpen(true);
                }}
              >
                <Icon name="spark" />
                <span>Continue</span>
              </button>
            </div>
          }
        >
          <div className="wPricingHero">
            <div className="wPricingTop">
              <div>
                <h3>Plans that feel like a real product ✨</h3>
                <p>
                  Starter is good for planning. Pro unlocks posture camera + voice coach.
                  Elite adds advanced scoring & check-ins.
                </p>
              </div>

              <button
                className="wBtn"
                type="button"
                onClick={() => {
                  // quick “view checkout” feel
                  setCheckoutOpen(true);
                }}
              >
                <Icon name="lock" />
                <span>View checkout</span>
              </button>
            </div>

            <div className="wPricingGrid">
              {PRICING.map((plan) => {
                const active = selectedPlan.id === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`wPriceCard ${active ? 'wPriceCardActive' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    {plan.badge ? <div className="wBadge">{plan.badge}</div> : null}

                    <div className="wPriceName">{plan.name}</div>
                    <div className="wPriceLine">
                      <div className="wPrice">{inr(plan.priceInr)}</div>
                      <div className="wPriceSmall">one-time</div>
                    </div>
                    <div className="wTagline">{plan.tagline}</div>

                    <div className="wFeat">
                      {plan.includes.slice(0, 5).map((f) => (
                        <div key={f} className="wFeatRow">
                          <div className="wFeatDot" />
                          <div>{f}</div>
                        </div>
                      ))}
                      {(plan.notIncludes ?? []).slice(0, 2).map((f) => (
                        <div key={f} className="wFeatRow wFeatOff">
                          <div className="wFeatDot" />
                          <div>{f}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <button
                        className={`wBtn ${active ? 'wBtnPrimary' : ''}`}
                        type="button"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlan(plan);
                          setCheckoutOpen(true);
                        }}
                      >
                        <Icon name="lock" />
                        <span>{active ? 'Checkout' : 'Select & Checkout'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}

      {/* CHECKOUT CONFIRM (NEW) */}
      {checkoutOpen && (
        <Modal
          title="Checkout"
          subtitle="This is UI-only right now. Later we’ll connect Razorpay/Stripe."
          onClose={() => setCheckoutOpen(false)}
          size="md"
          footer={
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 10 }}>
              <button className="wBtn" type="button" onClick={() => setCheckoutOpen(false)}>
                Back
              </button>
              <button
                className="wBtn wBtnPrimary"
                type="button"
                onClick={() => {
                  alert(`Purchased: ${selectedPlan.name} (${inr(finalPrice)})`);
                  setCheckoutOpen(false);
                  setPricingOpen(false);
                }}
              >
                <Icon name="lock" />
                <span>Pay {inr(finalPrice)}</span>
              </button>
            </div>
          }
        >
          <div className="wSummary">
            <div className="wSummaryTop">
              <div>
                <div className="wSummaryTitle">{selectedPlan.name} Plan</div>
                <div className="wHint">{selectedPlan.tagline}</div>
              </div>
              <div className="wSummaryPrice">{inr(finalPrice)}</div>
            </div>

            <div className="wDivider" />

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span className="wTrustItem"><Icon name="shield" size={16} /> Buyer protection</span>
              <span className="wTrustItem"><Icon name="lock" size={16} /> Encrypted payment</span>
            </div>

            <div className="wPromoRow">
              <div style={{ flex: '1 1 220px' }}>
                <div className="wLabel">Promo code</div>
                <input
                  className="wInput"
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  placeholder="Try FIT10 or NEW15"
                />
              </div>
              <button
                className="wBtn"
                type="button"
                onClick={() => {
                  // just a tiny "real" feeling
                  const code = promo.trim().toUpperCase();
                  if (!code) return alert('Enter a code first');
                  if (code !== 'FIT10' && code !== 'NEW15') return alert('Invalid promo code');
                  alert('Promo applied ✅');
                }}
              >
                Apply
              </button>
            </div>

            <div className="wHint">
              By continuing, you agree to the Terms and acknowledge the refund policy.
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="wLabel">What you’ll get</div>
            <div className="wFeat">
              {selectedPlan.includes.map((f) => (
                <div key={f} className="wFeatRow">
                  <div className="wFeatDot" />
                  <div>{f}</div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}