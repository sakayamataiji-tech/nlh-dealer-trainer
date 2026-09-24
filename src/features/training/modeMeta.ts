import type { TrainingMode } from "@/engine/scenarioTypes";

export type SessionModeKey = TrainingMode | "quick" | "weakness";

export const MODE_META: Record<SessionModeKey, { title: string; ja: string; slug: string }> = {
  hand: { title: "HAND READING", ja: "役判定", slug: "hand" },
  winner: { title: "WINNER", ja: "勝者判定", slug: "winner" },
  pot: { title: "POT", ja: "ポット計算", slug: "pot" },
  sidepot: { title: "SIDE POT", ja: "サイドポット計算", slug: "side-pot" },
  quick: { title: "QUICK TRAINING", ja: "4カテゴリからランダム出題", slug: "quick" },
  weakness: { title: "WEAKNESS TRAINING", ja: "苦手を優先して出題", slug: "weakness" },
};

export const SLUG_TO_MODE: Record<string, SessionModeKey> = Object.fromEntries(
  (Object.entries(MODE_META) as [SessionModeKey, { slug: string }][]).map(([k, v]) => [v.slug, k]),
);
