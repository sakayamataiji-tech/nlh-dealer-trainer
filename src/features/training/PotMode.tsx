"use client";
import { useEffect, useMemo, useState } from "react";
import type { PotScenario } from "@/engine/scenarioTypes";
import { buildPlaybackFrames } from "@/engine/playback";
import { PokerTable } from "@/components/PokerTable";
import { BetBadge } from "@/components/Chips";
import { CardBack } from "@/components/PlayingCard";
import { NumberInput } from "@/components/NumberInput";
import { Panel, Label } from "@/components/ui/panel";
import { cn, formatChips } from "@/lib/utils";
import { ActionLog } from "./ActionLog";
import { ModeLayout, Question } from "./ModeLayout";
import { usePlayback } from "./usePlayback";
import { PlaybackSeat, ReplayControls, STREET_LABEL, usePlaybackSpeed } from "./Replay";
import type { ModeViewProps } from "./types";


/**
 * The hand is replayed on the table: each player pushes chips in front of them, bets are
 * collected into the pot at the end of every street. No amounts are shown as text — the
 * dealer counts the chips. The answer timer starts when the playback ends.
 */
export function PotMode({ scenario, answered, onAnswer, verdict, startTimer }: ModeViewProps<PotScenario>) {
  const speed = usePlaybackSpeed();
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
      seats={scenario.players.map((p) => (
        <PlaybackSeat
          key={p.id}
          id={p.id}
          label={p.position}
          view={view}
          done={done}
          cards={
            <div className="flex gap-0.5">
              <CardBack size="xs" />
              <CardBack size="xs" />
            </div>
          }
        />
      ))}
      bets={scenario.players.map((p) => (view.fronts[p.id] > 0 ? <BetBadge amount={view.fronts[p.id]} size={many ? "sm" : "md"} /> : null))}
    />
  );

  const panel = (
    <>
      <ReplayControls done={done} skip={skip} replay={replay} />
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
