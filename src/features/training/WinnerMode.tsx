"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Undo2, X } from "lucide-react";
import type { Card } from "@/engine/cards";
import { boardCardsInBestFive } from "@/engine/boardSelection";
import { describeHand, handName } from "@/engine/handEvaluator";
import type { WinnerScenario } from "@/engine/scenarioTypes";
import { CardRow, PlayingCard } from "@/components/PlayingCard";
import { PokerTable } from "@/components/PokerTable";
import { Button } from "@/components/ui/button";
import { Kbd, Label, Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { ChoiceList } from "./ChoiceList";
import { ModeLayout, Question } from "./ModeLayout";
import type { ModeViewProps } from "./types";

/**
 * Step 1: who wins (or SPLIT).
 * Step 2 (optional): push up the board cards that play in the winning hand, like a dealer does.
 */
export function WinnerMode({ scenario, answered, onAnswer, verdict }: ModeViewProps<WinnerScenario>) {
  const [picked, setPicked] = useState<string | null>(null);
  const [raised, setRaised] = useState<Card[]>([]);
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

  const toggle = useCallback((c: Card) => {
    setRaised((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  }, []);

  const canSubmit = raised.length >= 3 && raised.length <= 5;
  const stepRef = useRef<HTMLDivElement>(null);
  // Phones: bring the board + confirm button into view for the card step.
  useEffect(() => {
    if (!inCardStep) return;
    const el = stepRef.current;
    if (el && el.getBoundingClientRect().bottom > window.innerHeight) el.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [inCardStep]);
  const submit = useCallback(() => {
    if (picked && raised.length >= 3) onAnswer({ mode: "winner", key: picked, boardCards: scenario.board.filter((c) => raised.includes(c)) });
  }, [picked, raised, onAnswer, scenario.board]);

  // Card step keys: 1–5 toggle board cards, Enter confirms, Esc goes back to the winner choice.
  useEffect(() => {
    if (!inCardStep) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= scenario.board.length) {
        e.preventDefault();
        toggle(scenario.board[n - 1]);
      } else if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === "Escape" || e.key === "Backspace") {
        e.preventDefault();
        setPicked(null);
        setRaised([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inCardStep, scenario.board, toggle, submit]);

  const winnerEntries = r.entries.filter((e) => e.rank === 1);
  const winHand = winnerEntries[0].hand;
  const trueBoardCards = boardCardsInBestFive(scenario.board, winHand);
  const userKey = answered?.answer.mode === "winner" ? answered.answer.key : null;
  const userCards = answered?.answer.mode === "winner" ? answered.answer.boardCards ?? [] : [];
  // Board cards shown raised: the user's selection while answering, the real answer afterwards.
  const shownRaised = answered ? trueBoardCards : raised;
  const n = scenario.players.length;
  const many = n >= 5;
  const huge = n >= 7;

  const board = (
    <div className="flex gap-1 pt-3 sm:gap-1.5">
      {scenario.board.map((c, i) => {
        const up = shownRaised.includes(c);
        const card = <PlayingCard card={c} size={huge ? "md" : many ? "md" : "lg"} highlight={up} className={cn(up && "-translate-y-3")} />;
        return inCardStep ? (
          <button key={c} type="button" onClick={() => toggle(c)} className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brass" aria-pressed={up} aria-label={`board card ${i + 1}`}>
            {card}
            <span className="absolute -bottom-4 left-1/2 hidden -translate-x-1/2 font-mono text-[10px] text-text/60 md:block">{i + 1}</span>
          </button>
        ) : (
          <div key={c}>{card}</div>
        );
      })}
    </div>
  );

  const table = (
    <PokerTable
      center={
        <>
          <Label className={cn("text-felt-line", inCardStep && "text-brass")}>{inCardStep ? "TAP TO RAISE" : "BOARD"}</Label>
          {board}
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
  const cardsTargetBoard = cardsTargetHand ? boardCardsInBestFive(scenario.board, cardsTargetHand) : [];

  const panel = (
    <>
      {inCardStep ? (
        // Winner already chosen: collapse the list so the board and confirm stay on screen.
        <Panel className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="text-sm">
            <span className="text-muted">WINNER: </span>
            <span className="font-bold text-brass">{picked === "SPLIT" ? "SPLIT" : nameOf(picked!)}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPicked(null);
              setRaised([]);
            }}
          >
            <Undo2 className="h-4 w-4" /> 変更 <Kbd>Esc</Kbd>
          </Button>
        </Panel>
      ) : (
        <Panel className="p-3 sm:p-4">
          <Question sub={`LEVEL ${scenario.level} · ${n} players`}>WINNERは？</Question>
          <div className="mt-3">
            <ChoiceList choices={choices} onPick={pick} answeredKey={userKey} correctKey={answered ? scenario.correctKey : null} />
          </div>
        </Panel>
      )}
      {inCardStep && (
        <div ref={stepRef}>
        <Panel className="animate-rise border-brass/50 p-3 sm:p-4">
          <Question sub="役に使われるコミュニティカードをタップして上げる（3〜5枚）">
            {picked === "SPLIT" ? "勝った役" : nameOf(picked!)} の役に使うボードのカードは？
          </Question>
          <Button variant="primary" size="lg" className="mt-3 w-full" disabled={!canSubmit} onClick={submit}>
            決定（{raised.length}枚） <Kbd className="border-ink/30 bg-transparent text-ink/70">Enter</Kbd>
          </Button>
          <div className="mt-1 hidden text-[11px] text-muted md:block">1〜5: ボードのカードを上げ下げ · Esc: 勝者の選択に戻る</div>
        </Panel>
        </div>
      )}
      {answered && (
        <>
          {verdict}
          <Panel className="animate-rise p-3 sm:p-4">
            {answered.grade.parts && (
              <div className="mb-3 grid gap-1 text-sm">
                <PartRow ok={answered.grade.parts.winner} label="WINNER" value={userKey === "SPLIT" ? "SPLIT" : nameOf(userKey ?? "")} />
                {scenario.requireBoardCards && (
                  <PartRow ok={!!answered.grade.parts.cards} label="BOARD CARDS" value={<CardRow cards={userCards} size="xs" />} />
                )}
                {scenario.requireBoardCards && !answered.grade.parts.cards && cardsTarget && (
                  <div className="flex items-center gap-2 pl-6 text-xs text-muted">
                    {nameOf(cardsTarget)} の正解例 <CardRow cards={cardsTargetBoard} size="xs" />
                  </div>
                )}
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

function PartRow({ ok, label, value }: { ok: boolean; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? <Check className="h-4 w-4 shrink-0 text-good" /> : <X className="h-4 w-4 shrink-0 text-bad" />}
      <span className="w-28 shrink-0 text-xs font-bold tracking-widest text-muted">{label}</span>
      <span className={cn("font-semibold", ok ? "text-good" : "text-bad")}>{value}</span>
    </div>
  );
}
