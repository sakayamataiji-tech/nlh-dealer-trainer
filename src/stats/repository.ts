import { emptyStats, MAX_RECORDS, MAX_SESSIONS, SCHEMA_VERSION, type AnswerRecord, type SessionSummary, type StatsData } from "./types";

/**
 * Storage abstraction. MVP uses LocalStorage; a Supabase implementation only needs
 * to implement load/save (optionally async-wrapped) with the same document shape.
 */
export interface StatsRepository {
  load(): StatsData;
  save(data: StatsData): void;
  clear(): void;
}

export const STORAGE_KEY = "nlh-dealer-trainer:stats";

/** Bring any stored document up to the current schema. Unknown/corrupt data resets safely. */
export function migrate(raw: unknown): StatsData {
  if (!raw || typeof raw !== "object") return emptyStats();
  const doc = raw as Partial<StatsData> & { schemaVersion?: number };
  if (doc.schemaVersion === SCHEMA_VERSION) {
    const base = emptyStats();
    return {
      ...base,
      ...doc,
      profile: { ...base.profile, ...doc.profile },
      settings: { ...base.settings, ...doc.settings, levels: { ...base.settings.levels, ...doc.settings?.levels } },
      streak: { ...base.streak, ...doc.streak },
      records: Array.isArray(doc.records) ? doc.records : [],
      sessions: Array.isArray(doc.sessions) ? doc.sessions : [],
      schemaVersion: SCHEMA_VERSION,
    };
  }
  // Future: add stepwise migrations here (v1 -> v2 ...). Unknown versions reset.
  return emptyStats();
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LocalStorageStatsRepository implements StatsRepository {
  constructor(private storage: KeyValueStorage | null = typeof window !== "undefined" ? window.localStorage : null) {}
  load(): StatsData {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      return migrate(raw ? JSON.parse(raw) : null);
    } catch {
      return emptyStats();
    }
  }
  save(data: StatsData): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage full / unavailable: keep playing without persistence.
    }
  }
  clear(): void {
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** Pure reducers used by the app (and tests). */
export function addRecord(data: StatsData, record: AnswerRecord): StatsData {
  const current = record.correct ? data.streak.current + 1 : 0;
  const records = [...data.records, record];
  return {
    ...data,
    records: records.length > MAX_RECORDS ? records.slice(records.length - MAX_RECORDS) : records,
    streak: { current, best: Math.max(data.streak.best, current) },
    totalScore: data.totalScore + record.score,
  };
}

export function addSession(data: StatsData, session: SessionSummary): StatsData {
  const sessions = [...data.sessions, session];
  return { ...data, sessions: sessions.length > MAX_SESSIONS ? sessions.slice(-MAX_SESSIONS) : sessions };
}
