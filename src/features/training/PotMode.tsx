"use client";
import { useEffect, useMemo, useState } from "react";
import { FastForward, RotateCcw } from "lucide-react";
import type { PotScenario } from "@/engine/scenarioTypes";
import { buildPlaybackFrames } from "@/engine/playback";
import { PokerTable } from "@/components/PokerTable";
import { BetBadge } from "@/components/Chips";
import { CardBack } from "@/components/PlayingCard";
import { NumberInput } from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Panel, Label } from "@/components/ui/panel";
import { statsStore, useStats } from "@/lib/statsStore";
import { cn, formatChips } from "@/lib/utils";
import { ActionLog } from "./ActionLog";
import { ModeLayout, Question } from "./ModeLayout";
import { usePlayback } from "./usePlayback";
import type { ModeViewProps } from "./types";

const STREET_LABEL = { preflop: "PREFLOP", flop: "FLOP", turn: "TURN", river: "RIVER" } as const;
const ACTION_WORD: Partial<Record<string, string>> = { fold: "FOLD", check: "CHECK", call: "CALL", bet: "BET", raise: "RAISE", allin: "ALL-IN" };

/**
 * The hand is replayed on the table: each player pushes chips in front of them, bets are
 * collected into the pot at the end of every street. No amounts are shown as text — the
 * dealer counts the chips. The answer timer starts when the playback ends.
 */
export function PotMode({ scenario, answered, onAnswer, verdict, startTimer }: ModeViewProps<PotScenario>) {
  const stats = useStats();
  const speed = stats?.settings.playbackSpeed ?? 1;
  const frames = useMemo(() => buildPlaybackFrames(scenario.players, scenario.blinds, scenario.actions), [scenario]);
  const { frame, prev, done, skip, replay } = usePlayback(frames, speed);
  const [value, setValue] = useState("");
  const [showLog, setShowLog] = useState(false);
  const r = scenario.result;

  useEffect(() => {
    if (done) startTimer();
  }, [done, startTimer]);

  // While collecting, show the previous frame's bets sliding into the pot.
  const collecting = frame.phase === "collect" && prev !== null;
  const view = collecting ? prev! : frame;
  const nameOf = (id: string) => scenario.players.find((p) => p.id === id)?.position ?? id;
  const submit = () => value && done && onAnswer({ mode: "pot", amount: Number(value) });
  const user = answered?.answer.mode === "pot" ? answered.answer.amount : null;
  const many = scenario.players.length >= 7;


  const table = (
    <PokerTable
      compact
      collecting={collecting}
      center={
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <Label className="text-felt-line">{STREET_LABEL[view.street]}</Label>
            {view.boardCount > 0 && (
              <div className="flex gap-0.5">
                {Array.from({ length: view.boardCount }, (_, i) => (
                  <CardBack key={i} size="xs" />
                ))}
              </div>
            )}
          </div>
          {/* The collected pot stays hidden: tracking it through the streets is the exercise. */}
          {view.pot > 0 && !answered && (
            <div className="flex items-center gap-1.5 rounded-full border border-brass-dim/60 bg-ink/80 px-3 py-0.5 text-sm font-bold">
              <span className="text-[10px] tracking-[0.2em] text-muted">POT</span>
              <span className="text-brass">?</span>
            </div>
          )}
          {answered && <div className="rounded bg-black/40 px-2 text-sm font-bold tabular text-brass">POT {formatChips(scenario.answer)}</div>}
        </div>
      }
      seats={scenario.players.map((p) => {
        const folded = view.folded.includes(p.id);
        const allIn = view.allIn.includes(p.id);
        const acting = view.actor === p.id && !done;
        const word = acting && view.actionType ? ACTION_WORD[view.actionType] : view.returnedTo === p.id ? "RETURN" : null;
        return (
          <div
            key={p.id}
            className={cn(
              "relative flex min-w-14 flex-col items-center gap-0.5 rounded-lg border border-line bg-ink/90 px-2 py-1 transition-opacity",
              folded && "opacity-40",
              acting && "border-brass ring-2 ring-brass/60",
            )}
          >
            <div className="whitespace-nowrap text-[11px] font-bold tracking-wider">{p.position}</div>
            {!folded && (
              <div className="flex gap-0.5">
                <CardBack size="xs" />
                <CardBack size="xs" />
              </div>
            )}
            {allIn && <div className="text-[9px] font-black tracking-[0.2em] text-bad">ALL-IN</div>}
            {word && (
              <div className={cn("animate-pop absolute -top-3 rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest", word === "FOLD" ? "bg-line text-muted" : word === "ALL-IN" ? "bg-bad text-ink" : "bg-brass text-ink")}>
                {word}
              </div>
            )}
          </div>
        );
      })}
      bets={scenario.players.map((p) => (view.fronts[p.id] > 0 ? <BetBadge amount={view.fronts[p.id]} size={many ? "sm" : "md"} /> : null))}
    />
  );

  const panel = (
    <>
      <Panel className="p-3 sm:p-4">
        <div className="flex items-center gap-2">
          {!done ? (
            <Button size="sm" variant="secondary" onClick={skip}>
              <FastForward className="h-4 w-4" /> SKIP
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={replay}>
              <RotateCcw className="h-4 w-4" /> REPLAY
            </Button>
          )}
          <div className="ml-auto flex overflow-hidden rounded-lg border border-line">
            {([1, 2, 3] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => statsStore.setPlaybackSpeed(s)}
                className={cn("h-9 w-11 text-xs font-bold", s === speed ? "bg-brass/15 text-brass" : "text-muted hover:text-text")}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </Panel>
      <Panel className="p-3 sm:p-4">
        <Question sub={done ? `LEVEL ${scenario.level} · ${STREET_LABEL[scenario.askStreet]} 終了時点（集めたポット＋各自の前のベット）` : "アクション再生中… 終わったら計測開始"}>
          POTはいくら？
        </Question>
        {!answered && (
          <div className={cn("mt-2", !done && "pointer-events-none opacity-40")}>
            <NumberInput label="POT" value={value} onChange={setValue} onSubmit={submit} disabled={!done} />
          </div>
        )}
      </Panel>
      {answered && (
        <>
          {verdict}
          <Panel className="animate-rise p-3 sm:p-4">
            <div className="flex items-baseline justify-between">
              <Label>Correct</Label>
              {!answered.grade.correct && user !== null && (
                <span className="text-sm">
                  <span className="text-muted">Your Answer </span>
                  <span className="font-semibold text-bad tabular">{formatChips(user)}</span>
                </span>
              )}
            </div>
            <div className="text-3xl font-black tabular text-brass">{formatChips(scenario.answer)}</div>
            <table className="mt-2 w-full text-sm tabular">
              <tbody>
                {r.breakdown.map((b) => (
                  <tr key={b.playerId} className={cn(b.folded && "text-muted")}>
                    <td className="py-0.5 font-semibold">{nameOf(b.playerId)}</td>
                    <td className="text-right">{formatChips(b.inPot)}</td>
                    <td className="w-28 pl-2 text-right text-xs text-muted">
                      {b.returned > 0 ? `(${formatChips(b.contributed)} − ${formatChips(b.returned)} 返却)` : b.folded ? "fold" : b.allIn ? "all-in" : ""}
                    </td>
                  </tr>
                ))}
                {r.anteTotal > 0 && (
                  <tr className="text-xs text-muted">
                    <td className="pt-1" colSpan={3}>
                      うちアンティ {formatChips(r.anteTotal)}（{scenario.blinds.anteType === "bb" ? "BBアンティ" : `${formatChips(scenario.blinds.ante)} × ${scenario.players.length}人`}）
                    </td>
                  </tr>
                )}
                <tr className="border-t border-line font-bold">
                  <td className="pt-1">TOTAL</td>
                  <td className="pt-1 text-right text-brass">{formatChips(scenario.answer)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              {(Object.keys(r.potByStreet) as (keyof typeof STREET_LABEL)[]).map((s) => (
                <span key={s}>
                  {STREET_LABEL[s]} <span className="font-semibold text-text tabular">{formatChips(r.potByStreet[s]!)}</span>
                </span>
              ))}
            </div>
            <button type="button" className="mt-2 text-xs text-muted underline-offset-2 hover:underline" onClick={() => setShowLog((v) => !v)}>
              {showLog ? "ACTION LOG を隠す" : "ACTION LOG（金額つき）を表示"}
            </button>
            {showLog && (
              <div className="mt-1">
                <ActionLog actions={scenario.actions} nameOf={nameOf} dense />
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
  return <ModeLayout table={table} panel={panel} />;
}
