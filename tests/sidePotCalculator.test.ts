import { describe, expect, it } from "vitest";
import { awardPots, buildPots, splitPot } from "@/engine/sidePotCalculator";

const C = (playerId: string, amount: number, folded = false) => ({ playerId, amount, folded });

describe("sidePotCalculator", () => {
  it("Spec §12 example: 3,000 / 8,000 / 15,000 / 15,000", () => {
    const r = buildPots([C("A", 3000), C("B", 8000), C("C", 15000), C("D", 15000)]);
    expect(r.pots.map((p) => p.amount)).toEqual([12000, 15000, 14000]);
    expect(r.pots.map((p) => p.eligible)).toEqual([["A", "B", "C", "D"], ["B", "C", "D"], ["C", "D"]]);
    expect(r.pots.map((p) => p.name)).toEqual(["MAIN POT", "SIDE POT 1", "SIDE POT 2"]);
    expect(r.returned).toEqual([]);
  });
  it("Multiple Side Pots: four distinct all-ins", () => {
    const r = buildPots([C("A", 1000), C("B", 2500), C("C", 4000), C("D", 7000), C("E", 7000)]);
    expect(r.pots.map((p) => p.amount)).toEqual([5000, 6000, 4500, 6000]);
    expect(r.total).toBe(21500);
  });
  it("Folded Player Contribution stays in the pot but is not eligible", () => {
    const r = buildPots([C("A", 3000), C("B", 8000), C("C", 8000), C("F", 1000, true)]);
    expect(r.pots).toHaveLength(2);
    expect(r.pots[0].amount).toBe(3000 * 3 + 1000);
    expect(r.pots[0].eligible).toEqual(["A", "B", "C"]);
    expect(r.pots[1].amount).toBe(10000);
    expect(r.pots[1].eligible).toEqual(["B", "C"]);
  });
  it("Folded contribution above an all-in level goes to the side pot", () => {
    const r = buildPots([C("A", 2000), C("F", 5000, true), C("B", 9000), C("C", 9000)]);
    expect(r.pots.map((p) => p.amount)).toEqual([8000, 3000 + 7000 * 2]);
    expect(r.pots[1].eligible).toEqual(["B", "C"]);
    expect(r.total).toBe(25000);
  });
  it("uncalled excess is returned, not a pot", () => {
    const r = buildPots([C("A", 3000), C("B", 10000)]);
    expect(r.pots).toHaveLength(1);
    expect(r.pots[0].amount).toBe(6000);
    expect(r.returned).toEqual([{ playerId: "B", amount: 7000 }]);
  });
  it("equal all-ins create no extra pot", () => {
    const r = buildPots([C("A", 5000), C("B", 5000), C("C", 5000)]);
    expect(r.pots).toHaveLength(1);
    expect(r.pots[0].amount).toBe(15000);
  });
  it("side pot with a single eligible player (others folded) is still a pot", () => {
    const r = buildPots([C("A", 1000), C("B", 6000), C("C", 4000, true)]);
    expect(r.pots.map((p) => [p.amount, p.eligible])).toEqual([[3000, ["A", "B", "C"].filter((x) => x !== "C")], [6000, ["B"]]]);
    expect(r.returned).toEqual([{ playerId: "B", amount: 2000 }]);
  });
  it("chip conservation on random inputs", () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) {
      const n = 2 + Math.floor(rnd() * 7);
      const cs = Array.from({ length: n }, (_, k) => C(`P${k}`, Math.floor(rnd() * 20) * 100, rnd() < 0.3));
      if (cs.every((x) => x.folded)) cs[0].folded = false;
      const maxLive = Math.max(...cs.filter((x) => !x.folded).map((x) => x.amount));
      if (cs.some((x) => x.folded && x.amount > maxLive)) continue; // not reachable in legal play
      const r = buildPots(cs);
      const returned = r.returned.reduce((s, x) => s + x.amount, 0);
      expect(r.total + returned).toBe(cs.reduce((s, x) => s + x.amount, 0));
      for (const p of r.pots) expect(p.eligible.length).toBeGreaterThan(0);
    }
  });
  it("splitPot: odd chip goes to first winner left of the button", () => {
    expect(splitPot(1000, ["A", "B"], ["A", "B"], 1)).toEqual({ A: 500, B: 500 });
    expect(splitPot(1001, ["A", "B"], ["B", "A"], 1)).toEqual({ A: 500, B: 501 });
    expect(splitPot(1000, ["A", "B", "C"], ["C", "A", "B"], 100)).toEqual({ A: 300, B: 300, C: 400 });
    expect(() => splitPot(1050, ["A"], ["A"], 100)).toThrow();
  });
  it("awardPots: short stack wins main, side pot to next best", () => {
    const pots = buildPots([C("A", 3000), C("B", 8000), C("C", 15000), C("D", 15000)]);
    const { potWinners, payouts } = awardPots(pots, { A: 90, B: 50, C: 70, D: 70 }, ["A", "B", "C", "D"]);
    expect(potWinners).toEqual([["A"], ["C", "D"], ["C", "D"]]);
    expect(payouts).toEqual({ A: 12000, C: 14500, D: 14500 });
  });
});
