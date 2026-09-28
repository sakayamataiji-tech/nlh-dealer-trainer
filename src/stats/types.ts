import type { AnteType, Level, TrainingMode } from "@/engine/scenarioTypes";
import type { SkillTag } from "@/engine/skills";
import type { SpeedRating } from "@/engine/grading";

export const SCHEMA_VERSION = 1;

export type Experience = "none" | "under3m" | "3to12m" | "over1y";

/** Labels live in src/i18n (t.experience). */
export const EXPERIENCE_OPTIONS: { value: Experience; level: Level }[] = [
  { value: "none", level: 1 },
  { value: "under3m", level: 2 },
  { value: "3to12m", level: 3 },
  { value: "over1y", level: 4 },
];

export type SessionLength = 10 | 25 | 50 | "endless";

/** "auto" = player count follows the level. */
export type PlayerSetting = "auto" | number;
export type PlayerSettingMode = "winner" | "pot" | "sidepot";

/** Labels live in src/i18n (t.anteOptions). */
export const ANTE_OPTIONS: AnteType[] = ["none", "bb", "all"];
export const SESSION_LENGTHS: SessionLength[] = [10, 25, 50, "endless"];

export interface AnswerRecord {
  id: string;
  /** epoch ms */
  at: number;
  mode: TrainingMode;
  level: Level;
  correct: boolean;
  timeMs: number;
  speed: SpeedRating;
  score: number;
  skills: SkillTag[];
  sessionId: string;
  /**
   * Per-part result for two-step questions, e.g. { category, cards } (HAND) or { winner, cards } (WINNER).
   * Older records have none; they count with `correct`.
   */
  parts?: Record<string, boolean>;
}

export interface SessionSummary {
  id: string;
  startedAt: number;
  endedAt: number;
  modeKey: string;
  total: number;
  correct: number;
  avgTimeMs: number;
  bestStreak: number;
  score: number;
  weakestSkill: string | null;
}

/** Persisted document. Shape is backend-agnostic so it can move to Supabase later. */
export interface StatsData {
  schemaVersion: typeof SCHEMA_VERSION;
  profile: { experience: Experience | null; onboardedAt: number | null };
  settings: {
    levels: Record<TrainingMode, Level>;
    sessionLength: SessionLength;
    ante: AnteType;
    players: Record<PlayerSettingMode, PlayerSetting>;
    /** WINNER: also pick the board cards that play. */
    selectBoardCards: boolean;
    /** POT: action playback speed multiplier. */
    playbackSpeed: 1 | 2 | 3;
    /** UI language; unset = follow the browser language. */
    lang?: "ja" | "en";
  };
  records: AnswerRecord[];
  streak: { current: number; best: number };
  totalScore: number;
  sessions: SessionSummary[];
}

export const MAX_RECORDS = 5000;
export const MAX_SESSIONS = 100;

export function emptyStats(): StatsData {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: { experience: null, onboardedAt: null },
    settings: {
      levels: { hand: 1, winner: 1, pot: 1, sidepot: 1 },
      sessionLength: 10,
      ante: "none",
      players: { winner: "auto", pot: "auto", sidepot: "auto" },
      selectBoardCards: true,
      playbackSpeed: 1,
    },
    records: [],
    streak: { current: 0, best: 0 },
    totalScore: 0,
    sessions: [],
  };
}
