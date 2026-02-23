import type { ChatSession } from './chat';
import type { PostureSummary } from './posture';
import type { WorkoutSession } from './workout';

export interface UserSettings {
  darkMode: boolean;
  autoSpeak: boolean;
  lowPowerMode: boolean;
  demoDataEnabled: boolean;
}

export interface StoredData {
  chatSession: ChatSession;
  postureSessions: PostureSummary[];
  workoutSessions: WorkoutSession[];
  savedPlans: { id: string; title: string; content: string; createdAt: number }[];
  settings: UserSettings;
}
