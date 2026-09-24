"use client";
import { useState } from "react";
import { Check, X } from "lucide-react";
import type { SidePotScenario } from "@/engine/scenarioTypes";
import { PokerTable } from "@/components/PokerTable";
import { BetBadge, ChipAmount } from "@/components/Chips";
import { NumberInput } from "@/components/NumberInput";
import { Panel, Label } from "@/components/ui/panel";
import { cn, formatChips } from "@/lib/utils";
import { ActionLog } from "./ActionLog";
import { ModeLayout, Question } from "./ModeLayout";
import type { ModeViewProps } from "./types";

export function SidePotMode({ scenario, answered, onAnswer, verdict }: ModeViewProps<SidePotScenario>) {
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [showLog, setShowLog] = useState(false);
  const q = scenario.questions[step];
  const pr = scenario.potResult;
  const short = (id: string) => scenario.players.find((p) => p.id === id)!.name.replace("Player ", "");
  const nameOf = (id: string) => scenario.players.find((p) => p.id === id)!.name;

  const submit = () => {
    if (!value || !q) return;
    const next = { ...amounts, [q.key]: Number(value) };
    setAmounts(next);
    setValue("");
    if (step + 1 < scenario.questions.length) setStep(step + 1);
    else onAnswer({ mode: "sidepot", amounts: next });
  };

  const many = scenario.players.length >= 5;
  const table = (
    <PokerTable
      hideMobileFelt={!answered && pr.anteTotal === 0}
      center={
        <div className="flex flex-col items-center gap-1 text-center">
          <Label className="text-felt-line">{answered ? "POTS" : "SIDE POT"}</Label>
          {answered ? (
            <div className="flex flex-wrap justify-center gap-1">
              {scenario.pots.pots.map((p) => (
                <ChipAmount key={p.index} amount={p.amount} label={p.index === 0 ? "MAIN" : `S${p.index}`} tone={p.index === 0 ? "brass" : "blue"} />
              ))}
            </div>
          ) : (
            pr.anteTotal > 0 && (
              <BetBadge amount={pr.anteTotal} label="ANTE" tone="muted" />
            )
          )}
        </div>
      }
      seats={scenario.players.map((p) => {
        const row = pr.breakdown.find((b) => b.playerId === p.id)!;
        const status = row.folded ? "FOLD" : row.allIn ? "ALL-IN" : "CALL";
        return (
          <div key={p.id} className={cn("flex flex-col items-center gap-0.5 rounded-lg border border-line bg-ink/90 px-2 py-1 sm:px-3", row.folded && "opacity-60")}>
            <div className={cn("whitespace-nowrap font-bold tracking-wide", many ? "text-[11px]" : "text-xs sm:text-sm")}>
              {p.name} <span className="font-normal text-muted">{p.position}</span>
            </div>
            <div className={cn("text-[10px] font-black tracking-[0.2em]", status === "ALL-IN" ? "text-bad" : status === "FOLD" ? "text-muted" : "text-text/80")}>{status}</div>
          </div>
        );
      })}
      bets={scenario.players.map((p) => (pr.betContributions[p.id] > 0 ? <BetBadge amount={pr.betContributions[p.id]} size={scenario.players.length >= 7 ? "sm" : "md"} /> : null))}
    />
  );

  const panel = (
    <>
      <Panel className="p-3 sm:p-4">
        <Question sub={`LEVEL ${scenario.level} · 各プレイヤーの前の金額 = そのハンドのベット総額${pr.anteTotal > 0 ? "（中央のアンティはメインポットへ）" : ""}`}>{q && !answered ? `${q.label} はいくら？` : "SIDE POT"}</Question>
        {!answered && (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {scenario.questions.map((qq, i) => (
                <span key={qq.key} className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold tabular", i === step ? "border-brass text-brass" : i < step ? "border-line text-text" : "border-line text-muted")}>
                  {qq.label}
                  {i < step && `: ${formatChips(amounts[qq.key])}`}
                </span>
              ))}
            </div>
            <div className="mt-2">
              <NumberInput label={q.label} value={value} onChange={setValue} onSubmit={submit} />
            </div>
          </>
        )}
        {answered && (
          <button type="button" className="mt-2 text-xs text-muted underline-offset-2 hover:underline" onClick={() => setShowLog((v) => !v)}>
            {showLog ? "ACTION LOG を隠す" : "ACTION LOG（金額つき）を表示"}
          </button>
        )}
        {answered && showLog && (
          <div className="mt-1 max-h-48 overflow-auto">
            <ActionLog actions={scenario.actions} nameOf={nameOf} dense />
          </div>
        )}
      </Panel>
      {answered && (
        <>
          {verdict}
          <Panel className="animate-rise flex flex-col gap-2 p-3 sm:p-4">
            {scenario.pots.pots.map((p) => {
              const key = `pot${p.index}`;
              const ok = answered.grade.parts?.[key];
              return (
                <div key={key} className={cn("rounded-lg border p-2", ok ? "border-line" : "border-bad/50")}>
                  <div className="flex items-baseline justify-between">
                    <Label>{p.name}</Label>
                    <span className={cn("flex items-center gap-1 text-xs tabular", ok ? "text-good" : "text-bad")}>
                      {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      {formatChips(amounts[key] ?? 0)}
                    </span>
                  </div>
                  <div className="text-2xl font-black tabular text-brass">{formatChips(p.amount)}</div>
                  <div className="text-xs text-muted">
                    Eligible <span className="font-semibold text-text">{p.eligible.map(short).join(" / ")}</span>
                    {p.deadMoney > 0 && <span> · うちアンティ {formatChips(p.deadMoney)}</span>}
                  </div>
                </div>
              );
            })}
            {scenario.pots.returned.map((rt) => {
              const key = `return-${rt.playerId}`;
              const ok = answered.grade.parts?.[key];
              return (
                <div key={key} className={cn("rounded-lg border border-dashed p-2", ok ? "border-line" : "border-bad/50")}>
                  <div className="flex items-baseline justify-between">
                    <Label>UNCALLED → {nameOf(rt.playerId)} に返却</Label>
                    <span className={cn("text-xs tabular", ok ? "text-good" : "text-bad")}>{formatChips(amounts[key] ?? 0)}</span>
                  </div>
                  <div className="text-xl font-black tabular">{formatChips(rt.amount)}</div>
                </div>
              );
            })}
          </Panel>
        </>
      )}
    </>
  );
  return <ModeLayout table={table} panel={panel} />;
}
