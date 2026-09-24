import { type Card, RANK_CHARS, SUITS } from "./cards";

/** Fresh ordered 52-card deck. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of SUITS) for (const r of RANK_CHARS) deck.push(`${r}${s}` as Card);
  return deck;
}

/** Deck without the given cards. */
export function remainingDeck(exclude: Iterable<Card>): Card[] {
  const ex = new Set(exclude);
  return createDeck().filter((c) => !ex.has(c));
}

/** Throws if any card appears twice. */
export function assertNoDuplicates(cards: readonly Card[]): void {
  const seen = new Set<Card>();
  for (const c of cards) {
    if (seen.has(c)) throw new Error(`Duplicate card: ${c}`);
    seen.add(c);
  }
}

/**
 * Sequential dealer over a shuffled deck. Guarantees no card is dealt twice.
 * `take` removes specific cards (used by scenario templates).
 */
export class Dealer {
  private cards: Card[];
  constructor(shuffledDeck: Card[]) {
    assertNoDuplicates(shuffledDeck);
    this.cards = [...shuffledDeck];
  }
  get remaining(): number {
    return this.cards.length;
  }
  deal(n = 1): Card[] {
    if (n > this.cards.length) throw new Error("Deck exhausted");
    return this.cards.splice(0, n);
  }
  take(card: Card): Card {
    const i = this.cards.indexOf(card);
    if (i === -1) throw new Error(`Card not in deck: ${card}`);
    this.cards.splice(i, 1);
    return card;
  }
  has(card: Card): boolean {
    return this.cards.includes(card);
  }
  /** Deal the first card matching a predicate. */
  dealWhere(pred: (c: Card) => boolean): Card | null {
    const i = this.cards.findIndex(pred);
    if (i === -1) return null;
    return this.cards.splice(i, 1)[0];
  }
  peekAll(): readonly Card[] {
    return this.cards;
  }
}
