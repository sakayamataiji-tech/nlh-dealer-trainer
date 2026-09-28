import type { TrainingMode } from "@/engine/scenarioTypes";

export type SessionModeKey = TrainingMode | "quick" | "weakness";

export const MODE_META: Record<SessionModeKey, { title: string; slug: string }> = {
  hand: { title: "HAND READING", slug: "hand" },
  winner: { title: "WINNER", slug: "winner" },
  pot: { title: "POT", slug: "pot" },
  sidepot: { title: "SIDE POT", slug: "side-pot" },
  quick: { title: "QUICK TRAINING", slug: "quick" },
  weakness: { title: "WEAKNESS TRAINING", slug: "weakness" },
};

export const SLUG_TO_MODE: Record<string, SessionModeKey> = Object.fromEntries(
  (Object.entries(MODE_META) as [SessionModeKey, { slug: string }][]).map(([k, v]) => [v.slug, k]),
);
