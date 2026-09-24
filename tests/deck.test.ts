import { describe, expect, it } from "vitest";
import { createDeck, Dealer, remainingDeck, assertNoDuplicates } from "@/engine/deck";
import { seededRng, shuffle } from "@/engine/shuffle";
import { c } from "./helpers";

describe("deck", () => {
  it("creates 52 unique cards", () => {
    const d = createDeck();
    expect(d).toHaveLength(52);
    expect(new Set(d).size).toBe(52);
  });
  it("shuffle is a permutation and deterministic with a seed", () => {
    const a = shuffle(createDeck(), seededRng(42));
    const b = shuffle(createDeck(), seededRng(42));
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([...createDeck()].sort());
    expect(a).not.toEqual(createDeck());
  });
  it("shuffle is roughly uniform for first position", () => {
    const rng = seededRng(1);
    const counts = new Map<string, number>();
    for (let i = 0; i < 52000; i++) {
      const top = shuffle(createDeck(), rng)[0];
      counts.set(top, (counts.get(top) ?? 0) + 1);
    }
    for (const v of counts.values()) expect(v).toBeGreaterThan(800), expect(v).toBeLessThan(1200);
  });
  it("dealer never deals duplicates and exhausts correctly", () => {
    const dealer = new Dealer(shuffle(createDeck(), seededRng(3)));
    const all = dealer.deal(52);
    expect(new Set(all).size).toBe(52);
    expect(() => dealer.deal(1)).toThrow();
  });
  it("take removes specific cards", () => {
    const dealer = new Dealer(createDeck());
    dealer.take("As");
    expect(dealer.has("As")).toBe(false);
    expect(() => dealer.take("As")).toThrow();
  });
  it("remainingDeck and duplicate detection", () => {
    expect(remainingDeck(c("As Kd"))).toHaveLength(50);
    expect(() => assertNoDuplicates(c("As As"))).toThrow();
  });
});
