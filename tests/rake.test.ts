import { describe, expect, it } from "vitest";
import { computeRake, normalizeRakeRule, type RakeRule } from "@/engine/rake";

const rule = (p: Partial<RakeRule> = {}): RakeRule => ({ percent: 5, cap: 1000, noFlopNoDrop: true, jackpot: { enabled: false, amount: 0 }, ...p });

describe("rake", () => {
  it("percent of the pot, rounded down to the smallest chip", () => {
    expect(computeRake(3325, true, rule())).toMatchObject({ rake: 150, jackpot: 0, payout: 3175 }); // 166.25 → 150
    expect(computeRake(4000, true, rule())).toMatchObject({ rake: 200, payout: 3800 });
  });
  it("is capped at MAX (0 = no cap)", () => {
    expect(computeRake(40000, true, rule())).toMatchObject({ rake: 1000, uncapped: 2000, payout: 39000 });
    expect(computeRake(40000, true, rule({ cap: 0 }))).toMatchObject({ rake: 2000 });
  });
  it("no flop, no drop", () => {
    expect(computeRake(5000, false, rule({ jackpot: { enabled: true, amount: 200 } }))).toEqual({ rake: 0, jackpot: 0, payout: 5000, reason: "no-flop", uncapped: 0 });
    expect(computeRake(5000, false, rule({ noFlopNoDrop: false }))).toMatchObject({ rake: 250 });
  });
  it("jackpot drop is a fixed amount on top of the rake", () => {
    expect(computeRake(10000, true, rule({ jackpot: { enabled: true, amount: 200 } }))).toMatchObject({ rake: 500, jackpot: 200, payout: 9300 });
    // Tiny pot: no rake → no jackpot either (the winner never ends up with nothing).
    expect(computeRake(200, true, rule({ jackpot: { enabled: true, amount: 200 } }))).toMatchObject({ rake: 0, jackpot: 0, payout: 200 });
  });
  it("rake + jackpot + payout always equals the pot", () => {
    for (let pot = 0; pot <= 60000; pot += 175)
      for (const r of [rule(), rule({ cap: 0, percent: 10 }), rule({ jackpot: { enabled: true, amount: 500 } })]) {
        const x = computeRake(pot, true, r);
        expect(x.rake + x.jackpot + x.payout).toBe(pot);
        expect(x.rake % 25).toBe(0);
      }
  });
  it("normalises settings input", () => {
    expect(normalizeRakeRule({ percent: 5.3, cap: 1010, noFlopNoDrop: true, jackpot: { enabled: true, amount: 260 } })).toEqual({
      percent: 5.5,
      cap: 1000,
      noFlopNoDrop: true,
      jackpot: { enabled: true, amount: 250 },
    });
    expect(normalizeRakeRule({ percent: 99, cap: -5, noFlopNoDrop: false, jackpot: { enabled: false, amount: NaN } })).toMatchObject({ percent: 20, cap: 0 });
  });
});

import { generatePotScenario } from "@/engine/scenarioGenerator";
import { gradeAnswer } from "@/engine/grading";
import { seededRng } from "@/engine/shuffle";
import type { Level } from "@/engine/scenarioTypes";

describe("POT questions with a cash-game rake", () => {
  const cash = { sb: 500, bb: 1000, rake: rule({ percent: 5, cap: 3000, jackpot: { enabled: true, amount: 1000 } }) };
  it("uses the house blinds and asks POT → RAKE → JACKPOT → PAYOUT, all derived from the engine", () => {
    const rng = seededRng(31);
    for (let i = 0; i < 100; i++) {
      const level = ((i % 5) + 1) as Level;
      const s = generatePotScenario(level, { rng, cash });
      expect(s.blinds).toMatchObject({ sb: 500, bb: 1000 });
      expect(s.questions.map((q) => q.key)).toEqual(["pot", "rake", "jackpot", "payout"]);
      const expected = computeRake(s.result.total, level !== 1, cash.rake);
      expect(s.questions.map((q) => q.answer)).toEqual([s.result.total, expected.rake, expected.jackpot, expected.payout]);
      if (level === 1) expect(s.rake!.reason).toBe("no-flop"); // preflop-only level: no flop, no drop
    }
  });
  it("grades every part", () => {
    const s = generatePotScenario(3, { rng: seededRng(5), cash });
    const right = Object.fromEntries(s.questions.map((q) => [q.key, q.answer]));
    expect(gradeAnswer(s, { mode: "pot", amounts: right }).correct).toBe(true);
    const g = gradeAnswer(s, { mode: "pot", amounts: { ...right, rake: right.rake + 25 } });
    expect(g.correct).toBe(false);
    expect(g.parts).toMatchObject({ pot: true, rake: false });
  });
  it("without the rake it is a single POT question (backwards compatible)", () => {
    const s = generatePotScenario(2, { rng: seededRng(6) });
    expect(s.questions).toHaveLength(1);
    expect(s.rake).toBeNull();
    expect(gradeAnswer(s, { mode: "pot", amount: s.answer }).correct).toBe(true);
  });
});
