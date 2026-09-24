/**
 * Action model shared by the betting engine and the pot calculators.
 *
 * Amount semantics (unified "raise to"):
 *  - bet / raise: `amount` = the player's TOTAL commitment on this street after the action.
 *  - call: `amount` (optional, display only) = the street total being matched.
 *  - allin: `amount` (optional, display only) = the player's street total after shoving.
 *  - post_sb / post_bb / ante: `amount` = the blind/ante size requested (capped by stack).
 */
export type Street = "preflop" | "flop" | "turn" | "river";
export const STREETS: readonly Street[] = ["preflop", "flop", "turn", "river"];

export type ActionType = "ante" | "post_sb" | "post_bb" | "fold" | "check" | "call" | "bet" | "raise" | "allin";

export interface TableAction {
  playerId: string;
  street: Street;
  type: ActionType;
  amount?: number;
}

export interface TablePlayer {
  id: string;
  /** Display label, e.g. "UTG", "BTN", "Player A". */
  name: string;
  stack: number;
}

export interface BlindStructure {
  sb: number;
  bb: number;
  /** MVP: always 0. Supported by the engine for future use. */
  ante: number;
}
