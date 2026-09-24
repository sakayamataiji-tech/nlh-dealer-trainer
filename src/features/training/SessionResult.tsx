"use client";
import Link from "next/link";
import { RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, Label } from "@/components/ui/panel";
import { formatPercent, formatSeconds } from "@/lib/utils";
import type { SessionSummary } from "@/stats/types";

export function SessionResult({ summary, onRetry }: { summary: SessionSummary; onRetry: () => void }) {
  const acc = summary.total ? summary.correct / summary.total : null;
  const rows: [string, string][] = [
    ["Accuracy", formatPercent(acc)],
    ["Average", summary.total ? `${formatSeconds(summary.avgTimeMs, 1)} sec` : "—"],
    ["Correct", `${summary.correct} / ${summary.total}`],
    ["Best Streak", String(summary.bestStreak)],
    ["Score", summary.score.toLocaleString("en-US")],
    ["Weakest Skill", summary.weakestSkill ?? "—"],
  ];
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 py-6">
      <div className="text-center">
        <Label>Session Result</Label>
        <div className="mt-1 text-5xl font-black tabular text-brass">{formatPercent(acc)}</div>
      </div>
      <Panel className="divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm tracking-wider text-muted">{k}</span>
            <span className="text-lg font-bold tabular">{v}</span>
          </div>
        ))}
      </Panel>
      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" variant="primary" onClick={onRetry} autoFocus>
          <RotateCcw className="h-4 w-4" /> RETRY
        </Button>
        <Link href="/" className="contents">
          <Button size="lg" variant="secondary">
            <Home className="h-4 w-4" /> HOME
          </Button>
        </Link>
      </div>
    </div>
  );
}
