/**
 * Position names for a table listed clockwise starting from the small blind.
 * Index 0 = SB, 1 = BB, ..., last = BTN. Heads-up: index 0 = BTN/SB, 1 = BB.
 */
const MIDDLE_CANONICAL = ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"] as const;
const MIDDLE_PRIORITY = ["CO", "HJ", "LJ", "UTG+1", "UTG+2"] as const;

export function positionNames(n: number): string[] {
  if (n < 2 || n > 10) throw new Error("Player count must be 2-10");
  if (n === 2) return ["BTN/SB", "BB"];
  const m = n - 3;
  const chosen = new Set<string>();
  if (m >= 1) chosen.add("UTG");
  for (const p of MIDDLE_PRIORITY.slice(0, Math.max(0, m - 1))) chosen.add(p);
  const middle: string[] = MIDDLE_CANONICAL.filter((p) => chosen.has(p));
  // 10-handed fallback: add a generic MP seat.
  while (middle.length < m) middle.splice(1, 0, `MP${middle.length}`);
  return ["SB", "BB", ...middle, "BTN"];
}

/** Index of the button in the SB-first ordering. */
export function buttonIndex(n: number): number {
  return n === 2 ? 0 : n - 1;
}
