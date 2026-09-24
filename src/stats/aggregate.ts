import type { Level, TrainingMode } from "@/engine/scenarioTypes";
import { TRAINING_MODES, LEVELS } from "@/engine/scenarioTypes";
import { SKILLS, type SkillTag } from "@/engine/skills";
import type { AnswerRecord } from "./types";

export interface Summary {
  total: number;
  correct: number;
  /** 0..1, null if no data */
  accuracy: number | null;
  avgTimeMs: number | null;
}

export function summarize(records: readonly AnswerRecord[]): Summary {
  const total = records.length;
  const correct = records.filter((r) => r.correct).length;
  return {
    total,
    correct,
    accuracy: total ? correct / total : null,
    avgTimeMs: total ? records.reduce((s, r) => s + r.timeMs, 0) / total : null,
  };
}

export function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function todayRecords(records: readonly AnswerRecord[], now = Date.now()): AnswerRecord[] {
  const start = startOfDay(now);
  return records.filter((r) => r.at >= start);
}

export function byMode(records: readonly AnswerRecord[]): Record<TrainingMode, Summary> {
  return Object.fromEntries(TRAINING_MODES.map((m) => [m, summarize(records.filter((r) => r.mode === m))])) as Record<TrainingMode, Summary>;
}

export function byLevel(records: readonly AnswerRecord[]): Record<Level, Summary> {
  return Object.fromEntries(LEVELS.map((l) => [l, summarize(records.filter((r) => r.level === l))])) as Record<Level, Summary>;
}

export function bySkill(records: readonly AnswerRecord[]): { skill: SkillTag; label: string; summary: Summary }[] {
  const map = new Map<SkillTag, AnswerRecord[]>();
  for (const r of records) for (const s of r.skills) map.set(s, [...(map.get(s) ?? []), r]);
  return [...map.entries()].map(([skill, rs]) => ({ skill, label: SKILLS[skill].label, summary: summarize(rs) }));
}

/** Longest run of consecutive correct answers in a list. */
export function longestStreak(records: readonly AnswerRecord[]): number {
  let best = 0;
  let cur = 0;
  for (const r of records) {
    cur = r.correct ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

/* ---------------- Dealer rating ---------------- */

export type Grade = "S" | "A" | "B" | "C" | "D";
export const MIN_RATED_ANSWERS = 5;
export const RATING_WINDOW = 200;

const SPEED_POINTS = { fast: 1, normal: 0.6, slow: 0.2 } as const;

export interface RatingDetail {
  grade: Grade | null;
  composite: number | null;
  accuracy: number | null;
  speed: number | null;
  difficulty: number | null;
  answers: number;
}

/**
 * Composite = 60% accuracy + 25% speed + 15% difficulty, using the most recent answers.
 * Accuracy is weighted most (spec: accuracy over speed).
 */
export function rate(records: readonly AnswerRecord[]): RatingDetail {
  const recent = records.slice(-RATING_WINDOW);
  const n = recent.length;
  if (n < MIN_RATED_ANSWERS) return { grade: null, composite: null, accuracy: null, speed: null, difficulty: null, answers: n };
  const accuracy = recent.filter((r) => r.correct).length / n;
  const speed = recent.reduce((s, r) => s + SPEED_POINTS[r.speed], 0) / n;
  const difficulty = recent.reduce((s, r) => s + (r.level - 1) / 4, 0) / n;
  const composite = 0.6 * accuracy + 0.25 * speed + 0.15 * difficulty;
  return { grade: gradeOf(composite), composite, accuracy, speed, difficulty, answers: n };
}

export function gradeOf(composite: number): Grade {
  if (composite >= 0.9) return "S";
  if (composite >= 0.8) return "A";
  if (composite >= 0.68) return "B";
  if (composite >= 0.55) return "C";
  return "D";
}

export function dealerRating(records: readonly AnswerRecord[]): { modes: Record<TrainingMode, RatingDetail>; overall: RatingDetail } {
  const modes = Object.fromEntries(TRAINING_MODES.map((m) => [m, rate(records.filter((r) => r.mode === m))])) as Record<TrainingMode, RatingDetail>;
  // Overall is computed from the underlying accuracy/speed/difficulty of every recent answer, not by averaging grades.
  return { modes, overall: rate(records) };
}

/* ---------------- Weakness ---------------- */

export interface WeaknessItem {
  kind: "mode" | "skill";
  key: string;
  label: string;
  accuracy: number;
  attempts: number;
}

export const WEAKNESS_MIN_ATTEMPTS = 3;
export const WEAKNESS_THRESHOLD = 0.9;
export const WEAKNESS_WINDOW = 300;

const MODE_LABEL: Record<TrainingMode, string> = { hand: "HAND READING", winner: "WINNER", pot: "POT", sidepot: "SIDE POT" };

/** Weak modes/skills (accuracy below threshold with enough attempts), weakest first. */
export function weaknesses(records: readonly AnswerRecord[]): WeaknessItem[] {
  const recent = records.slice(-WEAKNESS_WINDOW);
  const items: WeaknessItem[] = [];
  for (const [mode, s] of Object.entries(byMode(recent)) as [TrainingMode, Summary][]) {
    if (s.total >= WEAKNESS_MIN_ATTEMPTS && s.accuracy! < WEAKNESS_THRESHOLD) items.push({ kind: "mode", key: mode, label: MODE_LABEL[mode], accuracy: s.accuracy!, attempts: s.total });
  }
  for (const { skill, label, summary } of bySkill(recent)) {
    if (summary.total >= WEAKNESS_MIN_ATTEMPTS && summary.accuracy! < WEAKNESS_THRESHOLD) items.push({ kind: "skill", key: skill, label, accuracy: summary.accuracy!, attempts: summary.total });
  }
  return items.sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts);
}

/** Weakest skill in a set of answers (for session results). */
export function weakestSkill(records: readonly AnswerRecord[]): string | null {
  const rows = bySkill(records).filter((r) => r.summary.total - r.summary.correct > 0);
  if (rows.length === 0) return null;
  rows.sort((a, b) => a.summary.accuracy! - b.summary.accuracy! || b.summary.total - a.summary.total);
  return rows[0].label;
}
