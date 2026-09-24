import { describe, expect, it } from "vitest";
import {
  bestFiveRanks,
  boardPlays,
  describeHand,
  evaluateHand,
  evaluatePlayer,
  handName,
  HandCategory as H,
} from "@/engine/handEvaluator";
import { createDeck } from "@/engine/deck";
import { rankValue, suitOf, type Card } from "@/engine/cards";
import { seededRng, shuffle } from "@/engine/shuffle";
import { c } from "./helpers";

const ev = (hole: string, board: string) => evaluatePlayer(c(hole), c(board));

describe("handEvaluator: categories", () => {
  it("high card", () => {
    const h = ev("2c 7d", "As Kd 9h 5s 3c");
    expect(h.category).toBe(H.HighCard);
    expect(bestFiveRanks(h)).toBe("A-K-9-7-5");
  });
  it("one pair", () => {
    const h = ev("Ac Ad", "Ks 9d 7h 4s 2c");
    expect(h.category).toBe(H.OnePair);
    expect(bestFiveRanks(h)).toBe("A-A-K-9-7");
  });
  it("two pair", () => {
    expect(ev("Kc 8d", "Ks 8h 3c 2d 5s").category).toBe(H.TwoPair);
  });
  it("three of a kind", () => {
    expect(ev("7c 7d", "7s Kh 2c 9d 4s").category).toBe(H.ThreeOfAKind);
  });
  it("straight", () => {
    expect(ev("9c 8d", "7s 6h Kc 5d 2s").category).toBe(H.Straight);
  });
  it("flush", () => {
    expect(ev("Ah 2h", "9h 6h Kh 5d 2s").category).toBe(H.Flush);
  });
  it("full house", () => {
    expect(ev("Kc Kd", "Ks 8h 8c 2d 5s").category).toBe(H.FullHouse);
  });
  it("four of a kind", () => {
    expect(ev("9c 9d", "9s 9h Kc 2d 5s").category).toBe(H.FourOfAKind);
  });
  it("straight flush", () => {
    expect(ev("9h 8h", "7h 6h 5h 2d Ks").category).toBe(H.StraightFlush);
  });
});

describe("handEvaluator: §21 edge cases", () => {
  it("Wheel straight A-2-3-4-5 (ace plays low)", () => {
    const h = ev("Ac 2d", "3s 4h 5c Kd 9s");
    expect(h.category).toBe(H.Straight);
    expect(h.tiebreak).toEqual([5]);
    expect(bestFiveRanks(h)).toBe("5-4-3-2-A");
    expect(describeHand(h)).toContain("Wheel");
  });
  it("6-high straight beats the wheel when both present", () => {
    const h = ev("Ac 6d", "2s 3h 4c 5d Ks");
    expect(h.tiebreak).toEqual([6]);
  });
  it("no wrap-around straight (Q-K-A-2-3)", () => {
    expect(ev("Qc Kd", "As 2h 3c 8d 9s").category).toBe(H.HighCard);
  });
  it("Steel wheel (A-5 straight flush)", () => {
    const h = ev("Ah 2h", "3h 4h 5h Kd Ks");
    expect(h.category).toBe(H.StraightFlush);
    expect(h.tiebreak).toEqual([5]);
    expect(h.isRoyal).toBe(false);
  });
  it("Royal Flush", () => {
    const h = ev("Ah Kh", "Qh Jh Th 2d 3s");
    expect(h.category).toBe(H.StraightFlush);
    expect(h.isRoyal).toBe(true);
    expect(handName(h)).toBe("Royal Flush");
  });
  it("Board Straight: board plays", () => {
    const h = ev("2c 3d", "Ts Jh Qc Kd As");
    expect(h.category).toBe(H.Straight);
    expect(boardPlays(c("2c 3d"), h)).toBe(true);
  });
  it("Board Straight improved by a higher card", () => {
    const h = ev("Tc 2d", "5s 6h 7c 8d 9s");
    expect(h.tiebreak).toEqual([10]);
    expect(boardPlays(c("Tc 2d"), h)).toBe(false);
  });
  it("Board Flush: board plays unless hole card is higher of that suit", () => {
    const board = "2h 6h 9h Jh Kh";
    const low = ev("3h Ac", board);
    expect(low.category).toBe(H.Flush);
    expect(bestFiveRanks(low)).toBe("K-J-9-6-3");
    const none = ev("Ac Ad", board);
    expect(boardPlays(c("Ac Ad"), none)).toBe(true);
    const high = ev("Ah 2c", board);
    expect(bestFiveRanks(high)).toBe("A-K-J-9-6");
  });
  it("Four Flush Board: one suited hole card makes a flush, none does not", () => {
    const board = "2h 6h 9h Jh Kc";
    expect(ev("3h 3c", board).category).toBe(H.Flush);
    expect(ev("As Ad", board).category).toBe(H.OnePair);
  });
  it("Double Paired Board: pocket pair lower than board pairs still two pair", () => {
    const h = ev("3c 3d", "Ks Kh 8c 8d As");
    expect(h.category).toBe(H.TwoPair);
    expect(bestFiveRanks(h)).toBe("K-K-8-8-A");
  });
  it("Three pairs: best two pairs with best kicker", () => {
    const h = ev("Qc 2d", "Qs 9h 9c 2s 7d");
    expect(h.category).toBe(H.TwoPair);
    expect(bestFiveRanks(h)).toBe("Q-Q-9-9-7");
  });
  it("Two trips make the best full house", () => {
    const h = ev("8c 8d", "8s Kh Kc Kd 2s");
    expect(h.category).toBe(H.FullHouse);
    expect(h.tiebreak).toEqual([13, 8]);
  });
  it("Trips plus two pairs: uses highest pair", () => {
    const h = ev("Qc Qd", "5s 5h 5c 9d 9s");
    expect(h.tiebreak).toEqual([5, 12]);
  });
  it("Quads with best kicker from 3 remaining", () => {
    const h = ev("Ac 2d", "7s 7h 7c 7d Ks");
    expect(h.category).toBe(H.FourOfAKind);
    expect(h.tiebreak).toEqual([7, 14]);
    expect(bestFiveRanks(h)).toBe("7-7-7-7-A");
  });
  it("Six suited cards: flush uses top five", () => {
    const h = ev("Ah 3h", "2h 9h Jh 5h Kc");
    expect(bestFiveRanks(h)).toBe("A-J-9-5-3");
  });
  it("Six-card straight uses the highest five", () => {
    const h = ev("8c 9d", "4s 5h 6c 7d 2s");
    expect(h.tiebreak).toEqual([9]);
  });
  it("Straight flush beats a higher plain flush in the same hand", () => {
    const h = ev("Ah 8h", "7h 6h 5h 4h Kc");
    expect(h.category).toBe(H.StraightFlush);
    expect(h.tiebreak).toEqual([8]);
  });
  it("Flush beats straight when both available", () => {
    expect(ev("Th 2h", "9h 8c 7h 6h Js").category).toBe(H.Flush);
  });
  it("Full house beats flush when both available", () => {
    expect(ev("9h 9c", "9d 2h 2c 5h Kh").category).toBe(H.FullHouse);
  });
  it("Spec §5 example: A K Q J 4 board + T 8 = Straight A-K-Q-J-T", () => {
    const h = ev("Tc 8d", "As Kd Qc Jh 4s");
    expect(handName(h)).toBe("Straight");
    expect(bestFiveRanks(h)).toBe("A-K-Q-J-T");
  });
  it("rejects duplicate cards and invalid counts", () => {
    expect(() => evaluateHand(c("As As Kd Qc Jh"))).toThrow();
    expect(() => evaluateHand(c("As Kd Qc Jh"))).toThrow();
  });
  it("describes hands", () => {
    expect(describeHand(ev("Ac 8d", "Ks Kd 8c 5h 2s"))).toBe("Kings & Eights, Ace Kicker");
    expect(describeHand(ev("Kc Kh", "Ks 8h 8c 2d 5s"))).toBe("Kings Full of Eights");
  });
});

/* Independent reference: category from raw 7-card counting (no 5-card combos). */
function referenceCategory(cards: Card[]): H {
  const bySuit = new Map<string, number[]>();
  for (const x of cards) bySuit.set(suitOf(x), [...(bySuit.get(suitOf(x)) ?? []), rankValue(x)]);
  const hasStraight = (ranks: number[]) => {
    const s = new Set(ranks);
    if (s.has(14)) s.add(1);
    for (let hi = 14; hi >= 5; hi--) if ([0, 1, 2, 3, 4].every((k) => s.has(hi - k))) return true;
    return false;
  };
  for (const rs of bySuit.values()) if (rs.length >= 5 && hasStraight(rs)) return H.StraightFlush;
  const counts = new Map<number, number>();
  for (const x of cards) counts.set(rankValue(x), (counts.get(rankValue(x)) ?? 0) + 1);
  const cs = [...counts.values()].sort((a, b) => b - a);
  if (cs[0] === 4) return H.FourOfAKind;
  if (cs[0] === 3 && cs[1] >= 2) return H.FullHouse;
  if ([...bySuit.values()].some((rs) => rs.length >= 5)) return H.Flush;
  if (hasStraight(cards.map(rankValue))) return H.Straight;
  if (cs[0] === 3) return H.ThreeOfAKind;
  if (cs[0] === 2 && cs[1] === 2) return H.TwoPair;
  if (cs[0] === 2) return H.OnePair;
  return H.HighCard;
}

describe("handEvaluator: randomized cross-check", () => {
  it("matches the reference category on 20,000 random 7-card hands", () => {
    const rng = seededRng(2024);
    for (let i = 0; i < 20000; i++) {
      const cards = shuffle(createDeck(), rng).slice(0, 7);
      const h = evaluateHand(cards);
      expect(h.category).toBe(referenceCategory(cards));
      expect(h.bestFive).toHaveLength(5);
      expect(h.bestFive.every((x) => cards.includes(x))).toBe(true);
      expect(evaluateHand(h.bestFive).value).toBe(h.value);
    }
  });
});
