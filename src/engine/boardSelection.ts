import type { Card } from "./cards";
import { evaluateFive, type EvaluatedHand } from "./handEvaluator";

/**
 * Dealer procedure at showdown: after reading the winning hand, the dealer pushes up
 * the community cards that play in it.
 *
 * A selection is correct when the selected board cards, together with some of the
 * player's hole cards, form a five-card hand EXACTLY equal in value to the player's best
 * hand. This accepts every equivalent choice (e.g. either of two paired board cards)
 * and rejects anything that changes the hand, including a wrong kicker.
 */
export function isValidBoardSelection(board: readonly Card[], hole: readonly Card[], target: EvaluatedHand, selected: readonly Card[]): boolean {
  if (new Set(selected).size !== selected.length) return false;
  if (selected.some((c) => !board.includes(c))) return false;
  const need = 5 - selected.length;
  if (need < 0 || need > hole.length) return false;
  const holeCombos: Card[][] = need === 0 ? [[]] : need === 1 ? hole.map((h) => [h]) : [[...hole]];
  return holeCombos.some((combo) => evaluateFive([...selected, ...combo]).value === target.value);
}

/** The board cards used by the engine's best five (one canonical correct answer). */
export function boardCardsInBestFive(board: readonly Card[], hand: EvaluatedHand): Card[] {
  return board.filter((c) => hand.bestFive.includes(c));
}
