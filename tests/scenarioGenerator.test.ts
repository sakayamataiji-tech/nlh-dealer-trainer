import { describe, expect, it } from "vitest";
import {
  generateHandScenario,
  generatePotScenario,
  generateScenario,
  generateSidePotScenario,
  generateWinnerScenario,
  WINNER_PLAYERS,
  WINNER_SHOWDOWN,
} from "@/engine/scenarioGenerator";
import { HandState } from "@/engine/bettingEngine";
import { buildPlaybackFrames } from "@/engine/playback";
import { boardCardsInBestFive, isValidBoardSelection } from "@/engine/boardSelection";
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
  it.each(LEVELS)("level %i: table/showdown sizes, legal hand to showdown, no dup cards, correct key, no partial split", (level) => {
    const rng = seededRng(100 + level);
    for (let i = 0; i < N; i++) {
      const s = generateWinnerScenario(level, { rng });
      const [min, max] = WINNER_PLAYERS[level];
      expect(s.table.length).toBeGreaterThanOrEqual(min);
      expect(s.table.length).toBeLessThanOrEqual(max);
      const [smin, smax] = WINNER_SHOWDOWN[level];
      expect(s.players.length).toBeGreaterThanOrEqual(Math.min(smin, s.table.length));
      expect(s.players.length).toBeLessThanOrEqual(smax);
      assertNoDuplicates([...s.board, ...s.table.flatMap((p) => p.hole)]);
      // Showdown players are table seats with the same cards, named by position.
      for (const p of s.players) {
        const seat = s.table.find((t) => t.id === p.id)!;
        expect(seat.hole).toEqual(p.hole);
        expect(p.name).toBe(seat.position);
      }
      // The action is legal (strict replay through the betting engine) and only the showdown players remain.
      const st = new HandState(s.table, s.blinds);
      for (const a of s.actions.filter((x) => !["post_sb", "post_bb", "ante"].includes(x.type))) {
        while (st.nextToAct() === -1) expect(st.advanceStreet()).toBe(true);
        const idx = st.nextToAct();
        expect(st.players[idx].id).toBe(a.playerId);
        st.apply(idx, { type: a.type as "fold", to: a.amount });
      }
      expect(st.street).toBe("river");
      expect(st.nextToAct()).toBe(-1);
      expect(st.activePlayers.map((p) => p.id).sort()).toEqual(s.players.map((p) => p.id).sort());
      const frames = buildPlaybackFrames(s.table, s.blinds, s.actions);
      expect(frames[frames.length - 1].boardCount).toBe(5);
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
      expect(s.result.winners).toHaveLength(s.players.length);
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

describe("scenarioGenerator: player count, ante and board-card selection", () => {
  it("fixed player counts are honoured (WINNER 2-9, POT 2-9, SIDE POT 3-9)", () => {
    const rng = seededRng(900);
    for (let n = 2; n <= 9; n++) {
      expect(generateWinnerScenario(3, { rng, players: n }).table).toHaveLength(n);
      expect(generatePotScenario(3, { rng, players: n }).players).toHaveLength(n);
      if (n >= 3) expect(generateSidePotScenario(3, { rng, players: n }).players).toHaveLength(n);
    }
  });
  it("9-handed WINNER splits are complete splits among the showdown players", () => {
    const rng = seededRng(901);
    for (let i = 0; i < 20; i++) {
      const s = generateWinnerScenario(5, { rng, players: 9, focus: "split-pot" });
      expect(s.table).toHaveLength(9);
      expect(s.result.winners).toHaveLength(s.players.length);
      assertNoDuplicates([...s.board, ...s.table.flatMap((p) => p.hole)]);
    }
  });
  it("the engine's own board cards are always a valid selection for every winner", () => {
    const rng = seededRng(902);
    for (let i = 0; i < 300; i++) {
      const s = generateWinnerScenario(((i % 5) + 1) as Level, { rng });
      expect(s.requireBoardCards).toBe(true);
      for (const id of s.result.winners) {
        const p = s.players.find((x) => x.id === id)!;
        const hand = s.result.entries.find((e) => e.id === id)!.hand;
        const used = boardCardsInBestFive(s.board, hand);
        expect(used.length).toBeGreaterThanOrEqual(3);
        expect(isValidBoardSelection(s.board, p.hole, hand, used)).toBe(true);
      }
    }
  });
  it("HAND READING: the engine's board cards are always a valid selection", () => {
    const rng = seededRng(903);
    for (let i = 0; i < 300; i++) {
      const s = generateHandScenario(((i % 5) + 1) as Level, { rng });
      expect(s.requireBoardCards).toBe(true);
      const used = boardCardsInBestFive(s.board, s.hand);
      expect(used.length).toBeGreaterThanOrEqual(3);
      expect(isValidBoardSelection(s.board, s.hole, s.hand, used)).toBe(true);
    }
  });
  it("board-card step can be switched off", () => {
    expect(generateWinnerScenario(2, { rng: seededRng(3), selectBoardCards: false }).requireBoardCards).toBe(false);
  });
  it.each(["all", "bb"] as const)("ante %s: POT answer equals replay; antes are dead money in the main pot", (ante) => {
    const rng = seededRng(ante === "all" ? 950 : 951);
    for (let i = 0; i < 80; i++) {
      const level = ((i % 5) + 1) as Level;
      const p = generatePotScenario(level, { rng, ante });
      const r = calculatePot(p.players, p.blinds, p.actions);
      expect(p.answer).toBe(r.total);
      expect(r.anteTotal).toBe(ante === "bb" ? p.blinds.bb : (p.blinds.bb / 8) * p.players.length);
      expect(p.skills).toContain("ante");
      const sp = generateSidePotScenario(level, { rng, ante });
      expect(sp.pots.deadMoney).toBe(sp.potResult.anteTotal);
      expect(sp.pots.pots[0].deadMoney).toBe(sp.potResult.anteTotal);
      const returned = sp.pots.returned.reduce((a, b) => a + b.amount, 0);
      expect(sp.pots.total + returned).toBe(sp.potResult.grossTotal);
    }
  });
});
