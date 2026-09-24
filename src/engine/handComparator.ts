import type { Card } from "./cards";
import { type EvaluatedHand, evaluatePlayer } from "./handEvaluator";

/** Negative if a < b, 0 if tie, positive if a > b. */
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  return a.value - b.value;
}

export interface ShowdownEntry {
  id: string;
  hole: readonly Card[];
}

export interface ShowdownResultEntry {
  id: string;
  hand: EvaluatedHand;
  /** 1 = best. Tied hands share a rank. */
  rank: number;
}

export interface ShowdownResult {
  /** All ids holding the best hand value (length > 1 means split). */
  winners: string[];
  entries: ShowdownResultEntry[];
  isSplit: boolean;
}

/** Rank any number of players; returns every winner (supports multi-way split). */
export function resolveShowdown(board: readonly Card[], players: readonly ShowdownEntry[]): ShowdownResult {
  if (players.length === 0) throw new Error("No players in showdown");
  const evaluated = players.map((p) => ({ id: p.id, hand: evaluatePlayer(p.hole, board) }));
  const distinctValues = [...new Set(evaluated.map((e) => e.hand.value))].sort((a, b) => b - a);
  const entries = evaluated.map((e) => ({ ...e, rank: distinctValues.indexOf(e.hand.value) + 1 }));
  const winners = entries.filter((e) => e.rank === 1).map((e) => e.id);
  return { winners, entries, isSplit: winners.length > 1 };
}

/** Ids of best hands among the given subset (used per side pot). */
export function winnersAmong(result: ShowdownResult, eligible: readonly string[]): string[] {
  const pool = result.entries.filter((e) => eligible.includes(e.id));
  if (pool.length === 0) return [];
  const best = Math.max(...pool.map((e) => e.hand.value));
  return pool.filter((e) => e.hand.value === best).map((e) => e.id);
}
