"use client";
import { useCallback } from "react";
import { describeHand, handName } from "@/engine/handEvaluator";
import type { WinnerScenario } from "@/engine/scenarioTypes";
import { CardRow } from "@/components/PlayingCard";
import { PokerTable } from "@/components/PokerTable";
import { Panel, Label } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { ChoiceList } from "./ChoiceList";
import { ModeLayout, Question } from "./ModeLayout";
import type { ModeViewProps } from "./types";

export function WinnerMode({ scenario, answered, onAnswer, verdict }: ModeViewProps<WinnerScenario>) {
  const pick = useCallback((key: string) => onAnswer({ mode: "winner", key }), [onAnswer]);
  const r = scenario.result;
  const winnerEntries = r.entries.filter((e) => e.rank === 1);
  const winHand = winnerEntries[0].hand;
  const bestCards = answered ? [...new Set(winnerEntries.flatMap((e) => e.hand.bestFive))] : undefined;
  const userKey = answered?.answer.mode === "winner" ? answered.answer.key : null;
  const nameOf = (id: string) => scenario.players.find((p) => p.id === id)?.name ?? id;
  const many = scenario.players.length >= 5;

  const table = (
    <PokerTable
      center={
        <>
          <Label className="text-felt-line">BOARD</Label>
          <CardRow cards={scenario.board} size={many ? "md" : "lg"} highlight={answered ? winHand.bestFive : undefined} />
        </>
      }
      seats={scenario.players.map((p) => {
        const entry = r.entries.find((e) => e.id === p.id)!;
        const won = answered && entry.rank === 1;
        return (
          <div key={p.id} className={cn("flex flex-col items-center gap-1 rounded-xl p-1 transition-colors", won && "bg-brass/20 ring-2 ring-brass")}>
            <CardRow cards={p.hole} size={many ? "sm" : "md"} highlight={answered && won ? entry.hand.bestFive : undefined} />
            <div className={cn("whitespace-nowrap rounded-full bg-ink/85 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.15em] sm:text-[11px]", won && "text-brass")}>{p.name}</div>
            {answered && <div className="max-w-28 truncate text-center text-[10px] text-text/80 sm:max-w-36 sm:text-[11px]">{handName(entry.hand)}</div>}
          </div>
        );
      })}
    />
  );

  const panel = (
    <>
      <Panel className="p-3 sm:p-4">
        <Question sub={`LEVEL ${scenario.level} · ${scenario.players.length} players`}>WINNERは？</Question>
        <div className="mt-3">
          <ChoiceList choices={scenario.choices} onPick={pick} answeredKey={userKey} correctKey={answered ? scenario.correctKey : null} columns={2} />
        </div>
      </Panel>
      {answered && (
        <>
          {verdict}
          <Panel className="animate-rise p-3 sm:p-4">
            {!answered.grade.correct && userKey && (
              <div className="mb-2 text-sm">
                <span className="text-muted">Your Answer: </span>
                <span className="font-semibold text-bad">{userKey === "SPLIT" ? "SPLIT" : nameOf(userKey)}</span>
              </div>
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
            <Label className="mt-2">Best 5</Label>
            <CardRow cards={winHand.bestFive} size="sm" className="mt-1" />
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
