import type { GradeResult, ScoreBreakdown, SpeedRating, UserAnswer } from "@/engine/grading";
import type { ReactNode } from "react";
import type { Scenario } from "@/engine/scenarioTypes";

export interface AnsweredState {
  answer: UserAnswer;
  grade: GradeResult;
  timeMs: number;
  speed: SpeedRating;
  score: ScoreBreakdown;
}

export interface ModeViewProps<S extends Scenario> {
  scenario: S;
  answered: AnsweredState | null;
  onAnswer: (a: UserAnswer) => void;
  /** Verdict + NEXT controls rendered by the session, shown once answered. */
  verdict: ReactNode;
  /** Modes with an intro (POT playback) start the answer timer themselves. */
  startTimer: () => void;
}
