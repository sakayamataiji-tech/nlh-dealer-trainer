/**
 * Card primitives. A card is encoded as a 2-char string like "As", "Td", "2c".
 * Rank values: 2..14 (Ace = 14). Suits: s(♠) h(♥) d(♦) c(♣).
 */
export type Suit = "s" | "h" | "d" | "c";
export type RankChar = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "T" | "J" | "Q" | "K" | "A";
export type Card = `${RankChar}${Suit}`;

export const SUITS: readonly Suit[] = ["s", "h", "d", "c"];
export const RANK_CHARS: readonly RankChar[] = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

export const SUIT_SYMBOL: Record<Suit, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const SUIT_NAME: Record<Suit, string> = { s: "Spades", h: "Hearts", d: "Diamonds", c: "Clubs" };

export function rankValue(card: Card): number {
  return RANK_CHARS.indexOf(card[0] as RankChar) + 2;
}

export function suitOf(card: Card): Suit {
  return card[1] as Suit;
}

export function makeCard(rank: number, suit: Suit): Card {
  if (rank < 2 || rank > 14) throw new Error(`Invalid rank ${rank}`);
  return `${RANK_CHARS[rank - 2]}${suit}` as Card;
}

export function isCard(value: string): value is Card {
  return value.length === 2 && RANK_CHARS.includes(value[0] as RankChar) && SUITS.includes(value[1] as Suit);
}

/** Parse "As Kd Qc" / ["As","Kd"] into validated cards. */
export function parseCards(input: string | string[]): Card[] {
  const parts = Array.isArray(input) ? input : input.trim().split(/\s+/).filter(Boolean);
  return parts.map((p) => {
    const normalized = p.length === 3 && p.startsWith("10") ? `T${p[2]}` : p;
    if (!isCard(normalized)) throw new Error(`Invalid card: ${p}`);
    return normalized;
  });
}

/** Rank label for display: T -> 10. */
export function rankLabel(rank: number): string {
  const c = RANK_CHARS[rank - 2];
  return c === "T" ? "10" : c;
}

export function cardLabel(card: Card): string {
  return `${rankLabel(rankValue(card))}${SUIT_SYMBOL[suitOf(card)]}`;
}

export function isRed(card: Card): boolean {
  const s = suitOf(card);
  return s === "h" || s === "d";
}

const RANK_NAMES: Record<number, [string, string]> = {
  2: ["Two", "Twos"],
  3: ["Three", "Threes"],
  4: ["Four", "Fours"],
  5: ["Five", "Fives"],
  6: ["Six", "Sixes"],
  7: ["Seven", "Sevens"],
  8: ["Eight", "Eights"],
  9: ["Nine", "Nines"],
  10: ["Ten", "Tens"],
  11: ["Jack", "Jacks"],
  12: ["Queen", "Queens"],
  13: ["King", "Kings"],
  14: ["Ace", "Aces"],
};

export function rankName(rank: number, plural = false): string {
  return RANK_NAMES[rank][plural ? 1 : 0];
}
