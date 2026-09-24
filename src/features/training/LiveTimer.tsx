"use client";
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { formatSeconds } from "@/lib/utils";

export function LiveTimer({ startedAt, stoppedMs }: { startedAt: number | null; stoppedMs: number | null }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (stoppedMs !== null || startedAt === null) return;
    const id = setInterval(() => setNow(performance.now()), 50);
    return () => clearInterval(id);
  }, [startedAt, stoppedMs]);
  const ms = stoppedMs ?? (startedAt === null ? 0 : Math.max(0, now - startedAt));
  return (
    <div className="flex items-center gap-1.5 tabular">
      <Timer className="h-4 w-4 text-muted" />
      <span className="w-14 text-right font-mono text-base font-semibold">{formatSeconds(ms, stoppedMs === null ? 1 : 2)}</span>
      <span className="text-xs text-muted">sec</span>
    </div>
  );
}
