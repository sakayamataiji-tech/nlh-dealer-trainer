import { describe, expect, it } from "vitest";
import { chipUnit, computeRake, normalizeRakeRule, roundToStep, type RakeRule } from "@/engine/rake";

const rule = (p: Partial<RakeRule> = {}): RakeRule => ({ percent: 5, cap: 1000, noFlopNoDrop: true, jackpot: { enabled: false, amount: 0 }, rounding: "down", ...p });

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
    expect(computeRake(5000, false, rule({ jackpot: { enabled: true, amount: 200 } }))).toEqual({ rake: 0, jackpot: 0, payout: 5000, reason: "no-flop", uncapped: 0, unit: 25 });
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
    expect(normalizeRakeRule(rule({ percent: 5.3, cap: 1010, jackpot: { enabled: true, amount: 260 } }))).toEqual({
      percent: 5.5,
      cap: 1000,
      noFlopNoDrop: true,
      jackpot: { enabled: true, amount: 250 },
      rounding: "down",
    });
    expect(normalizeRakeRule(rule({ percent: 99, cap: -5, noFlopNoDrop: false, jackpot: { enabled: false, amount: NaN } }))).toMatchObject({ percent: 20, cap: 0 });
    // 1-chip games keep single chips.
    expect(normalizeRakeRule(rule({ cap: 6, jackpot: { enabled: true, amount: 1 } }), 1)).toMatchObject({ cap: 6, jackpot: { amount: 1 } });
  });
  it("rounds down, up or to nearest (halves up)", () => {
    expect([roundToStep(4.35, 1, "down"), roundToStep(4.35, 1, "up"), roundToStep(4.35, 1, "nearest")]).toEqual([4, 5, 4]);
    expect([roundToStep(4.5, 1, "down"), roundToStep(4.5, 1, "up"), roundToStep(4.5, 1, "nearest")]).toEqual([4, 5, 5]);
    expect(roundToStep(4, 1, "up")).toBe(4);
    expect(roundToStep(166.25, 25, "nearest")).toBe(175);
    expect(roundToStep(162.5, 25, "nearest")).toBe(175);
    expect(roundToStep(160, 25, "nearest")).toBe(150);
  });
  it("1/3 game: 1-chip rake with each rounding", () => {
    expect(chipUnit(3)).toBe(1);
    expect(chipUnit(200)).toBe(25);
    const small = (rounding: RakeRule["rounding"]) => rule({ percent: 10, cap: 5, rounding, jackpot: { enabled: true, amount: 1 } });
    expect(computeRake(37, true, small("down"), 1)).toMatchObject({ rake: 3, jackpot: 1, payout: 33 });
    expect(computeRake(37, true, small("up"), 1)).toMatchObject({ rake: 4, jackpot: 1, payout: 32 });
    expect(computeRake(35, true, small("nearest"), 1)).toMatchObject({ rake: 4, payout: 30 });
    expect(computeRake(34, true, small("nearest"), 1)).toMatchObject({ rake: 3, payout: 30 });
    expect(computeRake(87, true, small("up"), 1)).toMatchObject({ rake: 5, uncapped: 9, payout: 81 });
  });
});

import { generatePotScenario, generateRakeScenario } from "@/engine/scenarioGenerator";
import { gradeAnswer } from "@/engine/grading";
import { seededRng } from "@/engine/shuffle";
import { LEVELS, type Level } from "@/engine/scenarioTypes";

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

describe("RAKE mode", () => {
  const cash = (r: Partial<RakeRule> = {}) => ({ sb: 100, bb: 200, rake: rule(r) });

  it("answers always come from computeRake with the house rule", () => {
    const rng = seededRng(31);
    const jp = cash({ percent: 10, cap: 4000, jackpot: { enabled: true, amount: 1000 }, rounding: "nearest" });
    for (const level of LEVELS)
      for (let i = 0; i < 60; i++) {
        const s = generateRakeScenario(level, { rng, cash: jp });
        expect(s.pot % 25).toBe(0);
        expect(s.pot).toBeGreaterThan(0);
        const expected = computeRake(s.pot, s.ending !== "preflop-fold", jp.rake, 25);
        expect(s.result).toEqual(expected);
        expect(s.questions.map((q) => q.key)).toEqual(["rake", "jackpot", "payout"]);
        expect(s.questions.map((q) => q.answer)).toEqual([expected.rake, expected.jackpot, expected.payout]);
        expect(s.result.rake + s.result.jackpot + s.result.payout).toBe(s.pot);
      }
  });

  it("asks no jackpot when it is off, and LV1-2 pots are round (100s)", () => {
    const rng = seededRng(32);
    for (let i = 0; i < 50; i++) {
      const s = generateRakeScenario(((i % 2) + 1) as Level, { rng, cash: cash() });
      expect(s.questions.map((q) => q.key)).toEqual(["rake", "payout"]);
      expect(s.pot % 100).toBe(0);
    }
  });

  it("covers no flop no drop, all-in run-outs and the MAX edge", () => {
    const rng = seededRng(33);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const s = generateRakeScenario(4, { rng, cash: cash() });
      seen.add(s.ending);
      s.skills.forEach((k) => seen.add(k));
    }
    for (const k of ["preflop-fold", "allin-runout", "no-flop-no-drop", "rake-cap"]) expect(seen).toContain(k);
  });

  it("1/3 game: pots and rake in single chips", () => {
    const rng = seededRng(36);
    const small = { sb: 1, bb: 3, rake: rule({ percent: 10, cap: 5, rounding: "up", jackpot: { enabled: true, amount: 1 } }) };
    let odd = 0;
    for (const level of LEVELS)
      for (let i = 0; i < 40; i++) {
        const s = generateRakeScenario(level, { rng, cash: small });
        if (level <= 2) expect(s.pot % 5).toBe(0);
        if (s.pot % 5) odd++;
        expect(s.pot).toBeGreaterThanOrEqual(3);
        expect(s.pot).toBeLessThanOrEqual(3 * 400);
        expect(s.result).toEqual(computeRake(s.pot, s.ending !== "preflop-fold", small.rake, 1));
      }
    expect(odd).toBeGreaterThan(20);
  });

  it("weakness focus is honoured", () => {
    const rng = seededRng(34);
    for (let i = 0; i < 20; i++) expect(generateRakeScenario(3, { rng, cash: cash(), focus: "rake-cap" }).skills).toContain("rake-cap");
  });

  it("grades each number as a part", () => {
    const s = generateRakeScenario(3, { rng: seededRng(35), cash: cash({ jackpot: { enabled: true, amount: 200 } }) });
    const right = Object.fromEntries(s.questions.map((q) => [q.key, q.answer]));
    expect(gradeAnswer(s, { mode: "rake", amounts: right })).toEqual({ correct: true, parts: { rake: true, jackpot: true, payout: true } });
    const g = gradeAnswer(s, { mode: "rake", amounts: { ...right, payout: right.payout + 25 } });
    expect(g.correct).toBe(false);
    expect(g.parts).toEqual({ rake: true, jackpot: true, payout: false });
  });
});
