/**
 * REAL TABLE MODE — design only (spec §18, post-MVP).
 *
 * A full hand is played at a 6–9 handed table and the USER performs the dealer's
 * procedure. The existing engine pieces are reused:
 *   - Dealer / shuffle            → deck handling, burn cards
 *   - HandState (bettingEngine)   → legal action flow & action order
 *   - calculatePot / buildPots    → pot and side pots at every street
 *   - resolveShowdown / awardPots → winners, split pots, odd chips
 *
 * The user's operations are recorded as DealerOperations and compared against the
 * engine's expected operation at each step. Feedback can be immediate or deferred
 * to the end of the hand ("review" mode).
 */
import type { Card } from "../cards";
import type { Street, TableAction } from "../actions";

export type DealerOperation =
  | { kind: "deal-hole" }
  | { kind: "burn" }
  | { kind: "flop" }
  | { kind: "turn" }
  | { kind: "river" }
  | { kind: "announce-action-on"; playerId: string }
  | { kind: "declare-pot"; amount: number }
  | { kind: "declare-side-pots"; amounts: number[] }
  | { kind: "return-uncalled"; playerId: string; amount: number }
  | { kind: "award"; potIndex: number; playerIds: string[] };

export type FeedbackTiming = "immediate" | "end-of-hand";

export interface DealerMistake {
  step: number;
  street: Street;
  expected: DealerOperation;
  actual: DealerOperation;
  /** Human explanation generated from the rules engine. */
  explanation: string;
}

export interface RealTableConfig {
  players: number; // 6..9
  feedback: FeedbackTiming;
  /** Future: store-specific house rules (odd chip placement, blind rules, ...). */
  houseRules?: Record<string, unknown>;
}

export interface RealTableHandLog {
  board: Card[];
  holeCards: Record<string, Card[]>;
  actions: TableAction[];
  operations: DealerOperation[];
  mistakes: DealerMistake[];
}
