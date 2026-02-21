import type { StoredData, UserSettings } from '../types/storage';
import type { ChatSession, ChatMessage } from '../types/chat';
import type { PostureSummary } from '../types/posture';
import type { WorkoutSession } from '../types/workout';

const DB_NAME = 'health-fitness-coach';
const STORE_NAME = 'app';
const KEY = 'state';

const defaultSettings: UserSettings = {
  darkMode: true,
  autoSpeak: false,
  lowPowerMode: false,
  demoDataEnabled: false,
};

const defaultData: StoredData = {
  chatSession: { id: 'default', messages: [] },
  postureSessions: [],
  workoutSessions: [],
  savedPlans: [],
  settings: defaultSettings,
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readIndexedDb(): Promise<StoredData | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(KEY);
    req.onsuccess = () => resolve((req.result as StoredData) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function writeIndexedDb(data: StoredData): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function canUseIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

export async function loadData(): Promise<StoredData> {
  try {
    const stored = canUseIndexedDb() ? await readIndexedDb() : null;
    if (stored) {
      return {
        ...defaultData,
        ...stored,
        settings: { ...defaultSettings, ...stored.settings },
        workoutSessions: stored.workoutSessions ?? [],
      };
    }
  } catch {
    // fallback
  }

  const fallback = localStorage.getItem(KEY);
  if (!fallback) return defaultData;
  try {
    const parsed = JSON.parse(fallback) as StoredData;
    return {
      ...defaultData,
      ...parsed,
      settings: { ...defaultSettings, ...parsed.settings },
      workoutSessions: parsed.workoutSessions ?? [],
    };
  } catch {
    return defaultData;
  }
}

export async function saveData(data: StoredData): Promise<void> {
  try {
    if (canUseIndexedDb()) return await writeIndexedDb(data);
  } catch {
    // fallback
  }
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function createUserMessage(text: string): ChatMessage {
  return { id: crypto.randomUUID(), role: 'user', text, createdAt: Date.now() };
}

export function createAssistantMessage(text: string, parsed?: ChatMessage['parsed']): ChatMessage {
  return { id: crypto.randomUUID(), role: 'assistant', text, parsed, createdAt: Date.now() };
}

export function appendChatMessage(session: ChatSession, message: ChatMessage): ChatSession {
  return { ...session, messages: [...session.messages, message] };
}

export function addPostureSession(sessions: PostureSummary[], summary: PostureSummary): PostureSummary[] {
  return [summary, ...sessions].slice(0, 200);
}

export function addWorkoutSession(sessions: WorkoutSession[], session: WorkoutSession): WorkoutSession[] {
  return [session, ...sessions].slice(0, 300);
}

export function createDemoWorkouts(): WorkoutSession[] {
  const now = Date.now();
  return [
    { id: crypto.randomUUID(), date: now - 86400000, workoutType: 'squat', durationSec: 900, reps: 36, calories: 120, avgFormScore: 82, notes: 'Felt strong today' },
    { id: crypto.randomUUID(), date: now - 2 * 86400000, workoutType: 'pushup', durationSec: 600, reps: 54, calories: 95, avgFormScore: 78 },
  ];
}
