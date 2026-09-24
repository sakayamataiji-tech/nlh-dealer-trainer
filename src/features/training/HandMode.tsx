"use client";
import { useCallback, useMemo } from "react";
import { CATEGORY_LABEL, bestFiveRanks, handName, type HandCategory } from "@/engine/handEvaluator";
import type { HandScenario } from "@/engine/scenarioTypes";
import { CardRow } from "@/components/PlayingCard";
import { PokerTable } from "@/components/PokerTable";
import { Panel, Label } from "@/components/ui/panel";
import { ChoiceList } from "./ChoiceList";
import { ModeLayout, Question } from "./ModeLayout";
import type { ModeViewProps } from "./types";

export function HandMode({ scenario, answered, onAnswer, verdict }: ModeViewProps<HandScenario>) {
  const choices = useMemo(() => scenario.choices.map((c) => ({ key: String(c), label: CATEGORY_LABEL[c] })), [scenario]);
  const pick = useCallback((key: string) => onAnswer({ mode: "hand", category: Number(key) as HandCategory }), [onAnswer]);
  const best = answered ? scenario.hand.bestFive : undefined;
  const userCat = answered?.answer.mode === "hand" ? answered.answer.category : null;

  const table = (
    <PokerTable
      center={
        <>
          <Label className="text-felt-line">BOARD</Label>
          <CardRow cards={scenario.board} size="lg" highlight={best} dimOthers />
        </>
      }
      seats={[
        <div key="p" className="flex flex-col items-center gap-1">
          <CardRow cards={scenario.hole} size="lg" highlight={best} dimOthers />
          <div className="rounded-full bg-ink/80 px-3 py-0.5 text-[11px] font-bold tracking-[0.2em]">PLAYER HAND</div>
        </div>,
      ]}
    />
  );

  const panel = (
    <>
      <Panel className="p-3 sm:p-4">
        <Question sub={`LEVEL ${scenario.level}`}>このプレイヤーのBEST HANDは？</Question>
        <div className="mt-3">
          <ChoiceList choices={choices} onPick={pick} answeredKey={userCat === null ? null : String(userCat)} correctKey={answered ? String(scenario.hand.category) : null} />
        </div>
      </Panel>
      {answered && (
        <>
          {verdict}
          <Panel className="animate-rise p-3 sm:p-4">
            {!answered.grade.correct && userCat !== null && (
              <div className="mb-2 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                <span className="text-muted">Your Answer:</span>
                <span className="font-semibold text-bad">{CATEGORY_LABEL[userCat]}</span>
                <span className="text-muted">Correct:</span>
                <span className="font-semibold text-good">{handName(scenario.hand)}</span>
              </div>
            )}
            <div className="text-2xl font-black tracking-[0.1em] text-brass">{handName(scenario.hand).toUpperCase()}</div>
            <div className="font-mono text-lg tracking-wider">{bestFiveRanks(scenario.hand)}</div>
            <Label className="mt-2">Best 5</Label>
            <CardRow cards={scenario.hand.bestFive} size="sm" className="mt-1" />
          </Panel>
        </>
      )}
    </>
  );
  return <ModeLayout table={table} panel={panel} />;
}
