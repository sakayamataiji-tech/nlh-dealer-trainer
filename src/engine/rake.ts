/**
 * Cash-game rake and jackpot drop, taken from the final pot (after uncalled bets are returned).
 *
 *  - Rake = pot × percent, rounded DOWN to the smallest chip (RAKE_STEP), capped at `cap` (0 = no cap).
 *  - Jackpot drop = a fixed amount, taken only together with the rake (rake > 0) and only if
 *    something is still left for the winner.
 *  - No flop, no drop: a hand that ends before the flop pays neither.
 * The winner receives pot − rake − jackpot.
 */
export const RAKE_STEP = 25;

export interface RakeRule {
  /** Percent of the pot, e.g. 5 for 5%. */
  percent: number;
  /** Maximum rake per hand in chips; 0 = no cap. */
  cap: number;
  noFlopNoDrop: boolean;
  jackpot: { enabled: boolean; amount: number };
}

export interface RakeResult {
  rake: number;
  jackpot: number;
  payout: number;
  /** Why nothing was taken, if so. */
  reason: "no-flop" | null;
  /** Rake before the cap was applied (for the explanation). */
  uncapped: number;
}

export function roundDownToStep(x: number, step = RAKE_STEP): number {
  return Math.floor(x / step + 1e-9) * step;
}

export function computeRake(pot: number, sawFlop: boolean, rule: RakeRule): RakeResult {
  if (pot < 0) throw new Error("Negative pot");
  if (rule.noFlopNoDrop && !sawFlop) return { rake: 0, jackpot: 0, payout: pot, reason: "no-flop", uncapped: 0 };
  const uncapped = roundDownToStep((pot * rule.percent) / 100);
  const rake = rule.cap > 0 ? Math.min(uncapped, rule.cap) : uncapped;
  const jackpot = rule.jackpot.enabled && rule.jackpot.amount > 0 && rake > 0 && pot - rake > rule.jackpot.amount ? rule.jackpot.amount : 0;
  return { rake, jackpot, payout: pot - rake - jackpot, reason: null, uncapped };
}

/** Normalise user input: percent 0–20 in 0.5 steps, amounts in chip steps. */
export function normalizeRakeRule(r: RakeRule): RakeRule {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
  return {
    percent: Math.round(clamp(r.percent, 0, 20) * 2) / 2,
    cap: roundDownToStep(clamp(r.cap, 0, 10_000_000)),
    noFlopNoDrop: !!r.noFlopNoDrop,
    jackpot: { enabled: !!r.jackpot.enabled, amount: roundDownToStep(clamp(r.jackpot.amount, 0, 10_000_000)) },
  };
}
