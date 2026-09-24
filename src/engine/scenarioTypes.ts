import type { BlindStructure, Street, TableAction, TablePlayer } from "./actions";
import type { Card } from "./cards";
import type { ShowdownResult } from "./handComparator";
import type { EvaluatedHand, HandCategory } from "./handEvaluator";
import type { PotResult } from "./potCalculator";
import type { SidePotResult } from "./sidePotCalculator";
import type { SkillTag } from "./skills";

export type TrainingMode = "hand" | "winner" | "pot" | "sidepot";
export const TRAINING_MODES: readonly TrainingMode[] = ["hand", "winner", "pot", "sidepot"];
export type Level = 1 | 2 | 3 | 4 | 5;
export const LEVELS: readonly Level[] = [1, 2, 3, 4, 5];

interface BaseScenario {
  id: string;
  mode: TrainingMode;
  level: Level;
  skills: SkillTag[];
  /** Expected answer time in seconds, used for FAST / NORMAL / SLOW. */
  targetSeconds: number;
}

export interface HandScenario extends BaseScenario {
  mode: "hand";
  hole: Card[];
  board: Card[];
  /** Derived from handEvaluator. */
  hand: EvaluatedHand;
  choices: HandCategory[];
}

export interface WinnerPlayer {
  id: string;
  name: string;
  hole: Card[];
}

export interface WinnerScenario extends BaseScenario {
  mode: "winner";
  board: Card[];
  players: WinnerPlayer[];
  /** Derived from handComparator. */
  result: ShowdownResult;
  /** Choice keys: player ids + "SPLIT". */
  choices: { key: string; label: string }[];
  correctKey: string;
}

export interface SeatedPlayer extends TablePlayer {
  position: string;
}

export interface PotScenario extends BaseScenario {
  mode: "pot";
  players: SeatedPlayer[];
  blinds: BlindStructure;
  actions: TableAction[];
  askStreet: Street;
  /** Derived from potCalculator. */
  result: PotResult;
  answer: number;
}

export interface NumericQuestion {
  key: string;
  label: string;
  answer: number;
}

export interface SidePotScenario extends BaseScenario {
  mode: "sidepot";
  players: SeatedPlayer[];
  blinds: BlindStructure;
  actions: TableAction[];
  potResult: PotResult;
  /** Derived from sidePotCalculator. */
  pots: SidePotResult;
  questions: NumericQuestion[];
}

export type Scenario = HandScenario | WinnerScenario | PotScenario | SidePotScenario;
