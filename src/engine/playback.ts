import type { ActionType, BlindStructure, Street, TableAction, TablePlayer } from "./actions";
import { STREETS } from "./actions";
import { addCounts, breakdown, type ChipCounts } from "./chips";

/**
 * Turns an action log into frames for an animated table: chips in front of each
 * player (current street), the collected pot in the middle, folds, and returned
 * (uncalled) chips. Independent from the pot calculator so the two cross-check:
 * the final frame's pot + chips in front always equals calculatePot(...).total.
 */
export type FramePhase = "start" | "action" | "return" | "collect" | "deal";

export interface PlaybackFrame {
  phase: FramePhase;
  street: Street;
  /** Street total in front of each player (not yet collected). */
  fronts: Record<string, number>;
  /** Chips physically pushed in front of each player this street. */
  frontChips: Record<string, ChipCounts>;
  /** Collected pot (antes + previous streets). */
  pot: number;
  potChips: ChipCounts;
  folded: string[];
  allIn: string[];
  /** Who acted in this frame (for the action badge). */
  actor?: string;
  actionType?: ActionType;
  /** Player whose uncalled chips were returned in this frame. */
  returnedTo?: string;
  /** Community cards visible for this street (0/3/4/5). */
  boardCount: number;
}

const BOARD_COUNT: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

export function buildPlaybackFrames(players: readonly TablePlayer[], _blinds: BlindStructure, actions: readonly TableAction[]): PlaybackFrame[] {
  const stack: Record<string, number> = Object.fromEntries(players.map((p) => [p.id, p.stack]));
  let fronts: Record<string, number> = Object.fromEntries(players.map((p) => [p.id, 0]));
  let frontChips: Record<string, ChipCounts> = Object.fromEntries(players.map((p) => [p.id, {}]));
  let pot = 0;
  let potChips: ChipCounts = {};
  const folded = new Set<string>();
  const allIn = new Set<string>();
  let street: Street = "preflop";
  let currentBet = 0;
  const frames: PlaybackFrame[] = [];

  const snapshot = (phase: FramePhase, extra: Partial<PlaybackFrame> = {}) =>
    frames.push({
      phase,
      street,
      fronts: { ...fronts },
      frontChips: { ...frontChips },
      pot,
      potChips: { ...potChips },
      folded: [...folded],
      allIn: [...allIn],
      boardCount: BOARD_COUNT[street],
      ...extra,
    });

  const push = (id: string, amount: number) => {
    const a = Math.min(amount, stack[id]);
    stack[id] -= a;
    fronts[id] += a;
    frontChips[id] = breakdown(fronts[id]);
    if (stack[id] === 0) allIn.add(id);
  };

  /** Uncalled excess over the second-highest bet goes back to the bettor. */
  const returnUncalled = () => {
    const sorted = Object.entries(fronts).sort((x, y) => y[1] - x[1]);
    if (sorted.length >= 2 && sorted[0][1] > sorted[1][1]) {
      const [id, amt] = sorted[0];
      const excess = amt - sorted[1][1];
      fronts[id] -= excess;
      stack[id] += excess;
      frontChips[id] = breakdown(fronts[id]);
      if (stack[id] > 0) allIn.delete(id);
      snapshot("return", { returnedTo: id });
    }
  };

  const collect = () => {
    for (const p of players) {
      if (fronts[p.id] > 0) {
        pot += fronts[p.id];
        potChips = addCounts(potChips, frontChips[p.id]);
      }
    }
    fronts = Object.fromEntries(players.map((p) => [p.id, 0]));
    frontChips = Object.fromEntries(players.map((p) => [p.id, {}]));
    currentBet = 0;
    snapshot("collect");
  };

  // Antes go straight to the pot (dead money), blinds go in front.
  let i = 0;
  while (i < actions.length && ["ante", "post_sb", "post_bb"].includes(actions[i].type)) {
    const a = actions[i];
    if (a.type === "ante") {
      const amt = Math.min(a.amount ?? 0, stack[a.playerId]);
      stack[a.playerId] -= amt;
      pot += amt;
      potChips = addCounts(potChips, breakdown(amt));
      if (stack[a.playerId] === 0) allIn.add(a.playerId);
    } else {
      push(a.playerId, a.amount ?? 0);
      currentBet = Math.max(currentBet, a.amount ?? 0);
    }
    i++;
  }
  snapshot("start");

  for (; i < actions.length; i++) {
    const a = actions[i];
    while (a.street !== street) {
      returnUncalled();
      collect();
      street = STREETS[STREETS.indexOf(street) + 1];
      snapshot("deal");
    }
    switch (a.type) {
      case "fold":
        folded.add(a.playerId);
        break;
      case "check":
        break;
      case "call":
        push(a.playerId, currentBet - fronts[a.playerId]);
        break;
      case "bet":
      case "raise":
        push(a.playerId, (a.amount ?? 0) - fronts[a.playerId]);
        currentBet = Math.max(currentBet, fronts[a.playerId]);
        break;
      case "allin":
        push(a.playerId, stack[a.playerId]);
        currentBet = Math.max(currentBet, fronts[a.playerId]);
        break;
      default:
        break;
    }
    snapshot("action", { actor: a.playerId, actionType: a.type });
  }
  // End of the asked street: return any uncalled chips; the last street's bets stay in front.
  returnUncalled();
  return frames;
}

/** Total in the final frame (pot + chips in front). */
export function frameTotal(f: PlaybackFrame): number {
  return f.pot + Object.values(f.fronts).reduce((a, b) => a + b, 0);
}
