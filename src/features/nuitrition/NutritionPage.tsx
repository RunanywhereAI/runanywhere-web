import { useCallback, useMemo, useRef, useState } from 'react';
import { generate, getModelStatus, loadProvidedLanguageModel } from '../../lib/runanywhere';

type Goal = 'fat_loss' | 'maintenance' | 'muscle_gain';
type Activity = 'sedentary' | 'light' | 'moderate' | 'active';

type Profile = {
  age: number;
  weightKg: number;
  heightCm: number;
  activity: Activity;
  goal: Goal;
  vegetarianOnly: boolean;
};

type MacroTargets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
};

type FoodItem = {
  name: string;
  qty: number;
  unit: 'serving' | 'cup' | 'bowl' | 'piece' | 'g' | 'tbsp' | 'tsp';
};

type MacroEstimate = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG: number;
  warnings: string[];
  recognizedItems: FoodItem[];
  unknownTokens: string[];
};

type AIPlan = {
  headline: string;
  summary: string;
  targets: MacroTargets;
  analysis: {
    gaps: string[];
    whatYouDidWell: string[];
    improvements: string[];
  };
  weeklyPlan: Array<{
    day: string;
    breakfast: string;
    lunch: string;
    snack: string;
    dinner: string;
  }>;
  shoppingList: string[];
  notes: string[];
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function round(n: number) {
  return Math.round(n);
}

/**
 * Simple macro database (veg + common Indian foods).
 * Values are approximate per "default serving".
 */
const FOOD_DB: Record<
  string,
  { unit: FoodItem['unit']; calories: number; proteinG: number; carbsG: number; fatG: number; fibreG: number }
> = {
  banana: { unit: 'piece', calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.3, fibreG: 3.1 },
  apple: { unit: 'piece', calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, fibreG: 4.4 },
  curd: { unit: 'bowl', calories: 120, proteinG: 6, carbsG: 8, fatG: 7, fibreG: 0 },
  yogurt: { unit: 'bowl', calories: 120, proteinG: 6, carbsG: 8, fatG: 7, fibreG: 0 },
  milk: { unit: 'cup', calories: 150, proteinG: 8, carbsG: 12, fatG: 8, fibreG: 0 },
  oats: { unit: 'bowl', calories: 190, proteinG: 7, carbsG: 33, fatG: 4, fibreG: 5 },
  dal: { unit: 'bowl', calories: 180, proteinG: 11, carbsG: 28, fatG: 3, fibreG: 7 },
  rajma: { unit: 'bowl', calories: 220, proteinG: 13, carbsG: 33, fatG: 4, fibreG: 10 },
  chole: { unit: 'bowl', calories: 240, proteinG: 12, carbsG: 35, fatG: 6, fibreG: 10 },
  paneer: { unit: 'serving', calories: 260, proteinG: 18, carbsG: 6, fatG: 18, fibreG: 0 },
  tofu: { unit: 'serving', calories: 150, proteinG: 16, carbsG: 5, fatG: 8, fibreG: 2 },
  sprouts: { unit: 'bowl', calories: 130, proteinG: 10, carbsG: 20, fatG: 2, fibreG: 6 },
  salad: { unit: 'bowl', calories: 70, proteinG: 2, carbsG: 14, fatG: 0.5, fibreG: 6 },
  roti: { unit: 'piece', calories: 110, proteinG: 3.5, carbsG: 20, fatG: 2, fibreG: 3 },
  chapati: { unit: 'piece', calories: 110, proteinG: 3.5, carbsG: 20, fatG: 2, fibreG: 3 },
  rice: { unit: 'bowl', calories: 240, proteinG: 4.5, carbsG: 52, fatG: 0.5, fibreG: 1 },
  khichdi: { unit: 'bowl', calories: 260, proteinG: 10, carbsG: 42, fatG: 6, fibreG: 6 },
  idli: { unit: 'piece', calories: 60, proteinG: 2, carbsG: 12, fatG: 0.4, fibreG: 1 },
  dosa: { unit: 'piece', calories: 170, proteinG: 4, carbsG: 28, fatG: 5, fibreG: 2 },
  poha: { unit: 'bowl', calories: 240, proteinG: 6, carbsG: 44, fatG: 6, fibreG: 4 },
  upma: { unit: 'bowl', calories: 260, proteinG: 7, carbsG: 42, fatG: 7, fibreG: 4 },
  peanuts: { unit: 'tbsp', calories: 95, proteinG: 4, carbsG: 3, fatG: 8, fibreG: 1.5 },
  almonds: { unit: 'tbsp', calories: 80, proteinG: 3, carbsG: 3, fatG: 7, fibreG: 2 },
  chia: { unit: 'tbsp', calories: 58, proteinG: 2, carbsG: 5, fatG: 4, fibreG: 5 },
  flax: { unit: 'tbsp', calories: 55, proteinG: 2, carbsG: 3, fatG: 4, fibreG: 3 },
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function activityFactor(a: Activity) {
  if (a === 'sedentary') return 1.2;
  if (a === 'light') return 1.375;
  if (a === 'moderate') return 1.55;
  return 1.725;
}

/**
 * Mifflin-St Jeor (female) baseline estimate.
 * We keep it simple and transparent; you can add gender later if you want.
 */
function estimateMaintenanceCalories(profile: Profile) {
  const bmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age - 161;
  return round(bmr * activityFactor(profile.activity));
}

function computeTargets(profile: Profile): MacroTargets {
  const maintenance = estimateMaintenanceCalories(profile);
  const calories =
    profile.goal === 'fat_loss' ? round(maintenance * 0.82) :
    profile.goal === 'muscle_gain' ? round(maintenance * 1.12) :
    maintenance;

  // Protein: 1.6–2.0 g/kg for muscle gain, 1.4–1.8 for fat loss, 1.2–1.6 maintenance
  const proteinPerKg =
    profile.goal === 'muscle_gain' ? 1.9 :
    profile.goal === 'fat_loss' ? 1.7 :
    1.5;

  const proteinG = round(profile.weightKg * proteinPerKg);
  const fatG = round((calories * 0.25) / 9);
  const carbsG = round((calories - proteinG * 4 - fatG * 9) / 4);
  const fibreG = profile.goal === 'fat_loss' ? 30 : 28;

  return {
    calories: clamp(calories, 1200, 3600),
    proteinG: clamp(proteinG, 45, 190),
    carbsG: clamp(carbsG, 90, 450),
    fatG: clamp(fatG, 30, 130),
    fibreG: clamp(fibreG, 22, 45),
  };
}

function tokenizeFoodInput(text: string) {
  return text
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/[,;\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Very lightweight parser:
 * - understands leading qty: "2 banana", "1 bowl dal", "2 roti", "1 tbsp chia"
 * - otherwise counts as 1 serving
 */
function parseFood(text: string): { items: FoodItem[]; unknown: string[] } {
  const clean = tokenizeFoodInput(text);
  if (!clean) return { items: [], unknown: [] };

  // Split by "and" or just space groupings via patterns
  // We try to detect "qty unit name" or "qty name"
  const chunks = clean
    .split(' and ')
    .flatMap((c) => c.split(' + '))
    .flatMap((c) => c.split(' then '))
    .map((c) => c.trim())
    .filter(Boolean);

  const items: FoodItem[] = [];
  const unknown: string[] = [];

  for (const ch of chunks) {
    // Match: 2 roti / 1 bowl dal / 1 cup milk / 2 tbsp chia
    const m = ch.match(/^(\d+(?:\.\d+)?)\s+(bowl|cup|piece|serving|g|tbsp|tsp)\s+(.+)$/);
    if (m) {
      const qty = Number(m[1]);
      const unit = m[2] as FoodItem['unit'];
      const name = m[3].trim();
      items.push({ name, qty, unit });
      continue;
    }

    const m2 = ch.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (m2) {
      const qty = Number(m2[1]);
      const name = m2[2].trim();
      items.push({ name, qty, unit: 'serving' });
      continue;
    }

    // If it's just "dal" or "roti"
    items.push({ name: ch, qty: 1, unit: 'serving' });
  }

  // Normalize: map synonyms
  const normalized: FoodItem[] = items.map((it) => {
    let name = it.name;
    name = name.replace(/\bchapatis?\b/g, 'chapati');
    name = name.replace(/\brotis?\b/g, 'roti');
    name = name.replace(/\byoghurt\b/g, 'yogurt');
    name = name.replace(/\bcurds?\b/g, 'curd');
    name = name.replace(/\bchia seeds?\b/g, 'chia');
    name = name.replace(/\bflax seeds?\b/g, 'flax');
    return { ...it, name };
  });

  // Determine unknown tokens (if food not in DB)
  for (const it of normalized) {
    const key = closestDbKey(it.name);
    if (!key) unknown.push(it.name);
  }

  return { items: normalized, unknown: Array.from(new Set(unknown)) };
}

function closestDbKey(name: string): string | null {
  const n = name.trim();
  if (!n) return null;

  // direct
  if (FOOD_DB[n]) return n;

  // try first word match (e.g., "paneer bhurji" -> paneer)
  const first = n.split(' ')[0];
  if (FOOD_DB[first]) return first;

  // try contains
  for (const k of Object.keys(FOOD_DB)) {
    if (n.includes(k)) return k;
  }
  return null;
}

function estimateMacrosFromItems(items: FoodItem[], targets: MacroTargets): MacroEstimate {
  let calories = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let fibreG = 0;

  const warnings: string[] = [];
  const recognizedItems: FoodItem[] = [];
  const unknownTokens: string[] = [];

  for (const it of items) {
    const key = closestDbKey(it.name);
    if (!key) {
      unknownTokens.push(it.name);
      continue;
    }
    const base = FOOD_DB[key];
    // If user typed a unit, but DB unit differs, we still scale by qty (approx).
    const mul = it.qty;

    calories += base.calories * mul;
    proteinG += base.proteinG * mul;
    carbsG += base.carbsG * mul;
    fatG += base.fatG * mul;
    fibreG += base.fibreG * mul;

    recognizedItems.push(it);
  }

  // Basic heuristic warnings
  if (proteinG < targets.proteinG * 0.35) warnings.push('Protein looks low for your daily target.');
  if (fibreG < 8) warnings.push('Fibre looks low; add vegetables, fruits, legumes, or seeds.');
  if (calories > targets.calories * 0.9) warnings.push('This entry is already close to your daily calorie target.');

  return {
    calories: round(calories),
    proteinG: round(proteinG),
    carbsG: round(carbsG),
    fatG: round(fatG),
    fibreG: round(fibreG),
    warnings,
    recognizedItems,
    unknownTokens: Array.from(new Set(unknownTokens)),
  };
}

/** Parse AI JSON safely. We never show raw JSON in the UI. */
function safeParseAIPlan(raw: string): AIPlan | null {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim();

    const obj = JSON.parse(cleaned);

    // minimal validation
    if (!obj || typeof obj !== 'object') return null;
    if (!obj.targets || !obj.weeklyPlan) return null;

    return obj as AIPlan;
  } catch {
    return null;
  }
}

function ratio(current: number, target: number) {
  if (!target || target <= 0) return 0;
  return clamp(current / target, 0, 1.25);
}

function pctLabel(r: number) {
  return `${Math.round(clamp(r, 0, 1) * 100)}%`;
}

export function NutritionPage() {
  const [profile, setProfile] = useState<Profile>({
    age: 20,
    weightKg: 55,
    heightCm: 160,
    activity: 'light',
    goal: 'maintenance',
    vegetarianOnly: true,
  });

  const targets = useMemo(() => computeTargets(profile), [profile]);

  const [foodInput, setFoodInput] = useState('');
  const [localEstimate, setLocalEstimate] = useState<MacroEstimate | null>(null);

  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPlan, setAiPlan] = useState<AIPlan | null>(null);

  const [modelState, setModelState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [modelError, setModelError] = useState<string | null>(null);

  const lastRawRef = useRef<string>('');

  const loadModel = useCallback(async () => {
    setModelState('loading');
    setModelError(null);

    const ok = await loadProvidedLanguageModel();
    const ms = getModelStatus();

    if (!ok || !ms.ready) {
      setModelState('error');
      setModelError(ms.lastError ?? 'Model is not available.');
      return false;
    }

    setModelState('ready');
    setModelError(null);
    return true;
  }, []);

  const analyzeLocal = useCallback(() => {
    const { items } = parseFood(foodInput);
    const est = estimateMacrosFromItems(items, targets);
    setLocalEstimate(est);
    setAiPlan(null);
    setAiError(null);
  }, [foodInput, targets]);

  const analyzeWithAI = useCallback(async () => {
    setAiError(null);
    setAiBusy(true);

    try {
      // Ensure model is ready
      if (getModelStatus().ready !== true) {
        const ok = await loadModel();
        if (!ok) {
          setAiError(getModelStatus().lastError ?? 'Model is not ready.');
          return;
        }
      }

      const parsed = parseFood(foodInput);
      const est = estimateMacrosFromItems(parsed.items, targets);

      const prompt = `
You are a professional nutrition coach. The user wants a vegetarian-focused plan.
Return ONLY valid JSON (no markdown fences). Use this exact schema:

{
  "headline": string,
  "summary": string,
  "targets": { "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "fibreG": number },
  "analysis": {
    "gaps": string[],
    "whatYouDidWell": string[],
    "improvements": string[]
  },
  "weeklyPlan": [
    { "day": "Mon|Tue|Wed|Thu|Fri|Sat|Sun", "breakfast": string, "lunch": string, "snack": string, "dinner": string }
  ],
  "shoppingList": string[],
  "notes": string[]
}

Rules:
- Must be vegetarian. Prefer Indian-friendly meals.
- Protein must be achievable with dals/rajma/chole/sprouts/curd/paneer/tofu, plus seeds.
- Fibre + micronutrients should be covered with vegetables, fruits, whole grains.
- Keep recommendations practical, with portion guidance in plain language.
- No medical diagnosis. If user has pain/conditions, advise consulting a professional.

User profile:
Age: ${profile.age}
Weight: ${profile.weightKg} kg
Height: ${profile.heightCm} cm
Activity: ${profile.activity}
Goal: ${profile.goal}
Vegetarian only: ${profile.vegetarianOnly}

Daily targets (computed):
${JSON.stringify(targets)}

Food input:
"${foodInput}"

Local estimate (approx):
${JSON.stringify(est)}
`.trim();

      const raw = await generate(prompt, { maxTokens: 900, temperature: 0.2 });
      lastRawRef.current = raw ?? '';

      const plan = safeParseAIPlan(raw ?? '');
      if (!plan) {
        // Retry strict mode
        const retry = await generate(
          `${prompt}\n\nSTRICT: Output ONLY valid JSON. No extra text.`,
          { maxTokens: 900, temperature: 0 }
        );
        lastRawRef.current = retry ?? '';
        const plan2 = safeParseAIPlan(retry ?? '');
        if (!plan2) {
          setAiError('AI output could not be parsed. The model may be returning extra text.');
          return;
        }
        setAiPlan(plan2);
        setLocalEstimate(est);
        return;
      }

      setAiPlan(plan);
      setLocalEstimate(est);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  }, [foodInput, profile, targets, loadModel]);

  const calsRatio = ratio(localEstimate?.calories ?? 0, targets.calories);
  const pRatio = ratio(localEstimate?.proteinG ?? 0, targets.proteinG);
  const fRatio = ratio(localEstimate?.fibreG ?? 0, targets.fibreG);

  return (
    <div className="page nutrition-page">
      <section className="nutri-hero card">
        <div className="nutri-hero-bg" aria-hidden="true" />
        <div className="nutri-hero-inner">
          <div className="nutri-hero-left">
            <div className="kicker">On-device nutrition analysis and weekly planning</div>
            <h2 className="title">Nutrition Comparator</h2>
            <p className="subtitle">
              Type what you ate. Get calorie and macro estimates, then generate a practical weekly plan with protein, fibre,
              vitamins, and minerals covered.
            </p>

            <div className="model-chip">
              <div className="model-label">Model</div>
              <div className="model-value">
                {modelState === 'ready' ? 'Ready' : modelState === 'loading' ? 'Loading' : modelState === 'error' ? 'Error' : 'Not loaded'}
              </div>
              <button className="btn btn-ghost" type="button" onClick={() => void loadModel()}>
                Load model
              </button>
            </div>

            {modelError && <div className="inline-error">Model error: {modelError}</div>}
          </div>

          <div className="nutri-hero-right">
            <div className="targets card">
              <div className="targets-head">
                <h3>Daily targets</h3>
                <span className="muted">Based on your profile</span>
              </div>

              <div className="targets-grid">
                <div className="t">
                  <div className="t-k">Calories</div>
                  <div className="t-v">{targets.calories}</div>
                </div>
                <div className="t">
                  <div className="t-k">Protein</div>
                  <div className="t-v">{targets.proteinG} g</div>
                </div>
                <div className="t">
                  <div className="t-k">Carbs</div>
                  <div className="t-v">{targets.carbsG} g</div>
                </div>
                <div className="t">
                  <div className="t-k">Fat</div>
                  <div className="t-v">{targets.fatG} g</div>
                </div>
                <div className="t">
                  <div className="t-k">Fibre</div>
                  <div className="t-v">{targets.fibreG} g</div>
                </div>
              </div>

              <div className="muted footnote">
                These are estimates. Adjust based on your energy, training, and weekly consistency.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="nutri-grid">
        {/* Profile */}
        <article className="card panel">
          <div className="panel-head">
            <h3>Profile</h3>
            <span className="muted">Personalize calorie and macro targets</span>
          </div>

          <div className="form-grid">
            <label>
              Age
              <input
                type="number"
                value={profile.age}
                onChange={(e) => setProfile((p) => ({ ...p, age: Number(e.target.value || 0) }))}
                min={12}
                max={80}
              />
            </label>
            <label>
              Weight (kg)
              <input
                type="number"
                value={profile.weightKg}
                onChange={(e) => setProfile((p) => ({ ...p, weightKg: Number(e.target.value || 0) }))}
                min={30}
                max={200}
              />
            </label>
            <label>
              Height (cm)
              <input
                type="number"
                value={profile.heightCm}
                onChange={(e) => setProfile((p) => ({ ...p, heightCm: Number(e.target.value || 0) }))}
                min={130}
                max={220}
              />
            </label>
            <label>
              Activity
              <select
                value={profile.activity}
                onChange={(e) => setProfile((p) => ({ ...p, activity: e.target.value as Activity }))}
              >
                <option value="sedentary">Sedentary</option>
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="active">Active</option>
              </select>
            </label>
            <label>
              Goal
              <select value={profile.goal} onChange={(e) => setProfile((p) => ({ ...p, goal: e.target.value as Goal }))}>
                <option value="fat_loss">Fat loss</option>
                <option value="maintenance">Maintenance</option>
                <option value="muscle_gain">Muscle gain</option>
              </select>
            </label>
            <label className="toggle">
              Vegetarian only
              <button
                className={profile.vegetarianOnly ? 'btn btn-small btn-primary' : 'btn btn-small'}
                type="button"
                onClick={() => setProfile((p) => ({ ...p, vegetarianOnly: !p.vegetarianOnly }))}
              >
                {profile.vegetarianOnly ? 'Enabled' : 'Disabled'}
              </button>
            </label>
          </div>
        </article>

        {/* Food input */}
        <article className="card panel">
          <div className="panel-head">
            <h3>Food input</h3>
            <span className="muted">Example: 2 roti, 1 bowl dal, curd, salad</span>
          </div>

          <textarea
            className="food-textarea"
            value={foodInput}
            onChange={(e) => setFoodInput(e.target.value)}
            placeholder="Type your meal items with quantities where possible."
          />

          <div className="actions-row">
            <button className="btn" type="button" onClick={analyzeLocal} disabled={!foodInput.trim()}>
              Quick estimate
            </button>

            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void analyzeWithAI()}
              disabled={!foodInput.trim() || aiBusy}
            >
              {aiBusy ? 'Analyzing with AI' : 'Analyze with AI'}
            </button>
          </div>

          {aiError && (
            <div className="inline-error">
              {aiError}
              <div className="muted" style={{ marginTop: 6 }}>
                Tip: Ensure the model loads successfully in Settings. Current model status: {getModelStatus().ready ? 'Ready' : 'Not ready'}.
              </div>
            </div>
          )}
        </article>

        {/* Local results */}
        <article className="card panel">
          <div className="panel-head">
            <h3>Nutrition score</h3>
            <span className="muted">Based on your targets</span>
          </div>

          {!localEstimate ? (
            <div className="empty-block">
              Enter your food items and run an estimate to see calories and macros.
            </div>
          ) : (
            <>
              <div className="score-grid">
                <div className="score-card">
                  <div className="score-k">Calories</div>
                  <div className="score-v">{localEstimate.calories}</div>
                  <div className="bar">
                    <div className="fill" style={{ width: pctLabel(calsRatio) }} />
                  </div>
                  <div className="score-s muted">{pctLabel(calsRatio)} of daily target</div>
                </div>

                <div className="score-card">
                  <div className="score-k">Protein</div>
                  <div className="score-v">{localEstimate.proteinG} g</div>
                  <div className="bar">
                    <div className="fill" style={{ width: pctLabel(pRatio) }} />
                  </div>
                  <div className="score-s muted">{pctLabel(pRatio)} of daily target</div>
                </div>

                <div className="score-card">
                  <div className="score-k">Fibre</div>
                  <div className="score-v">{localEstimate.fibreG} g</div>
                  <div className="bar">
                    <div className="fill" style={{ width: pctLabel(fRatio) }} />
                  </div>
                  <div className="score-s muted">{pctLabel(fRatio)} of daily target</div>
                </div>
              </div>

              <div className="mini-grid">
                <div className="mini">
                  <div className="mini-k muted">Carbs</div>
                  <div className="mini-v">{localEstimate.carbsG} g</div>
                </div>
                <div className="mini">
                  <div className="mini-k muted">Fat</div>
                  <div className="mini-v">{localEstimate.fatG} g</div>
                </div>
              </div>

              {(localEstimate.warnings.length > 0 || localEstimate.unknownTokens.length > 0) && (
                <div className="note-box">
                  {localEstimate.warnings.map((w) => (
                    <div key={w} className="note">{w}</div>
                  ))}
                  {localEstimate.unknownTokens.length > 0 && (
                    <div className="muted" style={{ marginTop: 8 }}>
                      Some items were not recognized: {localEstimate.unknownTokens.join(', ')}. Add clearer names (e.g., “dal”, “roti”, “paneer”).
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </article>

        {/* AI plan */}
        <article className="card panel wide">
          <div className="panel-head">
            <h3>Weekly plan and recommendations</h3>
            <span className="muted">Generated locally using your on-device model</span>
          </div>

          {!aiPlan ? (
            <div className="empty-block">
              Run “Analyze with AI” to generate a complete weekly plan, improvements, and shopping list.
            </div>
          ) : (
            <div className="ai-plan">
              <div className="ai-top">
                <div>
                  <div className="ai-headline">{aiPlan.headline}</div>
                  <div className="ai-summary muted">{aiPlan.summary}</div>
                </div>

                <div className="ai-targets">
                  <div className="pill"><span className="muted">Calories</span><strong>{aiPlan.targets.calories}</strong></div>
                  <div className="pill"><span className="muted">Protein</span><strong>{aiPlan.targets.proteinG} g</strong></div>
                  <div className="pill"><span className="muted">Fibre</span><strong>{aiPlan.targets.fibreG} g</strong></div>
                </div>
              </div>

              <div className="ai-columns">
                <div className="ai-col">
                  <h4>What you did well</h4>
                  <ul>
                    {aiPlan.analysis.whatYouDidWell.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>

                <div className="ai-col">
                  <h4>Gaps</h4>
                  <ul>
                    {aiPlan.analysis.gaps.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>

                <div className="ai-col">
                  <h4>Improvements</h4>
                  <ul>
                    {aiPlan.analysis.improvements.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
              </div>

              <div className="weekly">
                <h4>Weekly plan</h4>
                <div className="weekly-table">
                  <div className="weekly-row weekly-head">
                    <div>Day</div>
                    <div>Breakfast</div>
                    <div>Lunch</div>
                    <div>Snack</div>
                    <div>Dinner</div>
                  </div>
                  {DAY_NAMES.map((d) => {
                    const row = aiPlan.weeklyPlan.find((x) => x.day === d) ?? aiPlan.weeklyPlan[0];
                    return (
                      <div key={d} className="weekly-row">
                        <div className="day">{d}</div>
                        <div>{row?.breakfast ?? ''}</div>
                        <div>{row?.lunch ?? ''}</div>
                        <div>{row?.snack ?? ''}</div>
                        <div>{row?.dinner ?? ''}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="ai-bottom">
                <div className="card sub">
                  <h4>Shopping list</h4>
                  <ul className="chips">
                    {aiPlan.shoppingList.map((x) => (
                      <li key={x} className="chip">{x}</li>
                    ))}
                  </ul>
                </div>

                <div className="card sub">
                  <h4>Notes</h4>
                  <ul>
                    {aiPlan.notes.map((x) => <li key={x}>{x}</li>)}
                  </ul>
                </div>
              </div>

              {/* Debug: keep hidden, but you can uncomment if needed */}
              {/* <pre style={{ whiteSpace: 'pre-wrap', opacity: 0.6 }}>{lastRawRef.current}</pre> */}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}