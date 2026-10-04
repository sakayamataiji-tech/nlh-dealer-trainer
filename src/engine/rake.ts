/**
 * Cash-game rake and jackpot drop, taken from the final pot (after uncalled bets are returned).
 *
 *  - Rake = pot × percent, rounded to the smallest chip (down / up / nearest, per house rule),
 *    capped at `cap` (0 = no cap). The smallest chip comes from the house settings (see chipUnit).
 *  - Jackpot drop = a fixed amount, taken only together with the rake (rake > 0) and only if
 *    something is still left for the winner.
 *  - No flop, no drop: a hand that ends before the flop pays neither.
 * The winner receives pot − rake − jackpot.
 */
export const RAKE_STEP = 25;

export type RakeRounding = "down" | "up" | "nearest";
export const RAKE_ROUNDINGS: RakeRounding[] = ["down", "up", "nearest"];

/** Chip units the rake can be rounded to (the smallest chip on the table). */
export const CHIP_UNITS = [1, 5, 25, 100] as const;

/** Default smallest chip for the blinds: the largest of 25 / 5 / 1 that both blinds are made of (1/3 → 1, 10/20 → 5, 100/200 → 25). */
export function chipUnit(sb: number, bb: number): number {
  return [25, 5, 1].find((u) => sb % u === 0 && bb % u === 0) ?? 1;
}

export interface RakeRule {
  /** Percent of the pot, e.g. 5 for 5%. */
  percent: number;
  /** Maximum rake per hand in chips; 0 = no cap. */
  cap: number;
  noFlopNoDrop: boolean;
  jackpot: { enabled: boolean; amount: number };
  /** How pot × percent is rounded to the smallest chip. */
  rounding: RakeRounding;
}

/** 5%, MAX 1,000, no flop no drop, no jackpot, rounded up. */
export const DEFAULT_RAKE_RULE: RakeRule = { percent: 5, cap: 1000, noFlopNoDrop: true, jackpot: { enabled: false, amount: 200 }, rounding: "up" };
/** Typical small-game rule (1/3 …): 10%, MAX 5, jackpot 1. */
export const SMALL_GAME_RAKE_RULE: RakeRule = { percent: 10, cap: 5, noFlopNoDrop: true, jackpot: { enabled: true, amount: 1 }, rounding: "up" };

export interface RakeResult {
  rake: number;
  jackpot: number;
  payout: number;
  /** Why nothing was taken, if so. */
  reason: "no-flop" | null;
  /** Rake before the cap was applied (for the explanation). */
  uncapped: number;
  /** Smallest chip the rake was rounded to. */
  unit: number;
}

export function roundDownToStep(x: number, step = RAKE_STEP): number {
  return Math.floor(x / step + 1e-9) * step;
}

/** Rounds to a multiple of `step`; "nearest" rounds halves up (四捨五入). */
export function roundToStep(x: number, step: number, mode: RakeRounding): number {
  const q = x / step;
  const n = mode === "up" ? Math.ceil(q - 1e-9) : mode === "nearest" ? Math.floor(q + 0.5 + 1e-9) : Math.floor(q + 1e-9);
  return n * step;
}

export function computeRake(pot: number, sawFlop: boolean, rule: RakeRule, unit = RAKE_STEP): RakeResult {
  if (pot < 0) throw new Error("Negative pot");
  if (rule.noFlopNoDrop && !sawFlop) return { rake: 0, jackpot: 0, payout: pot, reason: "no-flop", uncapped: 0, unit };
  const uncapped = Math.min(pot, roundToStep((pot * rule.percent) / 100, unit, rule.rounding ?? "up"));
  const rake = rule.cap > 0 ? Math.min(uncapped, rule.cap) : uncapped;
  const jackpot = rule.jackpot.enabled && rule.jackpot.amount > 0 && rake > 0 && pot - rake > rule.jackpot.amount ? rule.jackpot.amount : 0;
  return { rake, jackpot, payout: pot - rake - jackpot, reason: null, uncapped, unit };
}

/** Normalise user input: percent 0–20 in 0.5 steps, amounts in whole chips. */
export function normalizeRakeRule(r: RakeRule): RakeRule {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
  return {
    percent: Math.round(clamp(r.percent, 0, 20) * 2) / 2,
    cap: Math.floor(clamp(r.cap, 0, 10_000_000)),
    noFlopNoDrop: !!r.noFlopNoDrop,
    jackpot: { enabled: !!r.jackpot.enabled, amount: Math.floor(clamp(r.jackpot.amount, 0, 10_000_000)) },
    rounding: RAKE_ROUNDINGS.includes(r.rounding) ? r.rounding : "up",
  };
}

/** Normalise blinds input: whole chips ≥ 1. SB > BB is allowed while typing (the settings warn). */
export function normalizeBlinds(sb: number, bb: number): { sb: number; bb: number } {
  const whole = (v: number) => Math.min(10_000_000, Math.max(1, Math.floor(Number.isFinite(v) ? v : 1)));
  return { sb: whole(sb), bb: whole(bb) };
}
