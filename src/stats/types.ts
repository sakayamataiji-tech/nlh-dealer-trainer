import type { AnteType, Level, TrainingMode } from "@/engine/scenarioTypes";
import type { SkillTag } from "@/engine/skills";
import type { SpeedRating } from "@/engine/grading";

export const SCHEMA_VERSION = 1;

export type Experience = "none" | "under3m" | "3to12m" | "over1y";

export const EXPERIENCE_OPTIONS: { value: Experience; label: string; level: Level }[] = [
  { value: "none", label: "未経験", level: 1 },
  { value: "under3m", label: "〜3ヶ月", level: 2 },
  { value: "3to12m", label: "3〜12ヶ月", level: 3 },
  { value: "over1y", label: "1年以上", level: 4 },
];

export type SessionLength = 10 | 25 | 50 | "endless";

/** "auto" = player count follows the level. */
export type PlayerSetting = "auto" | number;
export type PlayerSettingMode = "winner" | "pot" | "sidepot";

export const ANTE_OPTIONS: { value: AnteType; label: string }[] = [
  { value: "none", label: "なし" },
  { value: "bb", label: "BBアンティ" },
  { value: "all", label: "全員アンティ" },
];
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
    },
    records: [],
    streak: { current: 0, best: 0 },
    totalScore: 0,
    sessions: [],
  };
}
