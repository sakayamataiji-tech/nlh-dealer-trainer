import type { TrainingMode } from "./scenarioTypes";

/**
 * Skill tags attached to every scenario. Tags are DERIVED from the rules-engine
 * result (not from the generator's intent), and drive weakness analysis.
 */
export const SKILLS = {
  "high-card": { label: "High Card Detection", modes: ["hand"] },
  "pair-detection": { label: "Pair Detection", modes: ["hand"] },
  "two-pair-detection": { label: "Two Pair Detection", modes: ["hand"] },
  "trips-detection": { label: "Trips Detection", modes: ["hand"] },
  "straight-detection": { label: "Straight Detection", modes: ["hand"] },
  "flush-detection": { label: "Flush Detection", modes: ["hand"] },
  "full-house-detection": { label: "Full House Detection", modes: ["hand"] },
  "quads-detection": { label: "Quads Detection", modes: ["hand"] },
  "straight-flush-detection": { label: "Straight Flush Detection", modes: ["hand"] },
  wheel: { label: "Wheel (A-2-3-4-5)", modes: ["hand", "winner"] },
  "board-play": { label: "Board Play", modes: ["hand", "winner"] },
  "four-flush-board": { label: "Four Flush Board", modes: ["hand", "winner"] },
  "double-paired-board": { label: "Double Paired Board", modes: ["hand", "winner"] },
  "kicker-comparison": { label: "Kicker Comparison", modes: ["winner"] },
  "two-pair-comparison": { label: "Two Pair Comparison", modes: ["winner"] },
  "straight-comparison": { label: "Straight Comparison", modes: ["winner"] },
  "flush-comparison": { label: "Flush Comparison", modes: ["winner"] },
  "full-house-comparison": { label: "Full House Comparison", modes: ["winner"] },
  "category-comparison": { label: "Hand Category Comparison", modes: ["winner"] },
  counterfeit: { label: "Counterfeit", modes: ["winner"] },
  "split-pot": { label: "Split Pot", modes: ["winner"] },
  "multiway-showdown": { label: "Multiway Showdown", modes: ["winner"] },
  "pot-preflop": { label: "Preflop Pot", modes: ["pot"] },
  "pot-multistreet": { label: "Multi-Street Pot", modes: ["pot"] },
  "pot-allin": { label: "All-in Pot", modes: ["pot"] },
  "side-pot": { label: "Side Pot", modes: ["sidepot"] },
  "multiple-side-pots": { label: "Multiple Side Pots", modes: ["sidepot"] },
  "folded-contribution": { label: "Folded Player Contribution", modes: ["sidepot"] },
  "uncalled-bet": { label: "Uncalled Bet Return", modes: ["sidepot", "pot"] },
  ante: { label: "Ante", modes: ["pot", "sidepot"] },
  "board-card-selection": { label: "Board Card Selection", modes: ["hand", "winner"] },
} as const satisfies Record<string, { label: string; modes: readonly TrainingMode[] }>;

export type SkillTag = keyof typeof SKILLS;

export function skillLabel(tag: SkillTag): string {
  return SKILLS[tag].label;
}

export function skillModes(tag: SkillTag): readonly TrainingMode[] {
  return SKILLS[tag].modes;
}
