import { describe, expect, it } from "vitest";
import { HandState } from "@/engine/bettingEngine";
import { calculatePot } from "@/engine/potCalculator";
import { positionNames } from "@/engine/positions";
import type { TablePlayer } from "@/engine/actions";
import { generatePotScenario, generateSidePotScenario } from "@/engine/scenarioGenerator";
import { seededRng } from "@/engine/shuffle";

const blinds = { sb: 100, bb: 200, ante: 0 };
const table = (stacks: number[]): TablePlayer[] => {
  const pos = positionNames(stacks.length);
  return stacks.map((s, i) => ({ id: pos[i], name: pos[i], stack: s }));
};
const idx = (st: HandState, id: string) => st.players.findIndex((p) => p.id === id);

describe("positions", () => {
  it("names seats for 2-9 players", () => {
    expect(positionNames(2)).toEqual(["BTN/SB", "BB"]);
    expect(positionNames(3)).toEqual(["SB", "BB", "BTN"]);
    expect(positionNames(6)).toEqual(["SB", "BB", "UTG", "HJ", "CO", "BTN"]);
    expect(positionNames(9)).toEqual(["SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN"]);
  });
});

describe("bettingEngine: action order", () => {
  it("preflop starts left of BB, postflop starts with SB", () => {
    const st = new HandState(table([10000, 10000, 10000, 10000]), blinds);
    expect(st.players[st.nextToAct()].id).toBe("UTG");
    st.apply(idx(st, "UTG"), { type: "call" });
    st.apply(idx(st, "BTN"), { type: "call" });
    st.apply(idx(st, "SB"), { type: "call" });
    expect(st.players[st.nextToAct()].id).toBe("BB"); // BB option
    st.apply(idx(st, "BB"), { type: "check" });
    expect(st.roundComplete).toBe(true);
    st.advanceStreet();
    expect(st.players[st.nextToAct()].id).toBe("SB");
  });
  it("heads-up: BTN/SB acts first preflop, BB first postflop", () => {
    const st = new HandState(table([10000, 10000]), blinds);
    expect(st.players[st.nextToAct()].id).toBe("BTN/SB");
    st.apply(0, { type: "call" });
    st.apply(1, { type: "check" });
    st.advanceStreet();
    expect(st.players[st.nextToAct()].id).toBe("BB");
  });
});

describe("bettingEngine: raise rules", () => {
  it("min raise = current bet + last raise size", () => {
    const st = new HandState(table([10000, 10000, 10000]), blinds);
    const btn = idx(st, "BTN");
    expect(st.legalActions(btn).find((a) => a.type === "raise")!.minTo).toBe(400);
    st.apply(btn, { type: "raise", to: 700 });
    const sb = idx(st, "SB");
    expect(st.legalActions(sb).find((a) => a.type === "raise")!.minTo).toBe(1200);
    expect(() => st.apply(sb, { type: "raise", to: 1100 })).toThrow();
  });
  it("incomplete all-in raise does not reopen betting for a player who already acted", () => {
    // BTN raises to 1000 (raise size 800). SB shoves 1300 total (raise of 300 < 800).
    const st = new HandState(table([1300, 10000, 10000]), blinds);
    st.apply(idx(st, "BTN"), { type: "raise", to: 1000 });
    st.apply(idx(st, "SB"), { type: "allin" });
    // BB has not acted yet → full options.
    const bb = idx(st, "BB");
    expect(st.legalActions(bb).some((a) => a.type === "raise")).toBe(true);
    st.apply(bb, { type: "call" });
    // BTN already acted and faces only an incomplete raise → call or fold only.
    const btn = idx(st, "BTN");
    const types = st.legalActions(btn).map((a) => a.type);
    expect(types).toContain("call");
    expect(types).not.toContain("raise");
    expect(types).not.toContain("allin");
  });
  it("short BB all-in: others still must call the full big blind", () => {
    const st = new HandState(table([10000, 150, 10000]), blinds);
    expect(st.currentBet).toBe(200);
    const btn = idx(st, "BTN");
    expect(st.legalActions(btn).find((a) => a.type === "call")!.callAmount).toBe(200);
  });
  it("round ends when only one player with chips remains and has matched", () => {
    const st = new HandState(table([10000, 3000, 10000]), blinds);
    st.apply(idx(st, "BTN"), { type: "fold" });
    st.apply(idx(st, "SB"), { type: "raise", to: 600 });
    st.apply(idx(st, "BB"), { type: "allin" });
    st.apply(idx(st, "SB"), { type: "call" });
    expect(st.roundComplete).toBe(true);
    st.advanceStreet();
    expect(st.nextToAct()).toBe(-1); // no betting possible on flop
  });
});

describe("bettingEngine ↔ potCalculator cross-check", () => {
  it("random legal hands: engine totals equal independent replay", () => {
    const rng = seededRng(77);
    for (let i = 0; i < 300; i++) {
      const level = ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5;
      const s = generatePotScenario(level, { rng });
      const replay = calculatePot(s.players, s.blinds, s.actions, { settle: false });
      const stacks = s.players.map((p) => p.stack);
      for (const p of s.players) expect(replay.contributions[p.id]).toBeLessThanOrEqual(p.stack);
      expect(replay.grossTotal).toBeGreaterThan(0);
      expect(s.answer).toBe(replay.grossTotal - (s.result.uncalled?.amount ?? 0));
      expect(stacks.every((x) => x > 0)).toBe(true);
    }
  });
  it("replaying generated side-pot hands through a fresh HandState reproduces the log", () => {
    const rng = seededRng(99);
    for (let i = 0; i < 100; i++) {
      const s = generateSidePotScenario((((i % 5) + 1) as 1 | 2 | 3 | 4 | 5), { rng });
      const st = new HandState(s.players, s.blinds);
      const voluntary = s.actions.filter((a) => !["post_sb", "post_bb", "ante"].includes(a.type));
      for (const a of voluntary) {
        while (st.nextToAct() === -1 && !st.finished) st.advanceStreet();
        const i2 = st.nextToAct();
        expect(st.players[i2].id).toBe(a.playerId);
        expect(st.street).toBe(a.street);
        st.apply(i2, { type: a.type as "fold", to: a.amount });
      }
      expect(st.contributions()).toEqual(s.potResult.contributions);
    }
  });
});
