import { type Card, rankName, rankValue, suitOf, cardLabel } from "./cards";
import { assertNoDuplicates } from "./deck";

export enum HandCategory {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export const CATEGORY_ORDER: readonly HandCategory[] = [
  HandCategory.HighCard,
  HandCategory.OnePair,
  HandCategory.TwoPair,
  HandCategory.ThreeOfAKind,
  HandCategory.Straight,
  HandCategory.Flush,
  HandCategory.FullHouse,
  HandCategory.FourOfAKind,
  HandCategory.StraightFlush,
];

export const CATEGORY_LABEL: Record<HandCategory, string> = {
  [HandCategory.HighCard]: "High Card",
  [HandCategory.OnePair]: "One Pair",
  [HandCategory.TwoPair]: "Two Pair",
  [HandCategory.ThreeOfAKind]: "Three of a Kind",
  [HandCategory.Straight]: "Straight",
  [HandCategory.Flush]: "Flush",
  [HandCategory.FullHouse]: "Full House",
  [HandCategory.FourOfAKind]: "Four of a Kind",
  [HandCategory.StraightFlush]: "Straight Flush",
};

export interface EvaluatedHand {
  category: HandCategory;
  /** Rank values in significance order used for tie-breaking (length ≤ 5). */
  tiebreak: number[];
  /** Single comparable number: higher is better, equal means exact tie. */
  value: number;
  /** Best five cards, ordered by significance (e.g. K K 8 8 A, wheel = 5 4 3 2 A). */
  bestFive: Card[];
  /** True when the straight flush is A-high. */
  isRoyal: boolean;
}

function encode(category: HandCategory, tiebreak: number[]): number {
  let v = category;
  for (let i = 0; i < 5; i++) v = v * 16 + (tiebreak[i] ?? 0);
  return v;
}

/** Straight high card from a set of distinct rank values, or 0. Handles wheel (A-2-3-4-5 → 5). */
function straightHigh(ranksDesc: number[]): number {
  const set = new Set(ranksDesc);
  for (let high = 14; high >= 5; high--) {
    let ok = true;
    for (let r = high; r > high - 5; r--) {
      const need = r === 1 ? 14 : r;
      if (!set.has(need)) {
        ok = false;
        break;
      }
    }
    if (ok) return high;
  }
  return 0;
}

function straightRanks(high: number): number[] {
  return [high, high - 1, high - 2, high - 3, high - 4].map((r) => (r === 1 ? 14 : r));
}

/** Evaluate exactly five cards. */
export function evaluateFive(cards: readonly Card[]): EvaluatedHand {
  if (cards.length !== 5) throw new Error("evaluateFive requires 5 cards");
  const sorted = [...cards].sort((a, b) => rankValue(b) - rankValue(a));
  const ranks = sorted.map(rankValue);
  const isFlush = sorted.every((c) => suitOf(c) === suitOf(sorted[0]));
  const distinct = [...new Set(ranks)];
  const sHigh = distinct.length === 5 ? straightHigh(distinct) : 0;

  const orderByRanks = (order: number[]): Card[] => {
    const pool = [...sorted];
    return order.map((r) => {
      const i = pool.findIndex((c) => rankValue(c) === r);
      return pool.splice(i, 1)[0];
    });
  };

  if (sHigh) {
    const order = straightRanks(sHigh);
    const bestFive = orderByRanks(order);
    const category = isFlush ? HandCategory.StraightFlush : HandCategory.Straight;
    return { category, tiebreak: [sHigh], value: encode(category, [sHigh]), bestFive, isRoyal: isFlush && sHigh === 14 };
  }
  if (isFlush) {
    return { category: HandCategory.Flush, tiebreak: ranks, value: encode(HandCategory.Flush, ranks), bestFive: sorted, isRoyal: false };
  }

  // Group by count desc, then rank desc.
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const tiebreak = groups.map(([r]) => r);
  const order = groups.flatMap(([r, n]) => Array(n).fill(r) as number[]);
  const bestFive = orderByRanks(order);
  const shape = groups.map(([, n]) => n).join("");
  const category =
    shape === "41" ? HandCategory.FourOfAKind
    : shape === "32" ? HandCategory.FullHouse
    : shape === "311" ? HandCategory.ThreeOfAKind
    : shape === "221" ? HandCategory.TwoPair
    : shape === "2111" ? HandCategory.OnePair
    : HandCategory.HighCard;
  return { category, tiebreak, value: encode(category, tiebreak), bestFive, isRoyal: false };
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const combo: T[] = [];
  const rec = (start: number) => {
    if (combo.length === k) {
      out.push([...combo]);
      return;
    }
    for (let i = start; i <= items.length - (k - combo.length); i++) {
      combo.push(items[i]);
      rec(i + 1);
      combo.pop();
    }
  };
  rec(0);
  return out;
}

/** Evaluate the best five-card hand from 5–7 cards (e.g. 2 hole + 5 board). */
export function evaluateHand(cards: readonly Card[]): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7) throw new Error("evaluateHand requires 5-7 cards");
  assertNoDuplicates(cards);
  let best: EvaluatedHand | null = null;
  for (const five of combinations(cards, 5)) {
    const e = evaluateFive(five);
    if (!best || e.value > best.value) best = e;
  }
  return best!;
}

export function evaluatePlayer(hole: readonly Card[], board: readonly Card[]): EvaluatedHand {
  return evaluateHand([...hole, ...board]);
}

/** Short category name, with Royal Flush special-cased. */
export function handName(h: EvaluatedHand): string {
  return h.isRoyal ? "Royal Flush" : CATEGORY_LABEL[h.category];
}

/** Human description, e.g. "Kings & Eights, Ace Kicker". */
export function describeHand(h: EvaluatedHand): string {
  const t = h.tiebreak;
  const kick = (rs: number[]) => rs.map((r) => rankName(r)).join("-");
  switch (h.category) {
    case HandCategory.HighCard:
      return `${rankName(t[0])} High, ${kick(t.slice(1))} Kickers`;
    case HandCategory.OnePair:
      return `Pair of ${rankName(t[0], true)}, ${kick(t.slice(1))} Kickers`;
    case HandCategory.TwoPair:
      return `${rankName(t[0], true)} & ${rankName(t[1], true)}, ${rankName(t[2])} Kicker`;
    case HandCategory.ThreeOfAKind:
      return `Three ${rankName(t[0], true)}, ${kick(t.slice(1))} Kickers`;
    case HandCategory.Straight:
      return t[0] === 5 ? "Five High Straight (Wheel)" : `${rankName(t[0])} High Straight`;
    case HandCategory.Flush:
      return `${rankName(t[0])} High Flush (${kick(t.slice(1))})`;
    case HandCategory.FullHouse:
      return `${rankName(t[0], true)} Full of ${rankName(t[1], true)}`;
    case HandCategory.FourOfAKind:
      return `Four ${rankName(t[0], true)}, ${rankName(t[1])} Kicker`;
    case HandCategory.StraightFlush:
      return h.isRoyal ? "Royal Flush" : t[0] === 5 ? "Five High Straight Flush (Steel Wheel)" : `${rankName(t[0])} High Straight Flush`;
  }
}

/** "A-K-Q-J-T" style rank string of the best five. */
export function bestFiveRanks(h: EvaluatedHand): string {
  return h.bestFive.map((c) => c[0]).join("-");
}

export function bestFiveLabel(h: EvaluatedHand): string {
  return h.bestFive.map(cardLabel).join(" ");
}

/** True when the best five contain no hole cards (board plays). */
export function boardPlays(hole: readonly Card[], h: EvaluatedHand): boolean {
  return !h.bestFive.some((c) => hole.includes(c));
}
