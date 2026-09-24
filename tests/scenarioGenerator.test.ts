import { describe, expect, it } from "vitest";
import {
  generateHandScenario,
  generatePotScenario,
  generateScenario,
  generateSidePotScenario,
  generateWinnerScenario,
} from "@/engine/scenarioGenerator";
import { evaluatePlayer, HandCategory } from "@/engine/handEvaluator";
import { resolveShowdown } from "@/engine/handComparator";
import { calculatePot } from "@/engine/potCalculator";
import { buildPots } from "@/engine/sidePotCalculator";
import { assertNoDuplicates } from "@/engine/deck";
import { seededRng } from "@/engine/shuffle";
import { LEVELS, type Level } from "@/engine/scenarioTypes";

const N = 60;

describe("scenarioGenerator: HAND READING", () => {
  it.each(LEVELS)("level %i: 7 unique cards, answer derived from evaluator", (level) => {
    const rng = seededRng(level * 11);
    for (let i = 0; i < N; i++) {
      const s = generateHandScenario(level, { rng });
      expect(s.hole).toHaveLength(2);
      expect(s.board).toHaveLength(5);
      assertNoDuplicates([...s.hole, ...s.board]);
      expect(s.hand.value).toBe(evaluatePlayer(s.hole, s.board).value);
      expect(s.choices).toHaveLength(9);
    }
  });
  it("level 3 covers every category", () => {
    const rng = seededRng(5);
    const seen = new Set<HandCategory>();
    for (let i = 0; i < 400; i++) seen.add(generateHandScenario(3, { rng }).hand.category);
    expect(seen.size).toBe(9);
  });
  it("level 4 is mostly board-play", () => {
    const rng = seededRng(8);
    let bp = 0;
    for (let i = 0; i < 100; i++) if (generateHandScenario(4, { rng }).skills.includes("board-play")) bp++;
    expect(bp).toBeGreaterThan(40);
  });
  it("focus tag steers generation", () => {
    const rng = seededRng(9);
    for (let i = 0; i < 20; i++) expect(generateHandScenario(3, { rng, focus: "straight-detection" }).hand.category).toBe(HandCategory.Straight);
    for (let i = 0; i < 10; i++) expect(generateHandScenario(3, { rng, focus: "wheel" }).skills).toContain("wheel");
  });
});

describe("scenarioGenerator: WINNER", () => {
  it.each(LEVELS)("level %i: player count = level+1, no dup cards, correct key from comparator, no partial split", (level) => {
    const rng = seededRng(100 + level);
    for (let i = 0; i < N; i++) {
      const s = generateWinnerScenario(level, { rng });
      expect(s.players).toHaveLength(level + 1);
      assertNoDuplicates([...s.board, ...s.players.flatMap((p) => p.hole)]);
      const r = resolveShowdown(s.board, s.players);
      expect(r.winners.length === 1 || r.winners.length === s.players.length).toBe(true);
      expect(s.correctKey).toBe(r.isSplit ? "SPLIT" : r.winners[0]);
      expect(s.choices.map((c) => c.key)).toContain(s.correctKey);
    }
  });
  it("produces split pots at a meaningful rate", () => {
    const rng = seededRng(3);
    let splits = 0;
    for (let i = 0; i < 300; i++) if (generateWinnerScenario(((i % 5) + 1) as Level, { rng }).correctKey === "SPLIT") splits++;
    expect(splits).toBeGreaterThan(20);
    expect(splits).toBeLessThan(120);
  });
  it("focus split-pot always yields a complete split", () => {
    const rng = seededRng(4);
    for (let i = 0; i < 30; i++) {
      const s = generateWinnerScenario(5, { rng, focus: "split-pot" });
      expect(s.correctKey).toBe("SPLIT");
      expect(s.result.winners).toHaveLength(6);
    }
  });
});

describe("scenarioGenerator: POT", () => {
  it.each(LEVELS)("level %i: answer equals independent replay; at least 2 players remain", (level) => {
    const rng = seededRng(200 + level);
    for (let i = 0; i < N; i++) {
      const s = generatePotScenario(level, { rng });
      const r = calculatePot(s.players, s.blinds, s.actions);
      expect(s.answer).toBe(r.total);
      expect(s.players.length).toBeGreaterThanOrEqual(2);
      expect(s.players.length).toBeLessThanOrEqual(9);
      expect(s.players.length - r.folded.length).toBeGreaterThanOrEqual(2);
      expect(s.answer % (s.blinds.bb / 4)).toBe(0);
      if (level < 5) expect(r.allIn).toEqual([]);
      for (const a of s.actions) if (a.type === "raise" || a.type === "bet") expect(a.amount).toBeGreaterThan(0);
    }
  });
  it("later levels reach later streets", () => {
    const rng = seededRng(7);
    expect(generatePotScenario(1, { rng }).askStreet).toBe("preflop");
    const streets = new Set(Array.from({ length: 30 }, () => generatePotScenario(4, { rng }).askStreet));
    expect(streets.has("river")).toBe(true);
  });
});

describe("scenarioGenerator: SIDE POT", () => {
  it.each(LEVELS)("level %i: pots derived from contributions, conservation holds", (level) => {
    const rng = seededRng(300 + level);
    for (let i = 0; i < N; i++) {
      const s = generateSidePotScenario(level, { rng });
      const rebuilt = buildPots(s.players.map((p) => ({ playerId: p.id, amount: s.potResult.contributions[p.id], folded: s.potResult.folded.includes(p.id) })));
      expect(s.pots).toEqual(rebuilt);
      const gross = Object.values(s.potResult.contributions).reduce((a, b) => a + b, 0);
      const returned = s.pots.returned.reduce((a, b) => a + b.amount, 0);
      expect(s.pots.total + returned).toBe(gross);
      expect(s.pots.pots.length).toBeGreaterThanOrEqual(2);
      expect(s.questions.length).toBe(s.pots.pots.length + s.pots.returned.length);
      for (const p of s.pots.pots) for (const id of p.eligible) expect(s.potResult.folded).not.toContain(id);
    }
  });
  it("higher levels include folded contributions", () => {
    const rng = seededRng(12);
    let folded = 0;
    for (let i = 0; i < 40; i++) if (generateSidePotScenario(5, { rng }).skills.includes("folded-contribution")) folded++;
    expect(folded).toBeGreaterThan(10);
  });
});

describe("scenarioGenerator: performance", () => {
  it("generates 50 scenarios per mode quickly", () => {
    const rng = seededRng(1);
    const start = Date.now();
    for (const mode of ["hand", "winner", "pot", "sidepot"] as const) for (let i = 0; i < 50; i++) generateScenario(mode, (((i % 5) + 1) as Level), { rng });
    expect(Date.now() - start).toBeLessThan(10000);
  });
});
