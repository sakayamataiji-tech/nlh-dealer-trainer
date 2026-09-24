"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Flame, Play, Square } from "lucide-react";
import { gradeAnswer, rateSpeed, scoreAnswer, type UserAnswer } from "@/engine/grading";
import { LEVELS, type Level, type Scenario } from "@/engine/scenarioTypes";
import { longestStreak, weakestSkill } from "@/stats/aggregate";
import { SESSION_LENGTHS, type AnswerRecord, type SessionLength, type SessionSummary } from "@/stats/types";
import { statsStore, useStats } from "@/lib/statsStore";
import { Button } from "@/components/ui/button";
import { Kbd, Label, Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { HandMode } from "./HandMode";
import { WinnerMode } from "./WinnerMode";
import { PotMode } from "./PotMode";
import { SidePotMode } from "./SidePotMode";
import { LiveTimer } from "./LiveTimer";
import { Verdict } from "./Verdict";
import { SessionResult } from "./SessionResult";
import { MODE_META, type SessionModeKey } from "./modeMeta";
import { pickScenario } from "./pickScenario";
import type { AnsweredState } from "./types";

type Phase = "setup" | "play" | "result";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function TrainingSession({ modeKey }: { modeKey: SessionModeKey }) {
  const stats = useStats();
  const meta = MODE_META[modeKey];
  const [phase, setPhase] = useState<Phase>("setup");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [answered, setAnswered] = useState<AnsweredState | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [records, setRecords] = useState<AnswerRecord[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const session = useRef({ id: uid(), startedAt: Date.now(), length: 10 as SessionLength });
  const nextRef = useRef<Scenario | null>(null);

  const length = stats?.settings.sessionLength ?? 10;
  const fixedMode = modeKey !== "quick" && modeKey !== "weakness" ? modeKey : null;
  const level: Level | null = fixedMode && stats ? stats.settings.levels[fixedMode] : null;

  const showScenario = useCallback((s: Scenario) => {
    setScenario(s);
    setAnswered(null);
    setStartedAt(performance.now());
  }, []);

  const start = useCallback(() => {
    session.current = { id: uid(), startedAt: Date.now(), length };
    setRecords([]);
    setSummary(null);
    setPhase("play");
    showScenario(pickScenario(modeKey, statsStore.current));
  }, [length, modeKey, showScenario]);

  const finish = useCallback(
    (rs: AnswerRecord[]) => {
      const s: SessionSummary = {
        id: session.current.id,
        startedAt: session.current.startedAt,
        endedAt: Date.now(),
        modeKey,
        total: rs.length,
        correct: rs.filter((r) => r.correct).length,
        avgTimeMs: rs.length ? rs.reduce((a, r) => a + r.timeMs, 0) / rs.length : 0,
        bestStreak: longestStreak(rs),
        score: rs.reduce((a, r) => a + r.score, 0),
        weakestSkill: weakestSkill(rs),
      };
      if (rs.length > 0) statsStore.recordSession(s);
      setSummary(s);
      setPhase("result");
    },
    [modeKey],
  );

  const onAnswer = useCallback(
    (answer: UserAnswer) => {
      if (!scenario || answered || startedAt === null) return;
      const timeMs = performance.now() - startedAt;
      const grade = gradeAnswer(scenario, answer);
      const speed = rateSpeed(timeMs, scenario.targetSeconds);
      const streak = grade.correct ? statsStore.current.streak.current + 1 : 0;
      const score = scoreAnswer(grade.correct, speed, streak, scenario.level);
      const record: AnswerRecord = {
        id: uid(),
        at: Date.now(),
        mode: scenario.mode,
        level: scenario.level,
        correct: grade.correct,
        timeMs: Math.round(timeMs),
        speed,
        score: score.total,
        skills: scenario.skills,
        sessionId: session.current.id,
      };
      statsStore.recordAnswer(record);
      setRecords((rs) => [...rs, record]);
      setAnswered({ answer, grade, timeMs, speed, score });
      // Pre-generate the next scenario while the user reads the explanation (tempo).
      setTimeout(() => {
        nextRef.current = pickScenario(modeKey, statsStore.current);
      }, 0);
    },
    [scenario, answered, startedAt, modeKey],
  );

  const isLast = session.current.length !== "endless" && records.length >= session.current.length;

  const next = useCallback(() => {
    if (!answered) return;
    if (isLast) return finish(records);
    const s = nextRef.current ?? pickScenario(modeKey, statsStore.current);
    nextRef.current = null;
    showScenario(s);
  }, [answered, isLast, finish, records, modeKey, showScenario]);

  // Space = next (and start on the setup screen).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "BUTTON") e.preventDefault(); // avoid a second, native click on the focused button
      if (e.repeat) return;
      if (phase === "play" && answered) {
        e.preventDefault();
        next();
      } else if (phase === "setup" && tag !== "INPUT") {
        e.preventDefault();
        start();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === " ") && (e.target as HTMLElement)?.tagName === "BUTTON") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [phase, answered, next, start]);

  if (!stats) return <div className="flex-1" />;

  const correctCount = records.filter((r) => r.correct).length;
  const sessionScore = records.reduce((a, r) => a + r.score, 0);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1400px] flex-col gap-3 px-3 pb-4 pt-2 sm:px-4 lg:px-6">
      <header className="flex h-12 items-center gap-2 border-b border-line">
        <Link href="/" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:text-text" aria-label="Home">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black tracking-[0.18em]">{meta.title}</div>
          <div className="truncate text-[11px] text-muted">{meta.ja}</div>
        </div>
        {phase === "play" && (
          <>
            <div className="hidden text-right text-xs tabular sm:block">
              <div className="text-muted">Q</div>
              <div className="font-bold">
                {records.length + (answered ? 0 : 1)}
                {session.current.length !== "endless" && <span className="text-muted">/{session.current.length}</span>}
              </div>
            </div>
            <div className="text-right text-xs tabular">
              <div className="text-muted">Score</div>
              <div className="font-bold text-brass">{sessionScore.toLocaleString("en-US")}</div>
            </div>
            <div className="flex items-center gap-1 rounded-md bg-panel px-2 py-1 text-sm font-bold tabular">
              <Flame className={cn("h-4 w-4", stats.streak.current > 0 ? "text-warn" : "text-muted")} />
              {stats.streak.current}
            </div>
            <div className="rounded-md bg-panel px-2 py-1">
              <LiveTimer startedAt={startedAt} stoppedMs={answered ? answered.timeMs : null} />
            </div>
            {session.current.length === "endless" && (
              <Button size="sm" variant="ghost" onClick={() => finish(records)} aria-label="End session">
                <Square className="h-4 w-4" /> END
              </Button>
            )}
          </>
        )}
      </header>

      {phase === "setup" && (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-5 py-6">
          <div className="text-center">
            <div className="text-3xl font-black tracking-[0.14em]">{meta.title}</div>
            <div className="mt-1 text-sm text-muted">{meta.ja}</div>
          </div>
          {fixedMode && level && (
            <Panel className="p-4">
              <Label>Difficulty</Label>
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => statsStore.setLevel(fixedMode, l)}
                    className={cn("h-12 rounded-lg border text-sm font-bold tabular", l === level ? "border-brass bg-brass/15 text-brass" : "border-line bg-panel-2 text-muted hover:text-text")}
                  >
                    LV {l}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted">{LEVEL_HINT[fixedMode][level - 1]}</div>
            </Panel>
          )}
          {!fixedMode && (
            <Panel className="p-4 text-sm text-muted">
              {modeKey === "weakness"
                ? stats.records.length === 0
                  ? "まだ成績データがありません。データが貯まるまでは4カテゴリからランダムに出題します。"
                  : "過去の成績から正答率の低いスキルを優先して出題します。"
                : "4カテゴリからランダムに出題します。"}
              <div className="mt-1 text-xs">
                難易度: 各カテゴリの設定 (HAND LV{stats.settings.levels.hand} / WINNER LV{stats.settings.levels.winner} / POT LV{stats.settings.levels.pot} / SIDE POT LV{stats.settings.levels.sidepot})
              </div>
            </Panel>
          )}
          <Panel className="p-4">
            <Label>Session</Label>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {SESSION_LENGTHS.map((l) => (
                <button
                  key={String(l)}
                  type="button"
                  onClick={() => statsStore.setSessionLength(l)}
                  className={cn("h-12 rounded-lg border text-sm font-bold", l === length ? "border-brass bg-brass/15 text-brass" : "border-line bg-panel-2 text-muted hover:text-text")}
                >
                  {l === "endless" ? "ENDLESS" : `${l}問`}
                </button>
              ))}
            </div>
          </Panel>
          <Button variant="primary" size="lg" className="h-16 text-lg tracking-[0.3em]" onClick={start} autoFocus>
            <Play className="h-5 w-5" /> START <Kbd className="border-ink/30 bg-transparent text-ink/70">Space</Kbd>
          </Button>
          <div className="hidden text-center text-xs text-muted md:block">
            1〜9: 選択肢で回答 · Enter: 数字入力の決定 · Space: 次の問題
          </div>
        </div>
      )}

      {phase === "play" && scenario && (
        <>
          {renderMode(
            scenario,
            answered,
            onAnswer,
            answered ? <Verdict answered={answered} onNext={next} nextLabel={isLast ? "RESULT" : "NEXT"} /> : null,
          )}
          <div className="text-center text-xs text-muted tabular">
            {correctCount} / {records.length} correct
          </div>
        </>
      )}

      {phase === "result" && summary && <SessionResult summary={summary} onRetry={start} />}
    </div>
  );
}

function renderMode(s: Scenario, answered: AnsweredState | null, onAnswer: (a: UserAnswer) => void, verdict: React.ReactNode) {
  switch (s.mode) {
    case "hand":
      return <HandMode key={s.id} scenario={s} answered={answered} onAnswer={onAnswer} verdict={verdict} />;
    case "winner":
      return <WinnerMode key={s.id} scenario={s} answered={answered} onAnswer={onAnswer} verdict={verdict} />;
    case "pot":
      return <PotMode key={s.id} scenario={s} answered={answered} onAnswer={onAnswer} verdict={verdict} />;
    case "sidepot":
      return <SidePotMode key={s.id} scenario={s} answered={answered} onAnswer={onAnswer} verdict={verdict} />;
  }
}

const LEVEL_HINT: Record<"hand" | "winner" | "pot" | "sidepot", string[]> = {
  hand: ["明確な役 (Pair / Straight / Flush)", "Two Pair / Trips / Full House / Quads", "全カテゴリ + キッカー判断", "Board Play (ボードが役)", "紛らわしい状況 (Four Flush / Double Paired / Wheel 等)"],
  winner: ["Heads Up", "3 players", "4 players · キッカー勝負多め", "5 players · Board Play 多め", "6 players · Counterfeit / FH比較 等"],
  pot: ["Preflopのみ · 2〜4人", "Flopまで · 3〜5人", "Turnまで · 3〜6人", "Riverまで · 4〜8人", "Riverまで · 5〜9人 · All-inあり"],
  sidepot: ["3人 · All-in", "3〜4人 · Foldあり", "4人 · Side Pot 2つ以上", "5人 · Postflopあり", "6人 · Fold / 返却あり"],
};
