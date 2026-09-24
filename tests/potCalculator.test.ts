import { describe, expect, it } from "vitest";
import { calculatePot } from "@/engine/potCalculator";
import type { BlindStructure, TableAction, TablePlayer } from "@/engine/actions";

const blinds: BlindStructure = { sb: 500, bb: 1000, ante: 0 };
const deep = (ids: string[]): TablePlayer[] => ids.map((id) => ({ id, name: id, stack: 100000 }));
const A = (playerId: string, type: TableAction["type"], amount?: number, street: TableAction["street"] = "preflop"): TableAction => ({ playerId, street, type, amount });

describe("potCalculator", () => {
  it("Spec §10 example: pot is 13,500 (the spec's 14,500 contradicts its own breakdown)", () => {
    const players = deep(["SB", "BB", "UTG", "HJ", "BTN"]);
    const actions = [
      A("SB", "post_sb", 500),
      A("BB", "post_bb", 1000),
      A("UTG", "call", 1000),
      A("HJ", "call", 1000),
      A("BTN", "raise", 4000),
      A("SB", "fold"),
      A("BB", "call", 4000),
      A("UTG", "call", 4000),
      A("HJ", "fold"),
    ];
    const r = calculatePot(players, blinds, actions);
    expect(r.contributions).toEqual({ SB: 500, BB: 4000, UTG: 4000, HJ: 1000, BTN: 4000 });
    expect(r.total).toBe(13500);
    expect(r.uncalled).toBeNull();
  });

  it("raise is 'raise to': re-raise only adds the difference", () => {
    const players = deep(["SB", "BB", "BTN"]);
    const actions = [A("SB", "post_sb", 500), A("BB", "post_bb", 1000), A("BTN", "raise", 3000), A("SB", "fold"), A("BB", "raise", 9000), A("BTN", "call")];
    const r = calculatePot(players, blinds, actions);
    expect(r.contributions).toEqual({ SB: 500, BB: 9000, BTN: 9000 });
    expect(r.total).toBe(18500);
  });

  it("multi-street pot with per-street totals", () => {
    const players = deep(["SB", "BB", "BTN"]);
    const actions = [
      A("SB", "post_sb", 500), A("BB", "post_bb", 1000), A("BTN", "call"), A("SB", "call"), A("BB", "check"),
      A("SB", "check", undefined, "flop"), A("BB", "bet", 2000, "flop"), A("BTN", "raise", 6000, "flop"), A("SB", "fold", undefined, "flop"), A("BB", "call", undefined, "flop"),
      A("BB", "check", undefined, "turn"), A("BTN", "bet", 10000, "turn"), A("BB", "call", undefined, "turn"),
    ];
    const r = calculatePot(players, blinds, actions);
    expect(r.potByStreet.preflop).toBe(3000);
    expect(r.potByStreet.flop).toBe(15000);
    expect(r.potByStreet.turn).toBe(35000);
    expect(r.total).toBe(35000);
  });

  it("uncalled all-in excess is returned", () => {
    const players: TablePlayer[] = [
      { id: "SB", name: "SB", stack: 50000 },
      { id: "BB", name: "BB", stack: 8000 },
    ];
    const actions = [A("SB", "post_sb", 500), A("BB", "post_bb", 1000), A("SB", "allin"), A("BB", "allin")];
    const r = calculatePot(players, blinds, actions);
    expect(r.grossTotal).toBe(58000);
    expect(r.uncalled).toEqual({ playerId: "SB", amount: 42000 });
    expect(r.total).toBe(16000);
  });

  it("bet that everyone folds to is returned when settled", () => {
    const players = deep(["SB", "BB", "BTN"]);
    const actions = [A("SB", "post_sb", 500), A("BB", "post_bb", 1000), A("BTN", "raise", 2500), A("SB", "fold"), A("BB", "fold")];
    const r = calculatePot(players, blinds, actions);
    expect(r.uncalled).toEqual({ playerId: "BTN", amount: 1500 });
    expect(r.total).toBe(2500);
    expect(calculatePot(players, blinds, actions, { settle: false }).total).toBe(4000);
  });

  it("short blind is capped by stack", () => {
    const players: TablePlayer[] = [
      { id: "SB", name: "SB", stack: 10000 },
      { id: "BB", name: "BB", stack: 600 },
      { id: "BTN", name: "BTN", stack: 10000 },
    ];
    const actions = [A("SB", "post_sb", 500), A("BB", "post_bb", 1000), A("BTN", "call"), A("SB", "call")];
    const r = calculatePot(players, blinds, actions, { settle: false });
    expect(r.contributions).toEqual({ SB: 1000, BB: 600, BTN: 1000 });
    expect(r.allIn).toEqual(["BB"]);
  });

  it("antes are dead money (engine-ready, MVP uses 0)", () => {
    const players = deep(["SB", "BB", "BTN"]);
    const b = { sb: 500, bb: 1000, ante: 100 };
    const actions = [A("SB", "ante", 100), A("BB", "ante", 100), A("BTN", "ante", 100), A("SB", "post_sb", 500), A("BB", "post_bb", 1000), A("BTN", "call"), A("SB", "call"), A("BB", "check")];
    expect(calculatePot(players, b, actions).total).toBe(3300);
  });

  it("rejects illegal sequences", () => {
    const players = deep(["SB", "BB"]);
    expect(() => calculatePot(players, blinds, [A("SB", "post_sb", 500), A("BB", "post_bb", 1000), A("SB", "check")])).toThrow();
    expect(() => calculatePot(players, blinds, [A("SB", "post_sb", 500), A("BB", "post_bb", 1000), A("SB", "raise", 800)])).toThrow();
    expect(() => calculatePot(players, blinds, [A("SB", "post_sb", 500), A("BB", "post_bb", 1000), A("SB", "fold"), A("SB", "call")])).toThrow();
    expect(() => calculatePot(players, blinds, [A("SB", "post_sb", 500), A("BB", "post_bb", 1000), A("SB", "raise", 999999)])).toThrow();
  });
});
