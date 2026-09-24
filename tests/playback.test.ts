import { describe, expect, it } from "vitest";
import { addCounts, breakdown, countsValue } from "@/engine/chips";
import { buildPlaybackFrames, frameTotal } from "@/engine/playback";
import { calculatePot } from "@/engine/potCalculator";
import { generatePotScenario } from "@/engine/scenarioGenerator";
import { seededRng } from "@/engine/shuffle";
import type { Level } from "@/engine/scenarioTypes";
import type { TableAction } from "@/engine/actions";

describe("chips", () => {
  it("breaks amounts into the fewest chips and back", () => {
    expect(breakdown(13500)).toEqual({ 5000: 2, 1000: 3, 500: 1 });
    expect(breakdown(125)).toEqual({ 100: 1, 25: 1 });
    expect(countsValue(addCounts(breakdown(4000), breakdown(9500)))).toBe(13500);
    expect(() => breakdown(30)).toThrow();
  });
});

describe("playback frames", () => {
  it("spec §10 example: chips in front total 13,500", () => {
    const players = ["SB", "BB", "UTG", "HJ", "BTN"].map((id) => ({ id, name: id, stack: 100000 }));
    const A = (playerId: string, type: TableAction["type"], amount?: number): TableAction => ({ playerId, street: "preflop", type, amount });
    const actions = [A("SB", "post_sb", 500), A("BB", "post_bb", 1000), A("UTG", "call", 1000), A("HJ", "call", 1000), A("BTN", "raise", 4000), A("SB", "fold"), A("BB", "call", 4000), A("UTG", "call", 4000), A("HJ", "fold")];
    const frames = buildPlaybackFrames(players, { sb: 500, bb: 1000, ante: 0 }, actions);
    const last = frames[frames.length - 1];
    expect(last.fronts).toEqual({ SB: 500, BB: 4000, UTG: 4000, HJ: 1000, BTN: 4000 });
    expect(frameTotal(last)).toBe(13500);
    expect(last.folded.sort()).toEqual(["HJ", "SB"]);
  });
  it("final frame equals the pot calculator on random hands (all levels, all ante types)", () => {
    const rng = seededRng(4242);
    for (let i = 0; i < 400; i++) {
      const level = ((i % 5) + 1) as Level;
      const ante = (["none", "all", "bb"] as const)[i % 3];
      const s = generatePotScenario(level, { rng, ante });
      const frames = buildPlaybackFrames(s.players, s.blinds, s.actions);
      const last = frames[frames.length - 1];
      expect(frameTotal(last)).toBe(calculatePot(s.players, s.blinds, s.actions).total);
      expect(countsValue(last.potChips)).toBe(last.pot);
      for (const [id, amt] of Object.entries(last.fronts)) expect(countsValue(last.frontChips[id] ?? {})).toBe(amt);
      // Street order is respected and ends on the asked street.
      expect(last.street).toBe(s.askStreet);
    }
  });
});
