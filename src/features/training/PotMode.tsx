"use client";
import { useState } from "react";
import type { PotScenario } from "@/engine/scenarioTypes";
import { PokerTable } from "@/components/PokerTable";
import { ChipAmount } from "@/components/Chips";
import { NumberInput } from "@/components/NumberInput";
import { Panel, Label } from "@/components/ui/panel";
import { cn, formatChips } from "@/lib/utils";
import { ActionLog } from "./ActionLog";
import { ModeLayout, Question } from "./ModeLayout";
import type { ModeViewProps } from "./types";

const STREET_LABEL = { preflop: "PREFLOP", flop: "FLOP", turn: "TURN", river: "RIVER" } as const;

export function PotMode({ scenario, answered, onAnswer, verdict }: ModeViewProps<PotScenario>) {
  const [value, setValue] = useState("");
  const r = scenario.result;
  const nameOf = (id: string) => scenario.players.find((p) => p.id === id)?.position ?? id;
  const submit = () => value && onAnswer({ mode: "pot", amount: Number(value) });
  const user = answered?.answer.mode === "pot" ? answered.answer.amount : null;

  const log = (
    <Panel className="w-full p-3 sm:p-4">
      <div className="flex items-baseline justify-between">
        <Label>
          Blinds SB {formatChips(scenario.blinds.sb)} / BB {formatChips(scenario.blinds.bb)}
        </Label>
        <span className="text-[10px] tracking-widest text-muted">RAISE = RAISE TO</span>
      </div>
      <div className="mt-2">
        <ActionLog actions={scenario.actions} nameOf={nameOf} dense columns />
      </div>
    </Panel>
  );

  const table = (
    <div className="flex w-full flex-col gap-3">
      <div className="mx-auto hidden w-full max-w-[680px] md:block">
      <PokerTable
        compact
        center={
          <div className="flex flex-col items-center gap-1">
            <Label className="text-felt-line">POT</Label>
            <div className={cn("rounded-lg bg-black/40 px-4 py-1 text-2xl font-bold tabular", answered ? "text-brass" : "text-muted")}>{answered ? formatChips(scenario.answer) : "?"}</div>
            <div className="text-xs text-text/70">
              Blinds {formatChips(scenario.blinds.sb)} / {formatChips(scenario.blinds.bb)}
            </div>
          </div>
        }
        seats={scenario.players.map((p) => {
          const row = r.breakdown.find((b) => b.playerId === p.id)!;
          return (
            <div key={p.id} className={cn("flex min-w-16 flex-col items-center rounded-lg border border-line bg-ink/85 px-2 py-1", row.folded && "opacity-50")}>
              <div className="text-xs font-bold tracking-wider">{p.position}</div>
              <div className="text-[10px] tabular text-muted">{formatChips(p.stack)}</div>
              {answered && <ChipAmount amount={row.inPot} className="mt-0.5 text-xs" />}
            </div>
          );
        })}
      />
      </div>
      {log}
    </div>
  );

  const panel = (
    <>
      <Panel className="p-3 sm:p-4">
        <Question sub={`LEVEL ${scenario.level} · ${STREET_LABEL[scenario.askStreet]} 終了時点`}>POTはいくら？</Question>
        {!answered && (
          <div className="mt-2">
            <NumberInput label="POT" value={value} onChange={setValue} onSubmit={submit} />
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
          </Panel>
        </>
      )}
    </>
  );
  return <ModeLayout table={table} panel={panel} />;
}
