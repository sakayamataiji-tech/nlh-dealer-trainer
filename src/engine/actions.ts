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

/**
 * Ante formats:
 *  - "none": no ante
 *  - "all":  every player posts `ante` before the blinds (traditional ante)
 *  - "bb":   the big blind posts `ante` for the table (BB ante). If the BB cannot cover both,
 *            the blind takes priority over the ante (TDA).
 * Antes are dead money: they go to the main pot and are never matched or returned.
 */
export type AnteType = "none" | "all" | "bb";

export interface BlindStructure {
  sb: number;
  bb: number;
  /** Ante amount per payer (0 = no ante). */
  ante: number;
  /** Defaults to "all" when ante > 0. */
  anteType?: AnteType;
}

export function anteTypeOf(b: BlindStructure): AnteType {
  if (!b.ante) return "none";
  return b.anteType && b.anteType !== "none" ? b.anteType : "all";
}
