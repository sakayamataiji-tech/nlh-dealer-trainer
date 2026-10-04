import { chipUnit } from "@/engine/rake";
import { CASH_REV, emptyStats, MAX_RECORDS, MAX_SESSIONS, SCHEMA_VERSION, type AnswerRecord, type SessionSummary, type StatsData } from "./types";

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
      settings: {
        ...base.settings,
        ...doc.settings,
        levels: { ...base.settings.levels, ...doc.settings?.levels },
        players: { ...base.settings.players, ...doc.settings?.players },
        cash: {
          ...base.settings.cash,
          ...doc.settings?.cash,
          // Saved before the chip unit was a setting: derive it from the blinds.
          unit: doc.settings?.cash?.unit ?? (doc.settings?.cash?.sb && doc.settings.cash.bb ? chipUnit(doc.settings.cash.sb, doc.settings.cash.bb) : base.settings.cash.unit),
          rake: {
            ...base.settings.cash.rake,
            ...doc.settings?.cash?.rake,
            jackpot: { ...base.settings.cash.rake.jackpot, ...doc.settings?.cash?.rake?.jackpot },
            // Rev 1 saved "down" as the default rounding; the default is now "up".
            ...((doc.settings?.cash?.rev ?? 1) < 2 && doc.settings?.cash?.rake?.rounding === "down" ? { rounding: "up" as const } : {}),
          },
          rev: CASH_REV,
        },
      },
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

/* ---------------- Backup (export / import) ---------------- */

export const BACKUP_KIND = "nlh-dealer-trainer-backup";

/** Serialize the stats document as a backup file. */
export function serializeBackup(data: StatsData, exportedAt = new Date()): string {
  return JSON.stringify({ kind: BACKUP_KIND, exportedAt: exportedAt.toISOString(), data }, null, 2);
}

/**
 * Parse a backup file. Returns null if it is not a backup from this app.
 * Older schema versions go through the normal migration.
 */
export function parseBackup(text: string): StatsData | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || (raw as { kind?: unknown }).kind !== BACKUP_KIND) return null;
  const doc = (raw as { data?: unknown }).data;
  if (!doc || typeof doc !== "object" || typeof (doc as { schemaVersion?: unknown }).schemaVersion !== "number") return null;
  const migrated = migrate(doc);
  // migrate() resets unknown versions to empty — treat that as a failed import.
  if ((doc as { schemaVersion: number }).schemaVersion !== SCHEMA_VERSION) return null;
  const valid = migrated.records.every((r) => r && typeof r.id === "string" && typeof r.correct === "boolean" && typeof r.timeMs === "number");
  return valid ? migrated : null;
}
