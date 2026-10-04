import type { ActiveMode } from "@/engine/scenarioTypes";

export type SessionModeKey = ActiveMode | "quick" | "weakness";

export const MODE_META: Record<SessionModeKey, { title: string; slug: string }> = {
  hand: { title: "HAND READING", slug: "hand" },
  winner: { title: "WINNER", slug: "winner" },
  sidepot: { title: "SIDE POT", slug: "side-pot" },
  rake: { title: "RAKE", slug: "rake" },
  quick: { title: "QUICK TRAINING", slug: "quick" },
  weakness: { title: "WEAKNESS TRAINING", slug: "weakness" },
};

/** Old URLs that still open a mode (the POT mode was replaced by RAKE). */
export const LEGACY_SLUGS: Record<string, SessionModeKey> = { pot: "rake" };

export const SLUG_TO_MODE: Record<string, SessionModeKey> = {
  ...LEGACY_SLUGS,
  ...Object.fromEntries((Object.entries(MODE_META) as [SessionModeKey, { slug: string }][]).map(([k, v]) => [v.slug, k])),
};
