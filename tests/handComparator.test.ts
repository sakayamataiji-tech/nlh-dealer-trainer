import { describe, expect, it } from "vitest";
import { compareHands, resolveShowdown, winnersAmong } from "@/engine/handComparator";
import { evaluatePlayer, HandCategory as H, describeHand, bestFiveLabel } from "@/engine/handEvaluator";
import { isCounterfeited } from "@/engine/scenarioGenerator";
import { c } from "./helpers";

const show = (board: string, ...holes: string[]) =>
  resolveShowdown(c(board), holes.map((h, i) => ({ id: `P${i + 1}`, hole: c(h) })));

describe("handComparator: §21 edge cases", () => {
  it("Full House vs Full House: trips rank decides first", () => {
    const r = show("Ks Kd 8c 8h 2s", "Kc 3d", "8d 2c");
    // P1: Kings full of Eights; P2: Eights full of Kings
    expect(r.winners).toEqual(["P1"]);
  });
  it("Full House vs Full House: same trips, pair decides", () => {
    const r = show("Ks Kd Kc 8h 2s", "Qc Qd", "8d 7s");
    expect(r.winners).toEqual(["P1"]);
  });
  it("Quads Kicker: board quads, best kicker wins", () => {
    const r = show("9s 9d 9c 9h 2s", "Ac 3d", "Kd Qs");
    expect(r.winners).toEqual(["P1"]);
  });
  it("Quads Kicker: board quads with ace on board = split", () => {
    const r = show("9s 9d 9c 9h As", "Kc 3d", "Qd Js");
    expect(r.isSplit).toBe(true);
    expect(r.winners).toEqual(["P1", "P2"]);
  });
  it("Same Straight: split", () => {
    const r = show("9s 8d 7c 2h 2s", "Tc 6d", "Td 6s");
    expect(r.isSplit).toBe(true);
  });
  it("Higher straight wins", () => {
    const r = show("9s 8d 7c 6h 2s", "5c 4d", "Td Js");
    expect(r.winners).toEqual(["P2"]);
  });
  it("Wheel loses to six-high straight", () => {
    const r = show("2s 3d 4c 5h Ks", "Ac Qd", "6d Js");
    expect(r.winners).toEqual(["P2"]);
  });
  it("Same Flush (board flush): split", () => {
    const r = show("Ah Kh 9h 6h 3h", "2c 2d", "Qs Js");
    expect(r.isSplit).toBe(true);
  });
  it("Flush vs flush: compared down to the fifth card", () => {
    const r = show("Ah Kh 9h 6h 3c", "4h 2c", "2h Qs");
    // P1: A K 9 6 4 vs P2: A K 9 6 2
    expect(r.winners).toEqual(["P1"]);
  });
  it("Higher flush with one hole card on four-flush board", () => {
    const r = show("Th 8h 5h 2h Kc", "Ah 3c", "Qh Kd");
    expect(r.winners).toEqual(["P1"]);
  });
  it("Kicker Comparison: same pair, kicker decides", () => {
    const r = show("As 9d 7c 4h 2s", "Ac Kd", "Ad Qs");
    expect(r.winners).toEqual(["P1"]);
  });
  it("Kicker plays only if in best five (both kickers below board)", () => {
    const r = show("As Ks Qd Jc 9h", "3c 2d", "4d 2s");
    expect(r.isSplit).toBe(true);
  });
  it("Counterfeit Two Pair: board pairs higher and counterfeits the hole two pair", () => {
    // P1 had 7-6 two pair on 7-6-2; board runs K-K: P1 best = K K 7 7 Q? No: board 7 6 2 K K
    const board = c("7s 6d 2c Kh Kd");
    const p1 = c("7c 6c");
    const p2 = c("Ac Qd");
    const h1 = evaluatePlayer(p1, board);
    expect(h1.category).toBe(H.TwoPair);
    expect(h1.tiebreak.slice(0, 2)).toEqual([13, 7]);
    expect(isCounterfeited(p1, board, h1)).toBe(true);
    const r = resolveShowdown(board, [{ id: "P1", hole: p1 }, { id: "P2", hole: p2 }]);
    expect(r.winners).toEqual(["P1"]);
  });
  it("Counterfeit: double-paired board makes the lower hole pair irrelevant", () => {
    const board = c("Ks Kd Qc Qh 5s");
    const r = show("Ks Kd Qc Qh 5s", "5c 4d", "Ad 2s");
    // P1: K K Q Q 5 (fives counterfeited); P2: K K Q Q A
    expect(r.winners).toEqual(["P2"]);
    expect(board).toHaveLength(5);
  });
  it("Three-way Split", () => {
    const r = show("As Ks Qd Jc Th", "2c 3d", "4h 5s", "6c 7d");
    expect(r.isSplit).toBe(true);
    expect(r.winners).toEqual(["P1", "P2", "P3"]);
  });
  it("Partial split among three players", () => {
    const r = show("As Ks Qd 7c 2h", "Jc Td", "Jh Ts", "3c 4d");
    expect(r.winners).toEqual(["P1", "P2"]);
    expect(r.entries.find((e) => e.id === "P3")!.rank).toBe(2);
  });
  it("Spec §8 example: K K 8 5 2 — Queens-up beats Eights-up (spec example corrected)", () => {
    const r = show("Ks Kd 8c 5h 2s", "Ac 8d", "Qc Qh", "Ad 5c");
    expect(r.winners).toEqual(["P2"]);
    const p2 = r.entries.find((e) => e.id === "P2")!.hand;
    expect(describeHand(p2)).toBe("Kings & Queens, Eight Kicker");
    const p1 = r.entries.find((e) => e.id === "P1")!.hand;
    expect(bestFiveLabel(p1).split(" ").sort()).toEqual("K♠ K♦ 8♣ 8♦ A♣".split(" ").sort());
  });
  it("compareHands ordering and winnersAmong subset", () => {
    const a = evaluatePlayer(c("Ac Ad"), c("2s 7d 9c Jh 4s"));
    const b = evaluatePlayer(c("Kc Kd"), c("2s 7d 9c Jh 4s"));
    expect(compareHands(a, b)).toBeGreaterThan(0);
    const r = show("2s 7d 9c Jh 4s", "Ac Ad", "Kc Kd", "Qc Qd");
    expect(winnersAmong(r, ["P2", "P3"])).toEqual(["P2"]);
  });
});
