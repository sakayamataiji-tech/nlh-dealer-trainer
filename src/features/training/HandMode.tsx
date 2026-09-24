"use client";
import { useCallback, useMemo, useState } from "react";
import type { Card } from "@/engine/cards";
import { boardCardsInBestFive } from "@/engine/boardSelection";
import { CATEGORY_LABEL, bestFiveRanks, handName, type HandCategory } from "@/engine/handEvaluator";
import type { HandScenario } from "@/engine/scenarioTypes";
import { CardRow } from "@/components/PlayingCard";
import { PokerTable } from "@/components/PokerTable";
import { Panel, Label } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { ChoiceList } from "./ChoiceList";
import { BoardCards, CardStepPanel, PartsResult, PickedSummary, useBoardCardStep } from "./BoardCardStep";
import { ModeLayout, Question } from "./ModeLayout";
import type { ModeViewProps } from "./types";

/**
 * Step 1: name the best hand.
 * Step 2 (optional): push up the board cards that play in it, like a dealer does at showdown.
 */
export function HandMode({ scenario, answered, onAnswer, verdict }: ModeViewProps<HandScenario>) {
  const [picked, setPicked] = useState<HandCategory | null>(null);
  const inCardStep = picked !== null && !answered;
  const choices = useMemo(() => scenario.choices.map((c) => ({ key: String(c), label: CATEGORY_LABEL[c] })), [scenario]);
  const pick = useCallback(
    (key: string) => {
      const category = Number(key) as HandCategory;
      if (scenario.requireBoardCards) setPicked(category);
      else onAnswer({ mode: "hand", category });
    },
    [scenario.requireBoardCards, onAnswer],
  );
  const step = useBoardCardStep(
    scenario.board,
    inCardStep,
    useCallback((cards: Card[]) => picked !== null && onAnswer({ mode: "hand", category: picked, boardCards: cards }), [picked, onAnswer]),
    useCallback(() => setPicked(null), []),
  );

  const best = answered ? scenario.hand.bestFive : undefined;
  const trueBoardCards = boardCardsInBestFive(scenario.board, scenario.hand);
  const userCat = answered?.answer.mode === "hand" ? answered.answer.category : null;
  const userCards = answered?.answer.mode === "hand" ? answered.answer.boardCards ?? [] : [];

  const table = (
    <PokerTable
      center={
        <>
          <Label className={cn("text-felt-line", inCardStep && "text-brass")}>{inCardStep ? "TAP TO RAISE" : "BOARD"}</Label>
          <BoardCards board={scenario.board} raised={answered ? trueBoardCards : step.raised} interactive={inCardStep} onToggle={step.toggle} />
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
      {inCardStep ? (
        <PickedSummary label="HAND" value={CATEGORY_LABEL[picked!]} onBack={step.back} />
      ) : (
        <Panel className="p-3 sm:p-4">
          <Question sub={`LEVEL ${scenario.level}`}>このプレイヤーのBEST HANDは？</Question>
          <div className="mt-3">
            <ChoiceList choices={choices} onPick={pick} answeredKey={userCat === null ? null : String(userCat)} correctKey={answered ? String(scenario.hand.category) : null} />
          </div>
        </Panel>
      )}
      {inCardStep && <CardStepPanel title="この役に使うボードのカードは？" count={step.raised.length} canSubmit={step.canSubmit} onSubmit={step.submit} />}
      {answered && (
        <>
          {verdict}
          <Panel className="animate-rise p-3 sm:p-4">
            {answered.grade.parts && userCat !== null && (
              <PartsResult
                rows={[
                  { ok: answered.grade.parts.category, label: "HAND", value: CATEGORY_LABEL[userCat] },
                  ...(scenario.requireBoardCards ? [{ ok: !!answered.grade.parts.cards, label: "BOARD CARDS", value: <CardRow cards={userCards} size="xs" /> }] : []),
                ]}
                example={scenario.requireBoardCards && !answered.grade.parts.cards ? { label: "正解例", cards: trueBoardCards } : undefined}
              />
            )}
            <div className="text-2xl font-black tracking-[0.1em] text-brass">{handName(scenario.hand).toUpperCase()}</div>
            <div className="font-mono text-lg tracking-wider">{bestFiveRanks(scenario.hand)}</div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              <div>
                <Label>Best 5</Label>
                <CardRow cards={scenario.hand.bestFive} size="sm" className="mt-1" />
              </div>
              <div>
                <Label>Board Cards Up</Label>
                <CardRow cards={trueBoardCards} size="sm" className="mt-1" />
              </div>
            </div>
          </Panel>
        </>
      )}
    </>
  );
  return <ModeLayout table={table} panel={panel} />;
}
