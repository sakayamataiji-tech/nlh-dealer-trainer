"use client";
import { useEffect, useRef } from "react";
import { Check, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/panel";
import { cn, formatSeconds } from "@/lib/utils";
import type { AnsweredState } from "./types";

const SPEED_STYLE = { fast: "text-good", normal: "text-text", slow: "text-warn" } as const;

export function Verdict({ answered, onNext, nextLabel }: { answered: AnsweredState; onNext: () => void; nextLabel: string }) {
  const ok = answered.grade.correct;
  const s = answered.score;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight || r.top < 0) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);
  return (
    <div ref={ref} className={cn("animate-rise rounded-xl border p-3", ok ? "border-good/40 bg-good/10" : "border-bad/40 bg-bad/10")}>
      <div className="flex items-center gap-3">
        <div className={cn("animate-pop flex h-11 w-11 shrink-0 items-center justify-center rounded-full", ok ? "bg-good text-ink" : "bg-bad text-ink")}>
          {ok ? <Check className="h-7 w-7" strokeWidth={3} /> : <X className="h-7 w-7" strokeWidth={3} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("text-xl font-black tracking-[0.12em]", ok ? "text-good" : "text-bad")}>{ok ? "CORRECT" : "INCORRECT"}</div>
          <div className="flex items-baseline gap-2 text-sm tabular">
            <span className="font-semibold">{formatSeconds(answered.timeMs)} sec</span>
            <span className={cn("text-xs font-bold tracking-widest", SPEED_STYLE[answered.speed])}>{answered.speed.toUpperCase()}</span>
          </div>
        </div>
        <div className="text-right text-xs tabular leading-tight text-muted">
          {ok ? (
            <>
              <div className="text-lg font-bold text-brass">+{s.total}</div>
              {s.speedBonus > 0 && <div>Speed +{s.speedBonus}</div>}
              {s.streak > 1 && <div>Streak ×{s.streak}</div>}
            </>
          ) : (
            <div className="text-lg font-bold">+0</div>
          )}
        </div>
      </div>
      <Button variant="primary" size="lg" className="mt-3 w-full" onClick={onNext} autoFocus>
        {nextLabel} <ArrowRight className="h-4 w-4" /> <Kbd className="border-ink/30 bg-transparent text-ink/70">Space</Kbd>
      </Button>
    </div>
  );
}
