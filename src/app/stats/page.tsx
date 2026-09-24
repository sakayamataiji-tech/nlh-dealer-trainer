"use client";
import Link from "next/link";
import { ChevronLeft, Crosshair, Trash2 } from "lucide-react";
import { useState } from "react";
import { useStats, statsStore } from "@/lib/statsStore";
import { byLevel, byMode, bySkill, dealerRating, summarize, weaknesses, type Grade, type RatingDetail } from "@/stats/aggregate";
import { EXPERIENCE_OPTIONS } from "@/stats/types";
import { TRAINING_MODES, LEVELS } from "@/engine/scenarioTypes";
import { MODE_META } from "@/features/training/modeMeta";
import { Button } from "@/components/ui/button";
import { Label, Panel } from "@/components/ui/panel";
import { cn, formatPercent, formatSeconds } from "@/lib/utils";

const GRADE_COLOR: Record<Grade, string> = { S: "text-brass", A: "text-good", B: "text-text", C: "text-warn", D: "text-bad" };

function GradeCell({ label, r, big = false }: { label: string; r: RatingDetail; big?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between px-4", big ? "py-4" : "py-3")}>
      <div>
        <div className={cn("font-bold tracking-[0.15em]", big ? "text-base" : "text-sm")}>{label}</div>
        <div className="text-[11px] text-muted tabular">
          {r.grade ? `Acc ${formatPercent(r.accuracy)} · Speed ${formatPercent(r.speed)} · Diff ${formatPercent(r.difficulty)}` : `あと${Math.max(0, 5 - r.answers)}問で判定`}
        </div>
      </div>
      <div className={cn("font-black", big ? "text-5xl" : "text-3xl", r.grade ? GRADE_COLOR[r.grade] : "text-line")}>{r.grade ?? "—"}</div>
    </div>
  );
}

export default function StatsPage() {
  const stats = useStats();
  const [confirm, setConfirm] = useState(false);
  if (!stats) return null;
  const rs = stats.records;
  const all = summarize(rs);
  const rating = dealerRating(rs);
  const modes = byMode(rs);
  const levels = byLevel(rs);
  const skills = bySkill(rs).sort((a, b) => (a.summary.accuracy ?? 0) - (b.summary.accuracy ?? 0));
  const weak = weaknesses(rs).slice(0, 4);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 px-4 pb-10 pt-3 sm:px-6">
      <header className="flex h-12 items-center gap-2 border-b border-line">
        <Link href="/" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:text-text" aria-label="Home">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 text-sm font-black tracking-[0.18em]">STATS</div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <Label className="mb-2">Dealer Rating</Label>
          <Panel className="divide-y divide-line">
            {TRAINING_MODES.map((m) => (
              <GradeCell key={m} label={MODE_META[m].title} r={rating.modes[m]} />
            ))}
            <div className="bg-panel-2">
              <GradeCell label="OVERALL" r={rating.overall} big />
            </div>
          </Panel>
          <p className="mt-1 text-[11px] text-muted">直近{200}問の Accuracy 60% · Speed 25% · Difficulty 15% から算出</p>
        </section>

        <section className="flex flex-col gap-5">
          <div>
            <Label className="mb-2">Overall</Label>
            <Panel className="grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-3">
              {[
                ["Answers", String(all.total)],
                ["Correct", String(all.correct)],
                ["Accuracy", formatPercent(all.accuracy)],
                ["Avg Time", all.avgTimeMs != null ? `${formatSeconds(all.avgTimeMs, 1)}s` : "—"],
                ["Streak", String(stats.streak.current)],
                ["Best Streak", String(stats.streak.best)],
              ].map(([k, v]) => (
                <div key={k} className="bg-panel px-4 py-3">
                  <div className="text-[10px] font-bold tracking-[0.2em] text-muted">{k}</div>
                  <div className="text-2xl font-black tabular">{v}</div>
                </div>
              ))}
            </Panel>
            <div className="mt-1 text-right text-[11px] text-muted tabular">Total Score {stats.totalScore.toLocaleString("en-US")}</div>
          </div>
          <div>
            <Label className="mb-2">Recommended Training</Label>
            <Panel className="p-4">
              {weak.length === 0 ? (
                <div className="text-sm text-muted">苦手カテゴリはまだありません（各スキル3問以上・正答率90%未満で表示）。</div>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {weak.map((w) => (
                    <li key={w.kind + w.key} className="flex items-center justify-between text-sm">
                      <span className="font-bold tracking-wide">{w.label.toUpperCase()}</span>
                      <span className="tabular text-bad">{formatPercent(w.accuracy)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/train/weakness/" className="mt-3 block">
                <Button variant="outline" className="w-full">
                  <Crosshair className="h-4 w-4" /> WEAKNESS TRAINING
                </Button>
              </Link>
            </Panel>
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <Label className="mb-2">By Category</Label>
          <StatTable rows={TRAINING_MODES.map((m) => [MODE_META[m].title, modes[m]] as const)} />
        </section>
        <section>
          <Label className="mb-2">By Difficulty</Label>
          <StatTable rows={LEVELS.map((l) => [`LEVEL ${l}`, levels[l]] as const)} />
        </section>
      </div>

      <section>
        <Label className="mb-2">Skills</Label>
        <Panel className="divide-y divide-line">
          {skills.length === 0 && <div className="p-4 text-sm text-muted">データなし</div>}
          {skills.map(({ skill, label, summary }) => (
            <div key={skill} className="grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-2 sm:grid-cols-[14rem_1fr_auto]">
              <div className="text-sm font-semibold">{label}</div>
              <div className="order-3 col-span-2 h-1.5 overflow-hidden rounded-full bg-line sm:order-none sm:col-span-1">
                <div className={cn("h-full rounded-full", (summary.accuracy ?? 0) >= 0.9 ? "bg-good" : (summary.accuracy ?? 0) >= 0.75 ? "bg-warn" : "bg-bad")} style={{ width: `${(summary.accuracy ?? 0) * 100}%` }} />
              </div>
              <div className="text-right text-sm tabular">
                {formatPercent(summary.accuracy)} <span className="text-xs text-muted">({summary.total})</span>
              </div>
            </div>
          ))}
        </Panel>
      </section>

      <section>
        <Label className="mb-2">Recent Sessions</Label>
        <Panel className="divide-y divide-line">
          {stats.sessions.length === 0 && <div className="p-4 text-sm text-muted">データなし</div>}
          {[...stats.sessions]
            .reverse()
            .slice(0, 10)
            .map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                <span className="w-36 truncate font-semibold">{MODE_META[s.modeKey as keyof typeof MODE_META]?.title ?? s.modeKey}</span>
                <span className="tabular text-muted">{new Date(s.endedAt).toLocaleDateString()}</span>
                <span className="tabular">
                  {s.correct}/{s.total}
                </span>
                <span className="w-16 text-right tabular">{s.total ? formatSeconds(s.avgTimeMs, 1) : "—"}s</span>
              </div>
            ))}
        </Panel>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="text-xs text-muted">
          Experience: {EXPERIENCE_OPTIONS.find((o) => o.value === stats.profile.experience)?.label ?? "未設定"} · Data is stored in this browser (LocalStorage, schema v{stats.schemaVersion})
        </div>
        {confirm ? (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              CANCEL
            </Button>
            <Button
              size="sm"
              className="border-bad text-bad"
              onClick={() => {
                statsStore.reset();
                setConfirm(false);
              }}
            >
              <Trash2 className="h-4 w-4" /> 本当にリセット
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
            <Trash2 className="h-4 w-4" /> RESET DATA
          </Button>
        )}
      </section>
    </main>
  );
}

function StatTable({ rows }: { rows: readonly (readonly [string, ReturnType<typeof summarize>])[] }) {
  return (
    <Panel className="overflow-hidden">
      <table className="w-full text-sm tabular">
        <thead className="bg-panel-2 text-[10px] tracking-[0.2em] text-muted">
          <tr>
            <th className="px-4 py-2 text-left font-bold"> </th>
            <th className="px-2 py-2 text-right font-bold">ANSWERS</th>
            <th className="px-2 py-2 text-right font-bold">ACC</th>
            <th className="px-4 py-2 text-right font-bold">AVG</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map(([k, s]) => (
            <tr key={k}>
              <td className="px-4 py-2 font-semibold">{k}</td>
              <td className="px-2 py-2 text-right">{s.total}</td>
              <td className="px-2 py-2 text-right">{formatPercent(s.accuracy)}</td>
              <td className="px-4 py-2 text-right">{s.avgTimeMs != null ? `${formatSeconds(s.avgTimeMs, 1)}s` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
