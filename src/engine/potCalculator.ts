import type { BlindStructure, Street, TableAction, TablePlayer } from "./actions";
import { STREETS } from "./actions";

/**
 * Independent replay of an action log. Does NOT depend on the betting engine,
 * so the two implementations cross-check each other in tests.
 *
 * Raise/bet amounts are "raise to" (the player's street total).
 */
export interface PotBreakdownRow {
  playerId: string;
  name: string;
  contributed: number;
  returned: number;
  /** contributed - returned */
  inPot: number;
  folded: boolean;
  allIn: boolean;
}

export interface PotResult {
  /** Chips each player has put in (before any uncalled return). */
  contributions: Record<string, number>;
  /** Chips put in on each street per player. */
  streetContributions: Record<Street, Record<string, number>>;
  /** Cumulative pot at the end of each street that was reached (antes counted preflop). */
  potByStreet: Partial<Record<Street, number>>;
  /** Sum of all chips put in. */
  grossTotal: number;
  /** Uncalled portion returned to the last aggressor (only when settled). */
  uncalled: { playerId: string; amount: number } | null;
  /** The pot: grossTotal minus uncalled return. */
  total: number;
  folded: string[];
  allIn: string[];
  breakdown: PotBreakdownRow[];
  lastStreet: Street;
}

export function calculatePot(
  players: readonly TablePlayer[],
  _blinds: BlindStructure,
  actions: readonly TableAction[],
  opts: { settle?: boolean } = { settle: true },
): PotResult {
  const settle = opts.settle ?? true;
  const stack: Record<string, number> = {};
  const contributions: Record<string, number> = {};
  const streetContributions = Object.fromEntries(STREETS.map((s) => [s, {} as Record<string, number>])) as Record<Street, Record<string, number>>;
  const folded = new Set<string>();
  for (const p of players) {
    stack[p.id] = p.stack;
    contributions[p.id] = 0;
    for (const s of STREETS) streetContributions[s][p.id] = 0;
  }
  const potByStreet: Partial<Record<Street, number>> = {};
  let street: Street = "preflop";
  let streetBet: Record<string, number> = {};
  let currentBet = 0;

  const put = (id: string, amount: number, s: Street, toStreet = true) => {
    if (amount < 0) throw new Error(`Negative amount for ${id}`);
    if (amount > stack[id]) throw new Error(`${id} cannot put ${amount} (stack ${stack[id]})`);
    stack[id] -= amount;
    contributions[id] += amount;
    streetContributions[s][id] += amount;
    if (toStreet) streetBet[id] = (streetBet[id] ?? 0) + amount;
  };
  const sumAll = () => Object.values(contributions).reduce((a, b) => a + b, 0);

  for (const a of actions) {
    if (!(a.playerId in stack)) throw new Error(`Unknown player ${a.playerId}`);
    if (STREETS.indexOf(a.street) < STREETS.indexOf(street)) throw new Error("Actions out of street order");
    while (a.street !== street) {
      potByStreet[street] = sumAll();
      street = STREETS[STREETS.indexOf(street) + 1];
      streetBet = {};
      currentBet = 0;
    }
    if (folded.has(a.playerId)) throw new Error(`${a.playerId} acted after folding`);
    const already = streetBet[a.playerId] ?? 0;
    switch (a.type) {
      case "ante":
        put(a.playerId, Math.min(a.amount ?? 0, stack[a.playerId]), a.street, false);
        break;
      case "post_sb":
      case "post_bb": {
        put(a.playerId, Math.min(a.amount ?? 0, stack[a.playerId]), a.street);
        currentBet = Math.max(currentBet, a.amount ?? 0);
        break;
      }
      case "fold":
        folded.add(a.playerId);
        break;
      case "check":
        if (already < currentBet) throw new Error(`${a.playerId} cannot check facing a bet`);
        break;
      case "call": {
        const need = Math.min(currentBet - already, stack[a.playerId]);
        if (need <= 0) throw new Error(`${a.playerId} has nothing to call`);
        put(a.playerId, need, a.street);
        break;
      }
      case "bet":
      case "raise": {
        const to = a.amount;
        if (to === undefined) throw new Error(`${a.type} requires amount`);
        if (a.type === "bet" && currentBet > 0) throw new Error("Cannot bet facing a bet (use raise)");
        if (to <= currentBet) throw new Error(`${a.type} to ${to} must exceed current bet ${currentBet}`);
        put(a.playerId, to - already, a.street);
        currentBet = to;
        break;
      }
      case "allin": {
        put(a.playerId, stack[a.playerId], a.street);
        currentBet = Math.max(currentBet, streetBet[a.playerId] ?? 0);
        break;
      }
    }
  }
  potByStreet[street] = sumAll();

  const grossTotal = sumAll();
  let uncalled: PotResult["uncalled"] = null;
  if (settle) {
    const sorted = players.map((p) => ({ id: p.id, c: contributions[p.id] })).sort((x, y) => y.c - x.c);
    if (sorted.length >= 2 && sorted[0].c > sorted[1].c) {
      uncalled = { playerId: sorted[0].id, amount: sorted[0].c - sorted[1].c };
      potByStreet[street] = (potByStreet[street] ?? 0) - uncalled.amount;
    }
  }
  const breakdown: PotBreakdownRow[] = players.map((p) => {
    const returned = uncalled && uncalled.playerId === p.id ? uncalled.amount : 0;
    return {
      playerId: p.id,
      name: p.name,
      contributed: contributions[p.id],
      returned,
      inPot: contributions[p.id] - returned,
      folded: folded.has(p.id),
      allIn: !folded.has(p.id) && stack[p.id] === 0 && contributions[p.id] > 0,
    };
  });
  return {
    contributions,
    streetContributions,
    potByStreet,
    grossTotal,
    uncalled,
    total: grossTotal - (uncalled?.amount ?? 0),
    folded: [...folded],
    allIn: breakdown.filter((b) => b.allIn).map((b) => b.playerId),
    breakdown,
    lastStreet: street,
  };
}
