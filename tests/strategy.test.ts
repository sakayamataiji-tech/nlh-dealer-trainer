import { describe, expect, it } from "vitest";
import { handPercentile, postflopStrength } from "@/engine/strategy";
import { generatePotScenario, generateSidePotScenario, generateWinnerScenario } from "@/engine/scenarioGenerator";
import { seededRng } from "@/engine/shuffle";
import type { TableAction } from "@/engine/actions";
import type { Level } from "@/engine/scenarioTypes";
import type { Card } from "@/engine/cards";
import { c } from "./helpers";

describe("strategy: preflop hand ranking", () => {
  it("orders hands sensibly", () => {
    const p = (s: string) => handPercentile(c(s));
    expect(p("As Ah")).toBeLessThan(p("Ks Kh"));
    expect(p("Ks Kh")).toBeLessThan(p("As Kd"));
    expect(p("As Ks")).toBeLessThan(p("As Kd"));
    expect(p("As Ah")).toBeLessThan(0.01);
    expect(p("7s 2d")).toBeGreaterThan(0.9);
    expect(p("Js Ts")).toBeLessThan(p("Jd 4c"));
  });
});

describe("strategy: postflop strength", () => {
  it("classifies made hands and draws", () => {
    expect(postflopStrength(c("9s 9h"), c("9d 5c 2h"))).toBe("monster"); // set
    expect(postflopStrength(c("As Kd"), c("Ah 7c 2d"))).toBe("strong"); // top pair top kicker
    expect(postflopStrength(c("Qs Qd"), c("Jh 7c 2d"))).toBe("strong"); // overpair
    expect(postflopStrength(c("Ah 5h"), c("Kh 9h 2c"))).toBe("draw"); // nut flush draw
    expect(postflopStrength(c("8s 7d"), c("6h 5c Kd"))).toBe("draw"); // open-ended
    expect(postflopStrength(c("Ac 3d"), c("Kh 9s 6c"))).toBe("air");
    expect(postflopStrength(c("Ac 3d"), c("Kh 9s 6c 2d 8h"))).toBe("air");
  });
});

/** Preflop actions: [playerId, action, facing level before the action]. */
function preflopTimeline(actions: TableAction[], bb: number) {
  let level = bb;
  const out: { a: TableAction; before: number }[] = [];
  for (const a of actions) {
    if (a.street !== "preflop" || ["ante", "post_sb", "post_bb"].includes(a.type)) continue;
    out.push({ a, before: level });
    if ((a.type === "raise" || a.type === "allin") && (a.amount ?? 0) > level) level = a.amount!;
  }
  return out;
}

describe("strategy: behaviour in generated hands", () => {
  const rng = seededRng(777);
  const hands: { actions: TableAction[]; holes: Record<string, Card[]>; bb: number }[] = [];
  for (let i = 0; i < 150; i++) {
    const level = ((i % 5) + 1) as Level;
    const p = generatePotScenario(level, { rng });
    hands.push({ actions: p.actions, holes: p.holes, bb: p.blinds.bb });
    const w = generateWinnerScenario(level, { rng });
    hands.push({ actions: w.actions, holes: Object.fromEntries(w.table.map((t) => [t.id, t.hole])), bb: w.blinds.bb });
    const s = generateSidePotScenario(level, { rng });
    hands.push({ actions: s.actions, holes: s.holes, bb: s.blinds.bb });
  }

  it("never limps (no preflop call of the big blind before a raise)", () => {
    for (const h of hands) {
      for (const { a, before } of preflopTimeline(h.actions, h.bb)) {
        if (before === h.bb) expect(a.type).not.toBe("call");
      }
    }
  });
  it("premium hands (AA/KK) never fold preflop", () => {
    for (const h of hands)
      for (const { a } of preflopTimeline(h.actions, h.bb))
        if (a.type === "fold") expect(handPercentile(h.holes[a.playerId])).toBeGreaterThan(0.01);
  });
  it("first raiser opens within a reasonable range (no trash opens)", () => {
    for (const h of hands) {
      const first = preflopTimeline(h.actions, h.bb).find(({ a }) => a.type === "raise" || a.type === "allin");
      if (first && first.a.type === "raise") expect(handPercentile(h.holes[first.a.playerId])).toBeLessThan(0.9);
    }
  });
  it("open raises are 2.5bb (3bb from the SB)", () => {
    for (const h of hands) {
      const first = preflopTimeline(h.actions, h.bb).find(({ a }) => a.type === "raise" || a.type === "allin");
      if (first && first.a.type === "raise") expect([2.5 * h.bb, 3 * h.bb]).toContain(first.a.amount);
    }
  });
});
