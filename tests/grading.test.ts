import { describe, expect, it } from "vitest";
import { gradeAnswer, rateSpeed, scoreAnswer } from "@/engine/grading";
import { generateHandScenario, generateSidePotScenario, generateWinnerScenario, generatePotScenario } from "@/engine/scenarioGenerator";
import { seededRng } from "@/engine/shuffle";
import { HandCategory } from "@/engine/handEvaluator";
import { boardCardsInBestFive } from "@/engine/boardSelection";

describe("grading", () => {
  const rng = seededRng(55);
  it("hand: correct only for the evaluator category", () => {
    const s = generateHandScenario(3, { rng });
    expect(gradeAnswer(s, { mode: "hand", category: s.hand.category }).correct).toBe(true);
    const wrong = s.hand.category === HandCategory.HighCard ? HandCategory.OnePair : HandCategory.HighCard;
    expect(gradeAnswer(s, { mode: "hand", category: wrong }).correct).toBe(false);
  });
  it("winner / pot / side pot", () => {
    const w = generateWinnerScenario(3, { rng });
    const winHand = w.result.entries.find((e) => e.id === w.result.winners[0])!.hand;
    const used = boardCardsInBestFive(w.board, winHand);
    expect(gradeAnswer(w, { mode: "winner", key: w.correctKey, boardCards: used }).correct).toBe(true);
    // Right winner, cards missing → incorrect (winner part still marked correct).
    const noCards = gradeAnswer(w, { mode: "winner", key: w.correctKey });
    expect(noCards.correct).toBe(false);
    expect(noCards.parts).toEqual({ winner: true, cards: false });
    expect(gradeAnswer(w, { mode: "winner", key: "nobody", boardCards: used }).correct).toBe(false);
    // Board-card step disabled: winner only.
    const w2 = generateWinnerScenario(3, { rng, selectBoardCards: false });
    expect(gradeAnswer(w2, { mode: "winner", key: w2.correctKey }).correct).toBe(true);
    const p = generatePotScenario(2, { rng });
    expect(gradeAnswer(p, { mode: "pot", amount: p.answer }).correct).toBe(true);
    expect(gradeAnswer(p, { mode: "pot", amount: p.answer + 100 }).correct).toBe(false);
    const sp = generateSidePotScenario(3, { rng });
    const all = Object.fromEntries(sp.questions.map((q) => [q.key, q.answer]));
    expect(gradeAnswer(sp, { mode: "sidepot", amounts: all }).correct).toBe(true);
    const bad = { ...all, [sp.questions[0].key]: 1 };
    const g = gradeAnswer(sp, { mode: "sidepot", amounts: bad });
    expect(g.correct).toBe(false);
    expect(g.parts![sp.questions[0].key]).toBe(false);
  });
  it("speed rating and score (accuracy first: wrong = 0)", () => {
    expect(rateSpeed(1000, 5)).toBe("fast");
    expect(rateSpeed(5000, 5)).toBe("normal");
    expect(rateSpeed(9000, 5)).toBe("slow");
    expect(scoreAnswer(false, "fast", 0, 5).total).toBe(0);
    expect(scoreAnswer(true, "fast", 5, 1)).toMatchObject({ base: 100, speedBonus: 30, streakBonus: 25, total: 155 });
  });
});
