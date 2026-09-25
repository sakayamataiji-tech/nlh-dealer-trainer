import { describe, expect, it } from "vitest";
import { addRecord, LocalStorageStatsRepository, migrate, STORAGE_KEY } from "@/stats/repository";
import { emptyStats, SCHEMA_VERSION, type AnswerRecord } from "@/stats/types";
import { bySkill, dealerRating, gradeOf, longestStreak, summarize, todayRecords, weakestSkill, weaknesses, byLevel } from "@/stats/aggregate";

let n = 0;
const rec = (p: Partial<AnswerRecord>): AnswerRecord => ({
  id: `r${n++}`, at: Date.now(), mode: "hand", level: 1, correct: true, timeMs: 3000, speed: "normal", score: 100, skills: [], sessionId: "s", ...p,
});

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe("stats repository", () => {
  it("round-trips through storage with schemaVersion", () => {
    const storage = new MemStorage();
    const repo = new LocalStorageStatsRepository(storage);
    const data = addRecord(emptyStats(), rec({}));
    repo.save(data);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).schemaVersion).toBe(SCHEMA_VERSION);
    expect(repo.load().records).toHaveLength(1);
  });
  it("corrupt or unknown-version data resets safely", () => {
    const storage = new MemStorage();
    storage.setItem(STORAGE_KEY, "{not json");
    expect(new LocalStorageStatsRepository(storage).load()).toEqual(emptyStats());
    expect(migrate({ schemaVersion: 999, records: [1] })).toEqual(emptyStats());
    expect(migrate({ schemaVersion: 1, settings: { levels: { pot: 3 } } }).settings.levels).toEqual({ hand: 1, winner: 1, pot: 3, sidepot: 1 });
  });
  it("tracks streak and best streak", () => {
    let d = emptyStats();
    for (const c of [true, true, true, false, true]) d = addRecord(d, rec({ correct: c }));
    expect(d.streak).toEqual({ current: 1, best: 3 });
  });
});

describe("stats aggregate", () => {
  it("summary, today, levels, longest streak", () => {
    const rs = [rec({ correct: true, timeMs: 2000 }), rec({ correct: false, timeMs: 4000, level: 3 }), rec({ at: 0 })];
    expect(summarize(rs.slice(0, 2))).toEqual({ total: 2, correct: 1, accuracy: 0.5, avgTimeMs: 3000 });
    expect(todayRecords(rs)).toHaveLength(2);
    expect(byLevel(rs)[3].total).toBe(1);
    expect(longestStreak([rec({}), rec({}), rec({ correct: false }), rec({})])).toBe(2);
  });
  it("dealer rating: needs minimum answers; overall is not an average of grades", () => {
    expect(dealerRating([rec({})]).overall.grade).toBeNull();
    const rs = [
      ...Array.from({ length: 10 }, () => rec({ mode: "hand", correct: true, speed: "fast", level: 5 })),
      ...Array.from({ length: 30 }, () => rec({ mode: "pot", correct: false, speed: "slow", level: 1 })),
    ];
    const r = dealerRating(rs);
    expect(r.modes.hand.grade).toBe("S");
    expect(r.modes.pot.grade).toBe("D");
    // weighted by answers: many poor pot answers pull overall down to D
    expect(r.overall.grade).toBe("D");
    expect(gradeOf(0.85)).toBe("A");
  });
  it("weaknesses sorted weakest first, including modes and skills", () => {
    const rs = [
      ...Array.from({ length: 10 }, (_, i) => rec({ mode: "sidepot", correct: i < 6, skills: ["side-pot"] })),
      ...Array.from({ length: 10 }, (_, i) => rec({ mode: "winner", correct: i < 7, skills: ["full-house-comparison"] })),
      ...Array.from({ length: 10 }, () => rec({ mode: "hand", correct: true, skills: ["flush-detection"] })),
    ];
    const w = weaknesses(rs);
    expect(w[0].label).toBe("SIDE POT");
    expect(w.map((x) => x.key)).toContain("full-house-comparison");
    expect(w.map((x) => x.key)).not.toContain("flush-detection");
    expect(weakestSkill(rs)).toBe("Side Pot");
  });
});

describe("board-card selection tracking", () => {
  it("scores the card step separately from the main question", () => {
    const rs = [
      // Right hand, wrong cards (overall incorrect)
      ...Array.from({ length: 4 }, () => rec({ mode: "hand", correct: false, skills: ["straight-detection"], parts: { category: true, cards: false } })),
      // Both right
      rec({ mode: "winner", correct: true, skills: ["kicker-comparison"], parts: { winner: true, cards: true } }),
    ];
    const rows = Object.fromEntries(bySkill(rs).map((r) => [r.skill, r.summary]));
    // Straight detection is judged on the hand only → 100%.
    expect(rows["straight-detection"].accuracy).toBe(1);
    expect(rows["board-card-selection"]).toMatchObject({ total: 5, correct: 1 });
    const weak = weaknesses(rs);
    expect(weak.map((w) => w.key)).toContain("board-card-selection");
    expect(weak.map((w) => w.key)).not.toContain("straight-detection");
  });
  it("older records without parts still count by overall correctness", () => {
    const rows = bySkill([rec({ correct: false, skills: ["flush-detection"] })]);
    expect(rows[0].summary.accuracy).toBe(0);
  });
});
