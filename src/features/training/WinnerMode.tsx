"use client";
import { useCallback, useMemo, useState } from "react";
import type { Card } from "@/engine/cards";
import { boardCardsInBestFive } from "@/engine/boardSelection";
import { describeHand, handName } from "@/engine/handEvaluator";
import type { WinnerScenario } from "@/engine/scenarioTypes";
import { CardRow } from "@/components/PlayingCard";
import { PokerTable } from "@/components/PokerTable";
import { Label, Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { ChoiceList } from "./ChoiceList";
import { BoardCards, CardStepPanel, PartsResult, PickedSummary, useBoardCardStep } from "./BoardCardStep";
import { ModeLayout, Question } from "./ModeLayout";
import type { ModeViewProps } from "./types";

/**
 * Step 1: who wins (or SPLIT).
 * Step 2 (optional): push up the board cards that play in the winning hand, like a dealer does.
 */
export function WinnerMode({ scenario, answered, onAnswer, verdict }: ModeViewProps<WinnerScenario>) {
  const [picked, setPicked] = useState<string | null>(null);
  const r = scenario.result;
  const nameOf = (id: string) => scenario.players.find((p) => p.id === id)?.name ?? id;
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

  const winnerEntries = r.entries.filter((e) => e.rank === 1);
  const winHand = winnerEntries[0].hand;
  const trueBoardCards = boardCardsInBestFive(scenario.board, winHand);
  const userKey = answered?.answer.mode === "winner" ? answered.answer.key : null;
  const userCards = answered?.answer.mode === "winner" ? answered.answer.boardCards ?? [] : [];
  const n = scenario.players.length;
  const many = n >= 5;
  const huge = n >= 7;

  const table = (
    <PokerTable
      center={
        <>
          <Label className={cn("text-felt-line", inCardStep && "text-brass")}>{inCardStep ? "TAP TO RAISE" : "BOARD"}</Label>
          <BoardCards board={scenario.board} raised={answered ? trueBoardCards : step.raised} interactive={inCardStep} onToggle={step.toggle} size={many ? "md" : "lg"} />
        </>
      }
      seats={scenario.players.map((p) => {
        const entry = r.entries.find((e) => e.id === p.id)!;
        const won = answered && entry.rank === 1;
        const isPicked = inCardStep && picked === p.id;
        return (
          <div key={p.id} className={cn("flex flex-col items-center gap-1 rounded-xl p-1 transition-colors", won && "bg-brass/20 ring-2 ring-brass", isPicked && "ring-2 ring-brass/70")}>
            <CardRow cards={p.hole} size={many ? "sm" : "md"} highlight={answered && won ? entry.hand.bestFive : undefined} />
            <div className={cn("whitespace-nowrap rounded-full bg-ink/85 px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] sm:text-[11px]", won && "text-brass")}>{huge ? `P${p.id.slice(1)}` : p.name}</div>
            {answered && !huge && <div className="max-w-24 truncate text-center text-[10px] text-text/80 sm:max-w-32 sm:text-[11px]">{handName(entry.hand)}</div>}
          </div>
        );
      })}
    />
  );

  const cardsTarget = userKey === "SPLIT" ? r.winners[0] : userKey;
  const cardsTargetHand = cardsTarget ? r.entries.find((e) => e.id === cardsTarget)?.hand : undefined;

  const panel = (
    <>
      {inCardStep ? (
        // Winner already chosen: collapse the list so the board and confirm stay on screen.
        <PickedSummary label="WINNER" value={picked === "SPLIT" ? "SPLIT" : nameOf(picked!)} onBack={step.back} />
      ) : (
        <Panel className="p-3 sm:p-4">
          <Question sub={`LEVEL ${scenario.level} · ${n} players`}>WINNERは？</Question>
          <div className="mt-3">
            <ChoiceList choices={choices} onPick={pick} answeredKey={userKey} correctKey={answered ? scenario.correctKey : null} />
          </div>
        </Panel>
      )}
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
                    <li key={e.id} className={cn("grid grid-cols-[1.5rem_5.5rem_1fr] gap-1", e.rank === 1 ? "text-brass" : "text-text/75")}>
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
