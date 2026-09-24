/**
 * Contribution-based pot builder.
 *
 *  - Pot layers are cut at every distinct contribution level.
 *  - Eligible players for a layer = non-folded players who contributed at least the layer's top.
 *  - Folded players' chips stay in the pots, but they are never eligible.
 *  - A layer funded by a single player is an uncalled amount and is returned to that player.
 *  - Adjacent layers with identical eligibility are merged (folded players' levels never create extra pots).
 *  - A layer with contributors but no eligible players (all folded) is merged into the pot below.
 *  - Dead money (antes) is added to the main pot; pass BETTING contributions (antes excluded).
 */
export interface Contribution {
  playerId: string;
  amount: number;
  folded: boolean;
}

export interface Pot {
  /** 0 = main pot, 1.. = side pots */
  index: number;
  name: string;
  amount: number;
  eligible: string[];
  /** Per-player amount that went into this pot (betting only). */
  contributors: Record<string, number>;
  /** Dead money (antes) included in `amount` — main pot only. */
  deadMoney: number;
}

export interface SidePotResult {
  pots: Pot[];
  returned: { playerId: string; amount: number }[];
  total: number;
  deadMoney: number;
}

export function potName(index: number): string {
  return index === 0 ? "MAIN POT" : `SIDE POT ${index}`;
}

export function buildPots(contributions: readonly Contribution[], opts: { deadMoney?: number } = {}): SidePotResult {
  const deadMoney = opts.deadMoney ?? 0;
  for (const c of contributions) {
    if (!Number.isFinite(c.amount) || c.amount < 0) throw new Error(`Invalid contribution for ${c.playerId}`);
  }
  const levels = [...new Set(contributions.map((c) => c.amount).filter((a) => a > 0))].sort((a, b) => a - b);
  type Layer = { amount: number; eligible: string[]; contributors: Record<string, number> };
  const layers: Layer[] = [];
  const returned: { playerId: string; amount: number }[] = [];
  let prev = 0;
  for (const level of levels) {
    const slice = level - prev;
    const payers = contributions.filter((c) => c.amount >= level);
    const contributorsMap: Record<string, number> = {};
    for (const p of payers) contributorsMap[p.playerId] = slice;
    const amount = slice * payers.length;
    if (payers.length === 1) {
      const r = returned.find((x) => x.playerId === payers[0].playerId);
      if (r) r.amount += amount;
      else returned.push({ playerId: payers[0].playerId, amount });
    } else {
      const eligible = payers.filter((p) => !p.folded).map((p) => p.playerId);
      layers.push({ amount, eligible, contributors: contributorsMap });
    }
    prev = level;
  }

  // Merge dead layers (no eligible) downward, then merge equal-eligibility neighbours.
  const merged: Layer[] = [];
  const addInto = (target: Layer, src: Layer) => {
    target.amount += src.amount;
    for (const [id, v] of Object.entries(src.contributors)) target.contributors[id] = (target.contributors[id] ?? 0) + v;
  };
  const pending: Layer[] = [];
  for (const layer of layers) {
    if (layer.eligible.length === 0) {
      if (merged.length > 0) addInto(merged[merged.length - 1], layer);
      else pending.push(layer);
      continue;
    }
    const last = merged[merged.length - 1];
    if (last && sameSet(last.eligible, layer.eligible)) addInto(last, layer);
    else merged.push({ amount: layer.amount, eligible: [...layer.eligible], contributors: { ...layer.contributors } });
    if (pending.length) {
      for (const d of pending.splice(0)) addInto(merged[merged.length - 1], d);
    }
  }
  if (pending.length) throw new Error("No eligible player for any pot");

  const pots: Pot[] = merged.map((l, i) => ({ index: i, name: potName(i), amount: l.amount, eligible: l.eligible, contributors: l.contributors, deadMoney: 0 }));
  if (deadMoney > 0) {
    if (pots.length === 0) {
      const live = contributions.filter((c) => !c.folded).map((c) => c.playerId);
      if (live.length === 0) throw new Error("No eligible player for dead money");
      pots.push({ index: 0, name: potName(0), amount: 0, eligible: live, contributors: {}, deadMoney: 0 });
    }
    pots[0].amount += deadMoney;
    pots[0].deadMoney = deadMoney;
  }
  const total = pots.reduce((s, p) => s + p.amount, 0);
  return { pots, returned, total, deadMoney };
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/**
 * Split a pot among winners. Odd chips (in units of `chipUnit`) go one at a time to
 * winners in `seatOrder`, which should start with the first seat left of the button.
 */
export function splitPot(amount: number, winners: readonly string[], seatOrder: readonly string[], chipUnit = 1): Record<string, number> {
  if (winners.length === 0) throw new Error("No winners");
  if (amount % chipUnit !== 0) throw new Error("Pot is not a multiple of the chip unit");
  const units = amount / chipUnit;
  const base = Math.floor(units / winners.length);
  let odd = units - base * winners.length;
  const out: Record<string, number> = {};
  for (const w of winners) out[w] = base * chipUnit;
  const ordered = seatOrder.filter((s) => winners.includes(s));
  if (ordered.length !== winners.length) throw new Error("seatOrder must include every winner");
  for (const w of ordered) {
    if (odd === 0) break;
    out[w] += chipUnit;
    odd--;
  }
  return out;
}

/** Award every pot given each player's hand value (higher is better). */
export function awardPots(
  result: SidePotResult,
  handValue: Record<string, number>,
  seatOrder: readonly string[],
  chipUnit = 1,
): { potWinners: string[][]; payouts: Record<string, number> } {
  const payouts: Record<string, number> = {};
  const potWinners: string[][] = [];
  for (const pot of result.pots) {
    const best = Math.max(...pot.eligible.map((id) => handValue[id]));
    const winners = pot.eligible.filter((id) => handValue[id] === best);
    potWinners.push(winners);
    for (const [id, v] of Object.entries(splitPot(pot.amount, winners, seatOrder, chipUnit))) payouts[id] = (payouts[id] ?? 0) + v;
  }
  for (const r of result.returned) payouts[r.playerId] = (payouts[r.playerId] ?? 0) + r.amount;
  return { potWinners, payouts };
}
