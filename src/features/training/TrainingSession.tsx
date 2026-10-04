"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Flame, Play, Square } from "lucide-react";
import { gradeAnswer, rateSpeed, scoreAnswer, type UserAnswer } from "@/engine/grading";
import { LEVELS, type ActiveMode, type Level, type Scenario } from "@/engine/scenarioTypes";
import { longestStreak, weakestSkill } from "@/stats/aggregate";
import { ANTE_OPTIONS, SESSION_LENGTHS, type AnswerRecord, type PlayerSettingMode, type SessionLength, type SessionSummary } from "@/stats/types";
import { SIDEPOT_LEVELS, WINNER_PLAYERS, WINNER_SHOWDOWN } from "@/engine/scenarioGenerator";
import { statsStore, useStats } from "@/lib/statsStore";
import { CHIP_UNITS, RAKE_ROUNDINGS } from "@/engine/rake";
import { Button } from "@/components/ui/button";
import { Kbd, Label, Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { HandMode } from "./HandMode";
import { WinnerMode } from "./WinnerMode";
import { PotMode } from "./PotMode";
import { SidePotMode } from "./SidePotMode";
import { RakeMode } from "./RakeMode";
import { LiveTimer } from "./LiveTimer";
import { Verdict } from "./Verdict";
import { SessionResult } from "./SessionResult";
import { MODE_META, type SessionModeKey } from "./modeMeta";
import { useI18n, type Messages } from "@/i18n";
import { pickScenario } from "./pickScenario";
import type { AnsweredState } from "./types";

type Phase = "setup" | "play" | "result";

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function TrainingSession({ modeKey }: { modeKey: SessionModeKey }) {
  const stats = useStats();
  const { t } = useI18n();
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
    // Phones: a new question must start with the table in view, not at the previous explanation.
    window.scrollTo({ top: 0 });
    setScenario(s);
    setAnswered(null);
    // POT / WINNER: the timer starts when the hand playback has finished.
    setStartedAt(s.mode === "pot" || s.mode === "winner" ? null : performance.now());
  }, []);
  const startTimer = useCallback(() => setStartedAt((t) => t ?? performance.now()), []);

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
        parts: grade.parts,
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
          <div className="truncate text-[11px] text-muted">{t.modeSub[modeKey]}</div>
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
            <div className="hidden text-right text-xs tabular sm:block">
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
            <div className="mt-1 text-sm text-muted">{t.modeSub[modeKey]}</div>
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
              <div className="mt-2 text-xs text-muted">{levelHints(t)[fixedMode][level - 1]}</div>
            </Panel>
          )}
          {!fixedMode && (
            <Panel className="p-4 text-sm text-muted">
              {modeKey === "weakness"
                ? stats.records.length === 0
                  ? t.weaknessNoData
                  : t.weaknessInfo
                : t.quickInfo}
              <div className="mt-1 text-xs">
                {t.levelsInfo(
                  `HAND LV${stats.settings.levels.hand} / WINNER LV${stats.settings.levels.winner} / SIDE POT LV${stats.settings.levels.sidepot} / RAKE LV${stats.settings.levels.rake}`,
                )}
              </div>
            </Panel>
          )}
          <SettingsPanel modeKey={modeKey} />
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
                  {l === "endless" ? "ENDLESS" : t.sessionLen(l)}
                </button>
              ))}
            </div>
          </Panel>
          <Button variant="primary" size="lg" className="h-16 text-lg tracking-[0.3em]" onClick={start} autoFocus>
            <Play className="h-5 w-5" /> START <Kbd className="border-ink/30 bg-transparent text-ink/70">Space</Kbd>
          </Button>
          <div className="hidden text-center text-xs text-muted md:block">
            {t.keyHelp}
          </div>
        </div>
      )}

      {phase === "play" && scenario && (
        <>
          {renderMode(
            scenario,
            answered,
            onAnswer,
            startTimer,
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

function renderMode(s: Scenario, answered: AnsweredState | null, onAnswer: (a: UserAnswer) => void, startTimer: () => void, verdict: React.ReactNode) {
  const common = { answered, onAnswer, startTimer, verdict };
  switch (s.mode) {
    case "hand":
      return <HandMode key={s.id} scenario={s} {...common} />;
    case "winner":
      return <WinnerMode key={s.id} scenario={s} {...common} />;
    case "pot":
      return <PotMode key={s.id} scenario={s} {...common} />;
    case "sidepot":
      return <SidePotMode key={s.id} scenario={s} {...common} />;
    case "rake":
      return <RakeMode key={s.id} scenario={s} {...common} />;
  }
}

/** Per-level description shown under the difficulty picker (derived from the generator settings). */
function levelHints(t: Messages): Record<ActiveMode, string[]> {
  const range = ([a, b]: readonly [number, number]) => t.people(a, b);
  const lv = [1, 2, 3, 4, 5] as const;
  return {
    hand: t.handHints,
    winner: lv.map((l, i) => t.winnerHint(range(WINNER_PLAYERS[l]), range(WINNER_SHOWDOWN[l])) + t.winnerExtras[i]),
    sidepot: lv.map((l, i) => `${range(SIDEPOT_LEVELS[l].players)}${t.sidepotExtras[i]}`),
    rake: t.rakeHints,
  };
}

const PLAYER_RANGE: Record<PlayerSettingMode, [number, number]> = { winner: [2, 9], pot: [2, 9], sidepot: [3, 9] };

function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("h-11 rounded-lg border text-sm font-bold tabular", active ? "border-brass bg-brass/15 text-brass" : "border-line bg-panel-2 text-muted hover:text-text", className)}
    >
      {children}
    </button>
  );
}

/** Player count / ante / board-card step, shown where they apply. */
function SettingsPanel({ modeKey }: { modeKey: SessionModeKey }) {
  const stats = useStats();
  const { t } = useI18n();
  if (!stats) return null;
  const s = stats.settings;
  const mixed = modeKey === "quick" || modeKey === "weakness";
  const playerMode: PlayerSettingMode | null = modeKey === "winner" || modeKey === "sidepot" ? modeKey : null;
  const showAnte = mixed || modeKey === "sidepot";
  const showCards = mixed || modeKey === "winner" || modeKey === "hand";
  const showCash = mixed || modeKey === "rake";
  const cash = s.cash;
  const unit = cash.unit;
  if (!playerMode && !showAnte && !showCards && !showCash) return null;
  return (
    <Panel className="flex flex-col gap-4 p-4">
      {playerMode && (
        <div>
          <Label>{t.playersLabel}</Label>
          <div className="mt-2 grid grid-cols-5 gap-1.5 sm:grid-cols-9">
            <Chip active={s.players[playerMode] === "auto"} onClick={() => statsStore.setPlayers(playerMode, "auto")} className="col-span-2 sm:col-span-1">
              AUTO
            </Chip>
            {Array.from({ length: PLAYER_RANGE[playerMode][1] - PLAYER_RANGE[playerMode][0] + 1 }, (_, i) => PLAYER_RANGE[playerMode][0] + i).map((n) => (
              <Chip key={n} active={s.players[playerMode] === n} onClick={() => statsStore.setPlayers(playerMode, n)}>
                {n}
              </Chip>
            ))}
          </div>
          <div className="mt-1 text-xs text-muted">{t.autoNote}</div>
        </div>
      )}
      {showAnte && (
        <div>
          <Label>
            {t.anteLabel}
            {mixed && " · SIDE POT"}
          </Label>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {ANTE_OPTIONS.map((o) => (
              <Chip key={o} active={s.ante === o} onClick={() => statsStore.setAnte(o)}>
                {t.anteOptions[o]}
              </Chip>
            ))}
          </div>
          <div className="mt-1 text-xs text-muted">{t.anteNote}</div>
        </div>
      )}
      {showCash && (
        <div>
          <Label>
            {t.cashLabel}
            {mixed && " · RAKE"}
          </Label>
          <div className="mt-1 text-xs text-muted">{t.cashNote}</div>
          <div className="mt-2 flex flex-col gap-3 rounded-lg border border-line p-3">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="SB" value={cash.sb} step={1} onCommit={(v) => statsStore.setCash({ sb: v })} />
              <NumberField label="BB" value={cash.bb} step={1} onCommit={(v) => statsStore.setCash({ bb: v })} />
            </div>
            {cash.sb > cash.bb && <div className="-mt-2 text-xs text-warn">{t.sbOverBb}</div>}
            <div className="grid grid-cols-2 gap-2">
              <NumberField label={t.rakePercent} value={cash.rake.percent} step={0.5} onCommit={(v) => statsStore.setCash({ rake: { ...cash.rake, percent: v } })} />
              <NumberField label={t.rakeCap} value={cash.rake.cap} step={unit} onCommit={(v) => statsStore.setCash({ rake: { ...cash.rake, cap: v } })} />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-muted">{t.roundingLabel}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {RAKE_ROUNDINGS.map((r) => (
                  <Chip key={r} active={cash.rake.rounding === r} onClick={() => statsStore.setCash({ rake: { ...cash.rake, rounding: r } })}>
                    {t.roundingOptions[r]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-muted">{t.chipUnitLabel}</div>
              <div className="grid grid-cols-4 gap-1.5">
                {CHIP_UNITS.map((u) => (
                  <Chip key={u} active={unit === u} onClick={() => statsStore.setCash({ unit: u })}>
                    {u}
                  </Chip>
                ))}
              </div>
              <div className="mt-1 text-xs text-muted">{t.chipUnitNote(unit)}</div>
            </div>
            <ToggleRow label={t.noFlopNoDrop} on={cash.rake.noFlopNoDrop} onChange={(on) => statsStore.setCash({ rake: { ...cash.rake, noFlopNoDrop: on } })} />
            <ToggleRow label={t.jackpotLabel} on={cash.rake.jackpot.enabled} onChange={(on) => statsStore.setCash({ rake: { ...cash.rake, jackpot: { ...cash.rake.jackpot, enabled: on } } })} />
            {cash.rake.jackpot.enabled && (
              <NumberField
                label={t.jackpotAmount}
                value={cash.rake.jackpot.amount}
                step={unit}
                onCommit={(v) => statsStore.setCash({ rake: { ...cash.rake, jackpot: { ...cash.rake.jackpot, amount: v } } })}
              />
            )}
          </div>
        </div>
      )}
      {showCards && (
        <div>
          <Label>
            {t.boardCardsLabel}
            {mixed && " · HAND / WINNER"}
          </Label>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Chip active={s.selectBoardCards} onClick={() => statsStore.setSelectBoardCards(true)}>
              {t.on}
            </Chip>
            <Chip active={!s.selectBoardCards} onClick={() => statsStore.setSelectBoardCards(false)}>
              {t.off}
            </Chip>
          </div>
          <div className="mt-1 text-xs text-muted">{t.boardCardsNote}</div>
        </div>
      )}
    </Panel>
  );
}

/** Number setting that commits on blur / Enter (values are normalised by the store). */
function NumberField({ label, value, step, onCommit }: { label: string; value: number; step: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = Number(text);
    if (Number.isFinite(v)) onCommit(v);
    else setText(String(value));
  };
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          e.stopPropagation();
        }}
        className="h-11 rounded-lg border border-line bg-ink px-3 text-right text-base font-semibold tabular outline-none focus:border-brass"
      />
    </label>
  );
}

function ToggleRow({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center justify-between gap-3 text-left text-sm" aria-pressed={on}>
      <span>{label}</span>
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-brass" : "bg-line")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-all", on ? "left-[1.375rem]" : "left-0.5")} />
      </span>
    </button>
  );
}
