import type { Muscle } from '../muscles/taxonomy';

export type Experience = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type GenGoal = 'HYPERTROPHY' | 'STRENGTH' | 'ENDURANCE' | 'GENERAL';

export interface PoolExercise {
  id: string;
  slug: string;
  name: string;
  mechanic: 'COMPOUND' | 'ISOLATION' | null;
  equipment: string;
  defaultRestSec: number;
  muscleWeights: { muscle: Muscle; weight: number; role: 'PRIMARY' | 'SECONDARY' }[];
}

export interface ExerciseHistory {
  est1RM: number;
  hitTopRangeLowRir: boolean;
}

export interface GeneratorInput {
  goal: GenGoal;
  availableTimeMin: number;
  experience: Experience;
  perMuscle: Record<Muscle, { fatigue: number; weeklyVolume: number }>;
  pool: PoolExercise[];
  history: Record<string, ExerciseHistory>;
  recentlyUsed: string[];
}

export interface PlannedExercise {
  exerciseId: string;
  name: string;
  primaryMuscle: Muscle;
  sets: number;
  repLow: number;
  repHigh: number;
  restSec: number;
  rpeTarget: number;
  loadSuggestionKg: number | null;
  supersetGroup?: number;
}

export interface GeneratorPlan {
  exercises: PlannedExercise[];
  rationale: string[];
}
