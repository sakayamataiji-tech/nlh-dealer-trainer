/**
 * Chip denominations and breakdowns used to show bets as physical chips.
 * All generated amounts are multiples of 25, so every amount breaks down exactly.
 */
export const DENOMINATIONS = [100000, 25000, 5000, 1000, 500, 100, 25] as const;
export type Denomination = (typeof DENOMINATIONS)[number];

/** denomination → count */
export type ChipCounts = Partial<Record<Denomination, number>>;

/** Fewest-chips breakdown (how a player would push the amount in). */
export function breakdown(amount: number): ChipCounts {
  if (amount < 0 || amount % 25 !== 0) throw new Error(`Amount ${amount} is not a multiple of 25`);
  const out: ChipCounts = {};
  let rest = amount;
  for (const d of DENOMINATIONS) {
    const n = Math.floor(rest / d);
    if (n > 0) {
      out[d] = n;
      rest -= n * d;
    }
  }
  return out;
}

export function addCounts(a: ChipCounts, b: ChipCounts): ChipCounts {
  const out: ChipCounts = { ...a };
  for (const d of DENOMINATIONS) if (b[d]) out[d] = (out[d] ?? 0) + b[d]!;
  return out;
}

export function countsValue(c: ChipCounts): number {
  return DENOMINATIONS.reduce((s, d) => s + (c[d] ?? 0) * d, 0);
}
