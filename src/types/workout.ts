export type WorkoutType = 'squat' | 'pushup' | 'cardio' | 'strength' | 'mobility';

export interface WorkoutSession {
  id: string;
  date: number;
  workoutType: WorkoutType;
  durationSec: number;
  reps: number;
  calories: number;
  avgFormScore?: number;
  notes?: string;
}
