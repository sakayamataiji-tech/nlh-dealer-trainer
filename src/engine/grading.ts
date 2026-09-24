import type { Card } from "./cards";
import type { HandCategory } from "./handEvaluator";
import type { Scenario, WinnerScenario } from "./scenarioTypes";
import { isValidBoardSelection } from "./boardSelection";

/** User answers per mode. */
export type UserAnswer =
  | { mode: "hand"; category: HandCategory }
  | { mode: "winner"; key: string; boardCards?: Card[] }
  | { mode: "pot"; amount: number }
  | { mode: "sidepot"; amounts: Record<string, number> };

export interface GradeResult {
  correct: boolean;
  /** For side pot: per-question correctness. */
  parts?: Record<string, boolean>;
}

/** Compares a user answer with the engine-derived answer stored in the scenario. */
export function gradeAnswer(scenario: Scenario, answer: UserAnswer): GradeResult {
  if (scenario.mode !== answer.mode) throw new Error("Answer mode mismatch");
  switch (scenario.mode) {
    case "hand":
      return { correct: scenario.hand.category === (answer as { category: HandCategory }).category };
    case "winner": {
      const a = answer as { key: string; boardCards?: Card[] };
      const winnerOk = scenario.correctKey === a.key;
      if (!scenario.requireBoardCards) return { correct: winnerOk, parts: { winner: winnerOk } };
      const cardsOk = !!a.boardCards && boardSelectionCorrect(scenario, a.key, a.boardCards);
      return { correct: winnerOk && cardsOk, parts: { winner: winnerOk, cards: cardsOk } };
    }
    case "pot":
      return { correct: scenario.answer === (answer as { amount: number }).amount };
    case "sidepot": {
      const amounts = (answer as { amounts: Record<string, number> }).amounts;
      const parts = Object.fromEntries(scenario.questions.map((q) => [q.key, amounts[q.key] === q.answer]));
      return { correct: Object.values(parts).every(Boolean), parts };
    }
  }
}

export type SpeedRating = "fast" | "normal" | "slow";

/** FAST ≤ 60% of the target time, SLOW > 150%. */
export function rateSpeed(timeMs: number, targetSeconds: number): SpeedRating {
  const s = timeMs / 1000;
  if (s <= targetSeconds * 0.6) return "fast";
  if (s > targetSeconds * 1.5) return "slow";
  return "normal";
}

export interface ScoreBreakdown {
  base: number;
  speedBonus: number;
  streakBonus: number;
  levelBonus: number;
  total: number;
  streak: number;
}

/**
 * Score for one answer (spec §14). Accuracy dominates: an incorrect answer scores 0.
 * `streak` is the streak count INCLUDING this answer.
 */
export function scoreAnswer(correct: boolean, speed: SpeedRating, streak: number, level: number): ScoreBreakdown {
  if (!correct) return { base: 0, speedBonus: 0, streakBonus: 0, levelBonus: 0, total: 0, streak: 0 };
  const base = 100;
  const speedBonus = speed === "fast" ? 30 : speed === "normal" ? 10 : 0;
  const streakBonus = Math.min(streak, 10) * 5;
  const levelBonus = (level - 1) * 10;
  return { base, speedBonus, streakBonus, levelBonus, total: base + speedBonus + streakBonus + levelBonus, streak };
}

/**
 * Board-card part of a WINNER answer. The cards are judged against the hand of the
 * player the user named (so card reading is scored separately from winner choice);
 * for "SPLIT" they are judged against the actual winner(s).
 */
export function boardSelectionCorrect(scenario: WinnerScenario, key: string, cards: readonly Card[]): boolean {
  const targets = key === "SPLIT" ? scenario.result.winners : [key];
  return targets.some((id) => {
    const player = scenario.players.find((p) => p.id === id);
    const entry = scenario.result.entries.find((e) => e.id === id);
    return !!player && !!entry && isValidBoardSelection(scenario.board, player.hole, entry.hand, cards);
  });
}
