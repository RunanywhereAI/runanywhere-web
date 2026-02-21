export type ExerciseType = 'squat' | 'pushup';

export interface PostureSummary {
  id: string;
  exercise: ExerciseType;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  reps: number;
  avgScore: number;
  mistakeCounts: Record<string, number>;
}
