"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Card } from "@/engine/cards";
import { boardCardsInBestFive } from "@/engine/boardSelection";
import { describeHand, handName } from "@/engine/handEvaluator";
import { buildPlaybackFrames } from "@/engine/playback";
import type { WinnerScenario } from "@/engine/scenarioTypes";
import { CardBack, CardRow } from "@/components/PlayingCard";
import { PokerTable } from "@/components/PokerTable";
import { BetBadge } from "@/components/Chips";
import { Label, Panel } from "@/components/ui/panel";
import { cn, formatChips } from "@/lib/utils";
import { ChoiceList } from "./ChoiceList";
import { BoardCards, CardStepPanel, PartsResult, PickedSummary, useBoardCardStep } from "./BoardCardStep";
import { ModeLayout, Question } from "./ModeLayout";
import { PlaybackSeat, ReplayControls, STREET_LABEL, usePlaybackSpeed } from "./Replay";
import { usePlayback } from "./usePlayback";
import type { ModeViewProps } from "./types";

/**
 * The hand is played out on a full table (bets, folds, flop / turn / river). At showdown the
 * remaining players turn their cards up.
 * Step 1: who wins (or SPLIT). Step 2 (optional): push up the board cards that play.
 * The answer timer starts at showdown.
 */
export function WinnerMode({ scenario, answered, onAnswer, verdict, startTimer }: ModeViewProps<WinnerScenario>) {
  const speed = usePlaybackSpeed();
  const frames = useMemo(() => buildPlaybackFrames(scenario.table, scenario.blinds, scenario.actions, { runoutTo: "river" }), [scenario]);
  const { frame, prev, done, skip, replay } = usePlayback(frames, speed);
  useEffect(() => {
    if (!done) return;
    startTimer();
    if (window.matchMedia("(max-width: 639px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [done, startTimer]);

  const [picked, setPicked] = useState<string | null>(null);
  const r = scenario.result;
  const nameOf = (id: string) => scenario.table.find((p) => p.id === id)?.position ?? id;
  const inCardStep = picked !== null && !answered;

  const choices = useMemo(
    () => scenario.choices.map((c, i) => ({ ...c, hotkey: c.key === "SPLIT" ? "0" : String(i + 1) })),
    [scenario],
  );
  const pick = useCallback(
    (key: string) => {
      if (scenario.requireBoardCards) setPicked(key);
      else onAnswer({ mode: "winner", key });
    },
    [scenario.requireBoardCards, onAnswer],
  );
  const step = useBoardCardStep(
    scenario.board,
    inCardStep,
    useCallback((cards: Card[]) => picked && onAnswer({ mode: "winner", key: picked, boardCards: cards }), [picked, onAnswer]),
    useCallback(() => setPicked(null), []),
  );

  // Showdown = the playback reached its last frame (a replay hides the cards again).
  const showdown = done;
  const collecting = frame.phase === "collect" && prev !== null;
  const view = collecting ? prev! : frame;
  const winHand = r.entries.filter((e) => e.rank === 1)[0].hand;
  const trueBoardCards = boardCardsInBestFive(scenario.board, winHand);
  const userKey = answered?.answer.mode === "winner" ? answered.answer.key : null;
  const userCards = answered?.answer.mode === "winner" ? answered.answer.boardCards ?? [] : [];
  const n = scenario.table.length;
  const many = n >= 7;
  const inShowdown = (id: string) => scenario.players.some((p) => p.id === id);

  const table = (
    <PokerTable
      collecting={collecting}
      // Phones at showdown: only the players still in the hand, so hands + board + choices fit one screen.
      hideOnMobile={showdown ? scenario.table.map((t) => !inShowdown(t.id)) : undefined}
      center={
        <>
          <div className="flex items-center gap-2">
            <Label className={cn("text-felt-line", inCardStep && "text-brass")}>{inCardStep ? "TAP TO RAISE" : showdown ? "SHOWDOWN" : STREET_LABEL[view.street]}</Label>
            {view.pot > 0 && !showdown && <span className="rounded-full bg-ink/70 px-2 text-[11px] font-bold tabular text-text/80">POT {formatChips(view.pot)}</span>}
          </div>
          {showdown ? (
            <BoardCards board={scenario.board} raised={answered ? trueBoardCards : step.raised} interactive={inCardStep} onToggle={step.toggle} size="md" />
          ) : (
            <div className="flex min-h-[3.9rem] gap-1 pt-3 sm:min-h-20 sm:gap-1.5">
              <CardRow cards={scenario.board.slice(0, view.boardCount)} size="md" />
            </div>
          )}
        </>
      }
      seats={scenario.table.map((p) => {
        const entry = r.entries.find((e) => e.id === p.id);
        const won = !!answered && entry?.rank === 1;
        const faceUp = showdown && inShowdown(p.id);
        return (
          <PlaybackSeat
            key={p.id}
            id={p.id}
            label={p.position}
            view={view}
            done={done}
            highlight={won || (inCardStep && picked === p.id)}
            cards={
              faceUp ? (
                <CardRow cards={p.hole} size={many ? "xs" : "sm"} highlight={won ? entry!.hand.bestFive : undefined} />
              ) : (
                <div className="flex gap-0.5">
                  <CardBack size="xs" />
                  <CardBack size="xs" />
                </div>
              )
            }
          />
        );
      })}
      bets={scenario.table.map((p) => (!showdown && view.fronts[p.id] > 0 ? <BetBadge amount={view.fronts[p.id]} size={many ? "sm" : "md"} /> : null))}
    />
  );

  const cardsTarget = userKey === "SPLIT" ? r.winners[0] : userKey;
  const cardsTargetHand = cardsTarget ? r.entries.find((e) => e.id === cardsTarget)?.hand : undefined;

  const panel = (
    <>
      {!answered && !showdown && <ReplayControls done={done} skip={skip} replay={replay} />}
      {!showdown ? (
        <Panel className="p-3 sm:p-4">
          <Question sub={`LEVEL ${scenario.level} · ${n}人卓`}>WINNERは？</Question>
          <div className="mt-2 text-sm text-muted">ハンド進行中… ショーダウンで残ったプレイヤーの中から勝者を選びます（計測はショーダウンから）</div>
        </Panel>
      ) : inCardStep ? (
        // Winner already chosen: collapse the list so the board and confirm stay on screen.
        <PickedSummary label="WINNER" value={picked === "SPLIT" ? "SPLIT" : nameOf(picked!)} onBack={step.back} />
      ) : (
        <Panel className="p-3 sm:p-4">
          <Question sub={`LEVEL ${scenario.level} · ${n}人卓 · ショーダウン ${scenario.players.length}人`}>WINNERは？</Question>
          <div className="mt-3">
            <ChoiceList choices={choices} onPick={pick} answeredKey={userKey} correctKey={answered ? scenario.correctKey : null} />
          </div>
        </Panel>
      )}
      {showdown && !answered && !inCardStep && <ReplayControls done={done} skip={skip} replay={replay} />}
      {inCardStep && (
        <CardStepPanel
          title={`${picked === "SPLIT" ? "勝った役" : nameOf(picked!)} の役に使うボードのカードは？`}
          count={step.raised.length}
          canSubmit={step.canSubmit}
          onSubmit={step.submit}
        />
      )}
      {answered && (
        <>
          {verdict}
          <Panel className="animate-rise p-3 sm:p-4">
            {answered.grade.parts && (
              <PartsResult
                rows={[
                  { ok: answered.grade.parts.winner, label: "WINNER", value: userKey === "SPLIT" ? "SPLIT" : nameOf(userKey ?? "") },
                  ...(scenario.requireBoardCards ? [{ ok: !!answered.grade.parts.cards, label: "BOARD CARDS", value: <CardRow cards={userCards} size="xs" /> }] : []),
                ]}
                example={
                  scenario.requireBoardCards && !answered.grade.parts.cards && cardsTarget && cardsTargetHand
                    ? { label: `${nameOf(cardsTarget)} の正解例`, cards: boardCardsInBestFive(scenario.board, cardsTargetHand) }
                    : undefined
                }
              />
            )}
            <Label>{r.isSplit ? "SPLIT POT" : "WINNER"}</Label>
            <div className="text-2xl font-black tracking-[0.08em] text-brass">{r.winners.map(nameOf).join(" / ")}</div>
            <div className="mt-1 text-lg font-bold">{handName(winHand)}</div>
            <div className="text-sm text-text/85">
              {describeHand(winHand)
                .split(", ")
                .map((l) => (
                  <div key={l}>{l}</div>
                ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              <div>
                <Label>Best 5</Label>
                <CardRow cards={winHand.bestFive} size="sm" className="mt-1" />
              </div>
              <div>
                <Label>Board Cards Up</Label>
                <CardRow cards={trueBoardCards} size="sm" className="mt-1" />
              </div>
            </div>
            <div className="mt-3 border-t border-line pt-2">
              <Label className="mb-1">Showdown</Label>
              <ol className="flex flex-col gap-0.5 text-sm">
                {[...r.entries]
                  .sort((a, b) => a.rank - b.rank)
                  .map((e) => (
                    <li key={e.id} className={cn("grid grid-cols-[1.5rem_4.5rem_1fr] gap-1", e.rank === 1 ? "text-brass" : "text-text/75")}>
                      <span className="tabular text-muted">{e.rank}.</span>
                      <span className="font-semibold">{nameOf(e.id)}</span>
                      <span className="text-[13px] leading-snug">{describeHand(e.hand)}</span>
                    </li>
                  ))}
              </ol>
            </div>
          </Panel>
        </>
      )}
    </>
  );
  return <ModeLayout table={table} panel={panel} />;
}
