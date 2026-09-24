"use client";
import { useSyncExternalStore } from "react";
import { addRecord, addSession, LocalStorageStatsRepository, type StatsRepository } from "@/stats/repository";
import {
  emptyStats,
  type AnswerRecord,
  type Experience,
  EXPERIENCE_OPTIONS,
  type PlayerSetting,
  type PlayerSettingMode,
  type SessionLength,
  type SessionSummary,
  type StatsData,
} from "@/stats/types";
import type { AnteType, Level, TrainingMode } from "@/engine/scenarioTypes";

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
      settings: { ...d.settings, levels: { hand: level, winner: level, pot: level, sidepot: level } },
    }));
  }
  setLevel(mode: TrainingMode, level: Level) {
    this.update((d) => ({ ...d, settings: { ...d.settings, levels: { ...d.settings.levels, [mode]: level } } }));
  }
  setAllLevels(level: Level) {
    this.update((d) => ({ ...d, settings: { ...d.settings, levels: { hand: level, winner: level, pot: level, sidepot: level } } }));
  }
  setAnte(ante: AnteType) {
    this.update((d) => ({ ...d, settings: { ...d.settings, ante } }));
  }
  setPlayers(mode: PlayerSettingMode, value: PlayerSetting) {
    this.update((d) => ({ ...d, settings: { ...d.settings, players: { ...d.settings.players, [mode]: value } } }));
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
