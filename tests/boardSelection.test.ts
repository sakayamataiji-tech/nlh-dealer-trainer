import { describe, expect, it } from "vitest";
import { boardCardsInBestFive, isValidBoardSelection } from "@/engine/boardSelection";
import { evaluatePlayer } from "@/engine/handEvaluator";
import { boardSelectionCorrect } from "@/engine/grading";
import { resolveShowdown } from "@/engine/handComparator";
import type { WinnerScenario } from "@/engine/scenarioTypes";
import { c } from "./helpers";

const check = (board: string, hole: string, selected: string) =>
  isValidBoardSelection(c(board), c(hole), evaluatePlayer(c(hole), c(board)), c(selected));

describe("board-card selection (dealer pushes up the playing board cards)", () => {
  it("two pair using both hole cards → the one board kicker + two paired board cards", () => {
    // Board K K 8 5 2, hole Q Q: best = K K Q Q 8 → board K K 8
    expect(check("Ks Kd 8c 5h 2s", "Qc Qh", "Ks Kd 8c")).toBe(true);
    expect(check("Ks Kd 8c 5h 2s", "Qc Qh", "Ks Kd 5h")).toBe(false); // wrong kicker
    expect(check("Ks Kd 8c 5h 2s", "Qc Qh", "Ks Kd 8c 5h")).toBe(false); // hand would drop a queen
  });
  it("one hole card plays → four board cards", () => {
    // Board K K 8 5 2, hole A 8: best = K K 8 8 A → board K K 8
    expect(check("Ks Kd 8c 5h 2s", "Ac 8d", "Ks Kd 8c")).toBe(true);
    expect(check("Ks Kd 8c 5h 2s", "Ac 8d", "Ks Kd 8c 5h")).toBe(false);
  });
  it("board plays → all five board cards", () => {
    expect(check("As Ks Qd Jc Th", "2c 3d", "As Ks Qd Jc Th")).toBe(true);
    expect(check("As Ks Qd Jc Th", "2c 3d", "As Ks Qd Jc")).toBe(false);
  });
  it("equivalent choices are all accepted (either paired board card)", () => {
    // Board 5 6 7 8 8, hole 9 2: straight 5-9 uses one of the two 8s
    expect(check("5s 6d 7c 8h 8s", "9c 2d", "5s 6d 7c 8h")).toBe(true);
    expect(check("5s 6d 7c 8h 8s", "9c 2d", "5s 6d 7c 8s")).toBe(true);
    expect(check("5s 6d 7c 8h 8s", "9c 2d", "5s 6d 7c 8h 8s")).toBe(false);
  });
  it("flush: only the suited board cards that make the top five", () => {
    // Board Ah 9h 6h 3h Kc, hole Qh 2c: flush A Q 9 6 3 → board A 9 6 3
    expect(check("Ah 9h 6h 3h Kc", "Qh 2c", "Ah 9h 6h 3h")).toBe(true);
    expect(check("Ah 9h 6h 3h Kc", "Qh 2c", "Ah 9h 6h Kc")).toBe(false);
  });
  it("rejects fewer than three board cards, duplicates and cards not on the board", () => {
    expect(check("As Ks Qd Jc 2h", "Ac Ad", "As Ks")).toBe(false);
    expect(isValidBoardSelection(c("As Ks Qd Jc 2h"), c("Ac Ad"), evaluatePlayer(c("Ac Ad"), c("As Ks Qd Jc 2h")), c("As As Ks"))).toBe(false);
    expect(check("As Ks Qd Jc 2h", "Ac Ad", "Ac Ks Qd")).toBe(false);
  });
  it("canonical answer from the engine is valid", () => {
    const board = c("Ks Kd 8c 5h 2s");
    const hand = evaluatePlayer(c("Ac 8d"), board);
    expect(boardCardsInBestFive(board, hand).sort()).toEqual(c("Ks Kd 8c").sort());
  });
  it("grading: cards judged against the named player; SPLIT against the actual winners", () => {
    const board = c("Ks Kd 8c 5h 2s");
    const players = [
      { id: "P1", name: "PLAYER 1", hole: c("Ac 8d") },
      { id: "P2", name: "PLAYER 2", hole: c("Qc Qh") },
    ];
    const s = { board, players, result: resolveShowdown(board, players) } as unknown as WinnerScenario;
    expect(boardSelectionCorrect(s, "P2", c("Ks Kd 8c"))).toBe(true);
    expect(boardSelectionCorrect(s, "P1", c("Ks Kd 8c"))).toBe(true);
    expect(boardSelectionCorrect(s, "SPLIT", c("Ks Kd 8c"))).toBe(true); // valid for the real winner P2
    expect(boardSelectionCorrect(s, "P2", c("Ks Kd 5h"))).toBe(false);
  });
});
