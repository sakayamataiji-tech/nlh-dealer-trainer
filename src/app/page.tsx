"use client";
import Link from "next/link";
import { BarChart3, Crosshair, Layers, Shuffle, Spade, Trophy, Coins } from "lucide-react";
import { useStats } from "@/lib/statsStore";
import { summarize, todayRecords, weaknesses } from "@/stats/aggregate";
import { Onboarding } from "@/components/home/Onboarding";
import { Label } from "@/components/ui/panel";
import { formatPercent, formatSeconds } from "@/lib/utils";

const MENU = [
  { href: "/train/hand/", title: "HAND READING", ja: "役判定", icon: Spade, mode: "hand" as const },
  { href: "/train/winner/", title: "WINNER", ja: "勝者判定", icon: Trophy, mode: "winner" as const },
  { href: "/train/pot/", title: "POT", ja: "ポット計算", icon: Coins, mode: "pot" as const },
  { href: "/train/side-pot/", title: "SIDE POT", ja: "サイドポット計算", icon: Layers, mode: "sidepot" as const },
];

export default function Home() {
  const stats = useStats();
  const today = stats ? summarize(todayRecords(stats.records)) : null;
  const weak = stats ? weaknesses(stats.records).slice(0, 3) : [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 pb-8 pt-8 sm:px-6 lg:pt-10">
      {stats && stats.profile.experience === null && <Onboarding />}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-[0.16em] sm:text-4xl">
            NLH <span className="text-brass">DEALER</span> TRAINER
          </h1>
          <p className="mt-1 text-sm tracking-[0.3em] text-muted">速く、正確に、判断する。</p>
        </div>
        <Link href="/stats/" className="flex h-11 items-center gap-2 rounded-lg border border-line px-3 text-xs font-bold tracking-widest text-muted hover:border-brass-dim hover:text-text">
          <BarChart3 className="h-4 w-4" /> <span className="hidden sm:inline">STATS</span>
        </Link>
      </header>

      <section>
        <Label className="mb-2">Today</Label>
        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-line bg-panel">
          {[
            ["Accuracy", formatPercent(today?.accuracy ?? null)],
            ["Avg Speed", today?.avgTimeMs != null ? `${formatSeconds(today.avgTimeMs, 1)} sec` : "—"],
            ["Streak", String(stats?.streak.current ?? 0)],
          ].map(([k, v], i) => (
            <div key={k} className={i > 0 ? "border-l border-line px-3 py-3 sm:px-5 sm:py-4" : "px-3 py-3 sm:px-5 sm:py-4"}>
              <div className="text-[10px] font-bold tracking-[0.2em] text-muted sm:text-xs">{k}</div>
              <div className="mt-0.5 text-2xl font-black tabular sm:text-4xl">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-1 text-right text-[11px] text-muted tabular">{today ? `${today.correct} / ${today.total} today` : ""}</div>
      </section>

      <section>
        <Label className="mb-2">Training</Label>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {MENU.map(({ href, title, ja, icon: Icon, mode }) => (
            <Link key={href} href={href} className="group relative flex min-h-32 flex-col justify-between overflow-hidden rounded-xl border border-line bg-panel p-4 transition-colors hover:border-brass-dim sm:min-h-40">
              <div className="felt absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-60 transition-opacity group-hover:opacity-90" />
              <Icon className="relative h-6 w-6 text-brass" />
              <div className="relative">
                <div className="text-base font-black tracking-[0.12em] sm:text-lg">{title}</div>
                <div className="text-xs text-muted">{ja}</div>
                {stats && <div className="mt-1 text-[10px] font-bold tracking-widest text-brass-dim">LV {stats.settings.levels[mode]}</div>}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-[2fr_1fr] sm:gap-3">
        <Link href="/train/quick/" className="flex h-16 items-center justify-center gap-3 rounded-xl bg-brass text-lg font-black tracking-[0.3em] text-ink hover:bg-[#d8b56a] sm:h-20">
          <Shuffle className="h-5 w-5" /> QUICK TRAINING
        </Link>
        <Link href="/train/weakness/" className="flex h-16 flex-col items-center justify-center rounded-xl border border-brass-dim text-brass hover:bg-brass/10 sm:h-20">
          <span className="flex items-center gap-2 text-sm font-black tracking-[0.2em]">
            <Crosshair className="h-4 w-4" /> WEAKNESS
          </span>
          <span className="max-w-full truncate px-2 text-[11px] text-muted">{weak.length ? `Recommended: ${weak.map((w) => w.label).join(" / ")}` : "苦手分析トレーニング"}</span>
        </Link>
      </section>
    </main>
  );
}
