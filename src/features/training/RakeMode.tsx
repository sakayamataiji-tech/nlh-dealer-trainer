"use client";
import { useState } from "react";
import type { HandEnding, RakeScenario } from "@/engine/scenarioTypes";
import { PokerTable } from "@/components/PokerTable";
import { CardBack } from "@/components/PlayingCard";
import { NumberInput } from "@/components/NumberInput";
import { Panel, Label } from "@/components/ui/panel";
import { cn, formatChips } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { ModeLayout, Question } from "./ModeLayout";
import type { ModeViewProps } from "./types";

/** Unrounded rake for the explanation, e.g. 3.7 or 166.25. */
export function formatExact(x: number): string {
  return Number(x.toFixed(4)).toLocaleString("en-US", { maximumFractionDigits: 4 });
}

const BOARD_COUNT: Record<HandEnding, number> = { "preflop-fold": 0, flop: 3, turn: 4, river: 5, "allin-runout": 5 };

/**
 * The hand is over and the final pot is on the table. The dealer takes the rake and the
 * jackpot drop (house rules from the settings) and states the payout, one number at a time.
 */
export function RakeMode({ scenario, answered, onAnswer, verdict }: ModeViewProps<RakeScenario>) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const { rule, result: r, questions: qs } = scenario;
  const q = qs[step];

  const submit = () => {
    if (!value || !q) return;
    const next = { ...amounts, [q.key]: Number(value) };
    setAmounts(next);
    setValue("");
    if (step + 1 < qs.length) setStep(step + 1);
    else onAnswer({ mode: "rake", amounts: next });
  };
  const userAmounts = answered?.answer.mode === "rake" ? answered.answer.amounts : {};
  const boardCount = BOARD_COUNT[scenario.ending];

  const table = (
    <PokerTable
      compact
      seats={[]}
      center={
        <div className="flex flex-col items-center gap-2">
          <div className="text-xs font-bold tracking-[0.15em] text-text/85 sm:text-sm">{t.handEnding[scenario.ending]}</div>
          <div className="flex min-h-10 gap-0.5">
            {Array.from({ length: boardCount }, (_, i) => (
              <CardBack key={i} size="xs" />
            ))}
            {boardCount === 0 && <span className="self-center text-xs tracking-[0.2em] text-text/50">NO FLOP</span>}
          </div>
          <div className="flex items-baseline gap-2 rounded-full border border-brass-dim/60 bg-ink/80 px-4 py-1">
            <span className="text-[11px] font-bold tracking-[0.2em] text-muted">POT</span>
            <span className="text-2xl font-black tabular text-brass sm:text-3xl">{formatChips(scenario.pot)}</span>
          </div>
          <div className="text-[11px] tabular text-text/60">
            BLINDS {formatChips(scenario.blinds.sb)}/{formatChips(scenario.blinds.bb)}
          </div>
        </div>
      }
    />
  );

  const jackpotNote =
    rule.jackpot.enabled && !r.reason && r.jackpot === 0 ? t.jackpotSkipped(r.rake === 0 ? "no-rake" : "too-small") : null;

  const panel = (
    <>
      <Panel className="p-3 sm:p-4">
        <Question sub={t.rakeSub(scenario.level)}>{answered || !q ? t.rakeQ : t.howMuch(q.label)}</Question>
        <div className="mt-1 text-xs text-brass">
          {t.rakeRuleSummary(rule.percent, rule.cap ? formatChips(rule.cap) : null, rule.noFlopNoDrop, rule.jackpot.enabled ? formatChips(rule.jackpot.amount) : null, rule.rounding)}
        </div>
        {!answered && qs.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {qs.map((qq, i) => (
              <span key={qq.key} className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold tabular", i === step ? "border-brass text-brass" : i < step ? "border-line text-text" : "border-line text-muted")}>
                {qq.label}
                {i < step && `: ${formatChips(amounts[qq.key])}`}
              </span>
            ))}
          </div>
        )}
        {!answered && q && (
          <div className="mt-2">
            <NumberInput label={q.label} value={value} onChange={setValue} onSubmit={submit} />
          </div>
        )}
      </Panel>
      {answered && (
        <>
          {verdict}
          <Panel className="animate-rise p-3 sm:p-4">
            <Label className="mb-1">{t.rakeTitle}</Label>
            <table className="w-full text-sm tabular">
              <tbody>
                {qs.map((qq) => {
                  const ok = answered.grade.parts?.[qq.key];
                  return (
                    <tr key={qq.key}>
                      <td className="py-0.5 font-semibold">{qq.label}</td>
                      <td className="text-right text-lg font-black text-brass">{formatChips(qq.answer)}</td>
                      <td className={cn("w-28 pl-2 text-right text-xs", ok ? "text-good" : "text-bad")}>
                        {ok ? "✓" : "×"} {Number.isFinite(userAmounts[qq.key]) ? formatChips(userAmounts[qq.key]) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-xs text-muted">
              {r.reason === "no-flop" ? (
                <div className="text-warn">{t.noFlopNoDropApplied}</div>
              ) : (
                <>
                  {scenario.ending === "allin-runout" && rule.noFlopNoDrop && <div className="text-warn">{t.runoutNote}</div>}
                  <div>
                    RAKE: {t.rakeExplain(formatChips(scenario.pot), rule.percent, formatExact((scenario.pot * rule.percent) / 100), formatChips(r.uncapped), r.unit, rule.rounding, rule.cap && r.uncapped > rule.cap ? formatChips(rule.cap) : null)}
                  </div>
                </>
              )}
              {jackpotNote && <div>{jackpotNote}</div>}
              <div>{t.payoutExplain(formatChips(scenario.pot), formatChips(r.rake), r.jackpot ? formatChips(r.jackpot) : null, formatChips(r.payout))}</div>
            </div>
          </Panel>
        </>
      )}
    </>
  );
  return <ModeLayout table={table} panel={panel} />;
}
