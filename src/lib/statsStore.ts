"use client";
import { useSyncExternalStore } from "react";
import { addRecord, addSession, LocalStorageStatsRepository, type StatsRepository } from "@/stats/repository";
import {
  emptyStats,
  type AnswerRecord,
  type Experience,
  EXPERIENCE_OPTIONS,
  type CashSettings,
  type PlayerSetting,
  type PlayerSettingMode,
  type SessionLength,
  type SessionSummary,
  type StatsData,
} from "@/stats/types";
import type { AnteType, Level, TrainingMode } from "@/engine/scenarioTypes";
import { chipUnit, CHIP_UNITS, DEFAULT_RAKE_RULE, normalizeBlinds, normalizeRakeRule, SMALL_GAME_RAKE_RULE } from "@/engine/rake";

/** Client-side store over a StatsRepository (swap the repository to move to a backend). */
class StatsStore {
  private data: StatsData | null = null;
  private listeners = new Set<() => void>();
  constructor(private repo: StatsRepository) {}

  private ensure(): StatsData {
    if (!this.data) this.data = this.repo.load();
    return this.data;
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): StatsData | null => (typeof window === "undefined" ? null : this.ensure());
  getServerSnapshot = (): StatsData | null => null;

  private update(fn: (d: StatsData) => StatsData) {
    this.data = fn(this.ensure());
    this.repo.save(this.data);
    this.listeners.forEach((l) => l());
  }
  recordAnswer(r: AnswerRecord) {
    this.update((d) => addRecord(d, r));
  }
  recordSession(s: SessionSummary) {
    this.update((d) => addSession(d, s));
  }
  setExperience(exp: Experience) {
    const level = EXPERIENCE_OPTIONS.find((o) => o.value === exp)!.level;
    this.update((d) => ({
      ...d,
      profile: { experience: exp, onboardedAt: d.profile.onboardedAt ?? Date.now() },
      settings: { ...d.settings, levels: { hand: level, winner: level, pot: level, sidepot: level, rake: level } },
    }));
  }
  setLevel(mode: TrainingMode, level: Level) {
    this.update((d) => ({ ...d, settings: { ...d.settings, levels: { ...d.settings.levels, [mode]: level } } }));
  }
  setAllLevels(level: Level) {
    this.update((d) => ({ ...d, settings: { ...d.settings, levels: { hand: level, winner: level, pot: level, sidepot: level, rake: level } } }));
  }
  setAnte(ante: AnteType) {
    this.update((d) => ({ ...d, settings: { ...d.settings, ante } }));
  }
  setPlayers(mode: PlayerSettingMode, value: PlayerSetting) {
    this.update((d) => ({ ...d, settings: { ...d.settings, players: { ...d.settings.players, [mode]: value } } }));
  }
  setLang(lang: "ja" | "en") {
    this.update((d) => ({ ...d, settings: { ...d.settings, lang } }));
  }
  setCash(patch: Partial<CashSettings>) {
    this.update((d) => {
      const prev = d.settings.cash;
      const cash = { ...prev, ...patch, ...normalizeBlinds(patch.sb ?? prev.sb, patch.bb ?? prev.bb) };
      if (patch.sb !== undefined || patch.bb !== undefined) {
        // New blinds: pick their usual smallest chip; moving between small (1/5-chip) and
        // 25-chip games starts from that kind of game's usual rule.
        cash.unit = chipUnit(cash.sb, cash.bb);
        const small = (u: number) => u < 25;
        if (small(cash.unit) !== small(prev.unit) && !patch.rake) cash.rake = { ...(small(cash.unit) ? SMALL_GAME_RAKE_RULE : DEFAULT_RAKE_RULE), rounding: prev.rake.rounding };
      }
      if (!(CHIP_UNITS as readonly number[]).includes(cash.unit)) cash.unit = chipUnit(cash.sb, cash.bb);
      return { ...d, settings: { ...d.settings, cash: { ...cash, rake: normalizeRakeRule(cash.rake) } } };
    });
  }
  setPlaybackSpeed(speed: 1 | 2 | 3) {
    this.update((d) => ({ ...d, settings: { ...d.settings, playbackSpeed: speed } }));
  }
  setSelectBoardCards(on: boolean) {
    this.update((d) => ({ ...d, settings: { ...d.settings, selectBoardCards: on } }));
  }
  setSessionLength(len: SessionLength) {
    this.update((d) => ({ ...d, settings: { ...d.settings, sessionLength: len } }));
  }
  /** Replace everything (backup import). */
  replaceAll(data: StatsData) {
    this.data = data;
    this.repo.save(data);
    this.listeners.forEach((l) => l());
  }
  reset() {
    this.repo.clear();
    this.data = emptyStats();
    this.listeners.forEach((l) => l());
  }
  get current(): StatsData {
    return this.ensure();
  }
}

export const statsStore = new StatsStore(new LocalStorageStatsRepository());

/** Returns null during SSR / before hydration. */
export function useStats(): StatsData | null {
  return useSyncExternalStore(statsStore.subscribe, statsStore.getSnapshot, statsStore.getServerSnapshot);
}
