import { describe, expect, it } from "vitest";
import { HandState } from "@/engine/bettingEngine";
import { calculatePot } from "@/engine/potCalculator";
import { buildPots } from "@/engine/sidePotCalculator";
import type { BlindStructure, TablePlayer } from "@/engine/actions";

const table = (stacks: number[], ids = ["SB", "BB", "BTN", "CO"]): TablePlayer[] => stacks.map((s, i) => ({ id: ids[i], name: ids[i], stack: s }));

describe("antes", () => {
  it("traditional ante: every player posts before the blinds; counted in the pot but not the street bet", () => {
    const b: BlindStructure = { sb: 100, bb: 200, ante: 25, anteType: "all" };
    const st = new HandState(table([10000, 10000, 10000]), b);
    expect(st.log.slice(0, 3).map((a) => a.type)).toEqual(["ante", "ante", "ante"]);
    expect(st.currentBet).toBe(200);
    const btn = 2;
    expect(st.legalActions(btn).find((a) => a.type === "call")!.callAmount).toBe(200);
    expect(st.potTotal()).toBe(75 + 300);
  });
  it("BB ante: BB posts blind first, then the ante (blind has priority when short)", () => {
    const b: BlindStructure = { sb: 500, bb: 1000, ante: 1000, anteType: "bb" };
    const full = new HandState(table([10000, 10000, 10000]), b);
    expect(full.log.map((a) => `${a.playerId}:${a.type}`)).toEqual(["SB:post_sb", "BB:post_bb", "BB:ante"]);
    expect(full.contributions().BB).toBe(2000);
    const short = new HandState(table([10000, 1500, 10000]), b);
    const r = calculatePot(table([10000, 1500, 10000]), b, short.log, { settle: false });
    expect(r.betContributions.BB).toBe(1000);
    expect(r.antes.BB).toBe(500);
  });
  it("antes are never returned as an uncalled bet", () => {
    const players = table([10000, 10000, 10000]);
    const b: BlindStructure = { sb: 500, bb: 1000, ante: 1000, anteType: "bb" };
    const st = new HandState(players, b);
    st.apply(2, { type: "fold" });
    st.apply(0, { type: "fold" });
    const r = calculatePot(players, b, st.log);
    // BB: 1000 blind (500 of it uncalled vs SB) + 1000 ante (dead)
    expect(r.uncalled).toEqual({ playerId: "BB", amount: 500 });
    expect(r.total).toBe(500 + 500 + 1000);
  });
  it("side pots: BB ante goes to the main pot as dead money, not matched by others", () => {
    // BB all-in 5,000 total = 1,000 ante + 4,000 bets; A calls 4,000.
    const res = buildPots(
      [
        { playerId: "BB", amount: 4000, folded: false },
        { playerId: "A", amount: 4000, folded: false },
      ],
      { deadMoney: 1000 },
    );
    expect(res.pots).toHaveLength(1);
    expect(res.pots[0].amount).toBe(9000);
    expect(res.pots[0].deadMoney).toBe(1000);
    expect(res.returned).toEqual([]);
  });
  it("side pots with traditional antes: all antes in the main pot", () => {
    const res = buildPots(
      [
        { playerId: "A", amount: 3000, folded: false },
        { playerId: "B", amount: 8000, folded: false },
        { playerId: "C", amount: 8000, folded: false },
        { playerId: "F", amount: 0, folded: true },
      ],
      { deadMoney: 4 * 100 },
    );
    expect(res.pots.map((p) => p.amount)).toEqual([9000 + 400, 10000]);
    expect(res.total).toBe(19400);
  });
});
