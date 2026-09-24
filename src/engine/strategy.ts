/**
 * GTO-inspired bot strategy (heuristic approximation of solver play — not a solver).
 *
 * Preflop
 *  - No limping (SB included): raise-first-in or fold. Open 2.5bb (SB 3bb).
 *  - Opening ranges widen with position (UTG ~13% … BTN ~45%, SB ~40% vs BB).
 *  - Facing an open: 3-bet (3x IP / 4x from the blinds) or call a position-dependent range;
 *    SB is 3-bet-or-fold, BB defends wide. 4-bet ~2.25x, 5-bet = all-in.
 *  - ≤ 20bb effective: push / fold with stack-dependent ranges.
 * Postflop
 *  - Real hand strength (made hand + draws, from the actual hole cards and board).
 *  - Previous aggressor c-bets; value bets strong hands, bluffs a share of draws / air.
 *  - Facing a bet: continues by strength and price (pot odds), raises strong hands.
 * Decisions are mixed with a little randomness, as equilibrium strategies are.
 */
import { STREETS } from "./actions";
import type { HandState, LegalAction } from "./bettingEngine";
import { type Card, rankValue, suitOf } from "./cards";
import { evaluateHand, HandCategory } from "./handEvaluator";
import type { Rng } from "./shuffle";

/* ---------------- Preflop hand ranking (169 classes) ---------------- */

/** Chen-formula score with a high-card tie-break; higher is better. */
function chenScore(hi: number, lo: number, suited: boolean): number {
  const base = (r: number) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
  let s: number;
  if (hi === lo) s = Math.max(5, base(hi) * 2);
  else {
    s = base(hi);
    if (suited) s += 2;
    const gap = hi - lo - 1;
    s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
    if (gap <= 1 && hi < 12) s += 1;
  }
  return Math.ceil(s) + hi / 100 + lo / 1000;
}

const PERCENTILE = (() => {
  const classes: { key: string; score: number; combos: number }[] = [];
  for (let hi = 14; hi >= 2; hi--)
    for (let lo = hi; lo >= 2; lo--) {
      if (hi === lo) classes.push({ key: `${hi}-${lo}-p`, score: chenScore(hi, lo, false), combos: 6 });
      else {
        classes.push({ key: `${hi}-${lo}-s`, score: chenScore(hi, lo, true), combos: 4 });
        classes.push({ key: `${hi}-${lo}-o`, score: chenScore(hi, lo, false), combos: 12 });
      }
    }
  classes.sort((a, b) => b.score - a.score);
  const map = new Map<string, number>();
  let cum = 0;
  for (const c of classes) {
    // Percentile of the middle of the class: 0 = best hand.
    map.set(c.key, (cum + c.combos / 2) / 1326);
    cum += c.combos;
  }
  return map;
})();

/** 0 (AA) … 1 (worst). */
export function handPercentile(hole: readonly Card[]): number {
  const [a, b] = hole.map(rankValue).sort((x, y) => y - x);
  const kind = a === b ? "p" : suitOf(hole[0]) === suitOf(hole[1]) ? "s" : "o";
  return PERCENTILE.get(`${a}-${b}-${kind}`)!;
}

/* ---------------- Postflop hand strength ---------------- */

export type Strength = "monster" | "strong" | "medium" | "draw" | "air";

export function postflopStrength(hole: readonly Card[], board: readonly Card[]): Strength {
  const h = evaluateHand([...hole, ...board]);
  const holeRanks = hole.map(rankValue);
  const usesHole = h.bestFive.some((c) => hole.includes(c));
  const boardRanks = board.map(rankValue).sort((a, b) => b - a);
  const top = boardRanks[0];
  if (!usesHole) return h.category >= HandCategory.Straight ? "medium" : drawOr(hole, board, "air");
  if (h.category >= HandCategory.Straight) return "monster";
  if (h.category === HandCategory.ThreeOfAKind) return "monster";
  if (h.category === HandCategory.TwoPair) {
    const pairs = h.tiebreak.slice(0, 2);
    const both = pairs.every((r) => holeRanks.includes(r));
    if (both) return "monster";
    const holePair = pairs.find((r) => holeRanks.includes(r));
    if (holePair === undefined) return drawOr(hole, board, "air");
    return holePair >= top ? "strong" : "medium";
  }
  if (h.category === HandCategory.OnePair) {
    const pr = h.tiebreak[0];
    if (!holeRanks.includes(pr)) return drawOr(hole, board, "air");
    const pocket = holeRanks[0] === holeRanks[1];
    if (pocket && pr > top) return "strong"; // overpair
    if (pr === top) {
      const kicker = holeRanks.find((r) => r !== pr) ?? pr;
      return kicker >= 11 ? "strong" : drawOr(hole, board, "medium", "strong");
    }
    return pr >= (boardRanks[1] ?? 0) ? drawOr(hole, board, "medium", "strong") : drawOr(hole, board, "air", "draw");
  }
  return drawOr(hole, board, "air");
}

/** Upgrades to a draw (or `withDraw`) when there is a flush draw or an open-ended straight draw. */
function drawOr(hole: readonly Card[], board: readonly Card[], base: Strength, withDraw: Strength = "draw"): Strength {
  if (board.length >= 5) return base;
  const all = [...hole, ...board];
  const flushDraw = hole.some((hc) => all.filter((c) => suitOf(c) === suitOf(hc)).length === 4);
  const ranks = new Set(all.map(rankValue));
  if (ranks.has(14)) ranks.add(1);
  let outs = 0;
  for (let r = 1; r <= 14; r++) {
    if (ranks.has(r)) continue;
    const s = new Set(ranks).add(r);
    for (let hi = 14; hi >= 5; hi--)
      if ([0, 1, 2, 3, 4].every((k) => s.has(hi - k))) {
        outs++;
        break;
      }
  }
  return flushDraw || outs >= 2 ? withDraw : base;
}

/* ---------------- Decision ---------------- */

export interface BotContext {
  holes: Record<string, Card[]>;
  board: readonly Card[];
  rng: Rng;
  unit: number;
}

type Decision = { type: LegalAction["type"]; to?: number };

const BOARD_VISIBLE = { preflop: 0, flop: 3, turn: 4, river: 5 } as const;

/** Raise-first-in share by number of players still to act behind. */
function rfi(behind: number, n: number): number {
  if (n === 2) return 0.8;
  return [0, 0.4, 0.45, 0.28, 0.22, 0.19, 0.17, 0.15, 0.13, 0.12][Math.min(behind, 9)];
}

function preflopOrder(n: number): number[] {
  return n === 2 ? [0, 1] : [...Array.from({ length: n - 2 }, (_, i) => i + 2), 0, 1];
}

export function decide(state: HandState, index: number, ctx: BotContext): Decision {
  const legal = state.legalActions(index);
  const has = (t: LegalAction["type"]) => legal.find((l) => l.type === t);
  const p = state.players[index];
  const bb = state.blinds.bb;
  const jitter = () => 0.85 + ctx.rng() * 0.3;
  const toCall = Math.max(0, state.currentBet - p.street);
  const stackTotal = p.stack + p.street;

  const raiseTo = (target: number): Decision => {
    const rule = has("raise") ?? has("bet");
    if (!rule) return passive();
    let to = Math.max(rule.minTo!, Math.round(target / ctx.unit) * ctx.unit);
    if (to >= stackTotal * 0.6 || to > rule.maxTo!) return has("allin") ? { type: "allin" } : passive();
    to = Math.min(to, rule.maxTo!);
    return { type: rule.type, to };
  };
  /** Wanted to bet/raise but can't: check, else call. */
  const passive = (): Decision => (has("check") ? { type: "check" } : has("call") ? { type: "call" } : { type: "fold" });
  const callOrFold = (ok: boolean): Decision => {
    if (!ok) return has("check") ? { type: "check" } : { type: "fold" };
    if (has("call")) return { type: "call" };
    if (has("check")) return { type: "check" };
    return has("allin") ? { type: "allin" } : { type: "fold" };
  };

  if (state.street === "preflop") return preflop();
  return postflop();

  function preflop(): Decision {
    const n = state.players.length;
    const pct = handPercentile(ctx.holes[p.id]);
    const pre = state.log.filter((a) => a.street === "preflop" && !["ante", "post_sb", "post_bb"].includes(a.type));
    // Count real raises (an all-in that does not exceed the current bet is only a call).
    let level = bb;
    let raises = 0;
    let lastRaiseIdx = -1;
    let openerId: string | undefined;
    pre.forEach((a, i) => {
      if ((a.type === "raise" || a.type === "bet" || a.type === "allin") && (a.amount ?? 0) > level) {
        level = a.amount!;
        raises++;
        lastRaiseIdx = i;
        openerId ??= a.playerId;
      }
    });
    const effBB = Math.min(stackTotal, Math.max(...state.players.filter((o) => o !== p && !o.folded).map((o) => o.stack + o.street))) / bb;
    const order = preflopOrder(n);
    const isSB = index === 0 && n > 2;
    const isBB = index === 1;

    // Short stacks: push / fold.
    if (effBB <= 20) {
      if (raises === 0) {
        const behind = order.length - order.indexOf(index) - 1;
        const shove = Math.min(0.85, rfi(behind, n) * (20 / Math.max(effBB, 3)) * 0.7) * jitter();
        if (isBB && toCall === 0) return pct <= shove * 0.5 && has("allin") ? { type: "allin" } : { type: "check" };
        return pct <= shove && has("allin") ? { type: "allin" } : callOrFold(false);
      }
      const facingBB = toCall / bb;
      const callers = pre.slice(lastRaiseIdx + 1).filter((a) => a.type === "call" || a.type === "allin").length;
      let callPct = Math.min(0.5, 0.03 + 0.9 / (facingBB + 2)) * jitter();
      if (callers > 0) callPct *= 0.6;
      if (pct <= callPct * 0.5 && has("allin")) return { type: "allin" };
      return callOrFold(pct <= callPct);
    }

    // Deep stacks.
    const callersAfterRaise = lastRaiseIdx >= 0 ? pre.slice(lastRaiseIdx + 1).filter((a) => a.type === "call").length : 0;
    // Big bet relative to stack → only premium hands continue.
    if (toCall >= stackTotal * 0.4) {
      if (pct <= 0.02 * jitter()) return has("allin") ? { type: "allin" } : callOrFold(true);
      return callOrFold(pct <= 0.035 * jitter());
    }
    if (raises === 0) {
      if (isBB) return { type: "check" };
      const behind = order.length - order.indexOf(index) - 1;
      if (pct <= rfi(behind, n) * jitter()) return raiseTo(isSB ? 3 * bb : 2.5 * bb);
      return has("check") ? { type: "check" } : { type: "fold" };
    }
    if (raises === 1) {
      const openerIdx = state.players.findIndex((o) => o.id === openerId);
      const openerRange = rfi(order.length - order.indexOf(openerIdx) - 1, n);
      let threeBet = Math.min(0.11, Math.max(0.03, 0.35 * openerRange + 0.02));
      let call = isBB ? Math.min(0.45, openerRange * 1.1 + 0.08) : isSB ? 0 : Math.min(0.16, Math.max(0.04, openerRange * 0.7));
      if (callersAfterRaise > 0) {
        threeBet *= 0.6;
        call *= isBB ? 0.8 : 0.7;
      }
      threeBet *= jitter();
      call *= jitter();
      if (pct <= threeBet) return raiseTo(state.currentBet * (isSB || isBB ? 4 : 3) + callersAfterRaise * state.currentBet);
      return callOrFold(pct <= threeBet + call);
    }
    if (raises === 2) {
      const involved = p.hasActed;
      if (pct <= (involved ? 0.025 : 0.02) * jitter()) return raiseTo(state.currentBet * 2.25);
      return callOrFold(pct <= (involved ? 0.07 : 0.03) * jitter());
    }
    if (raises === 3) {
      if (pct <= 0.012 * jitter() && has("allin")) return { type: "allin" };
      return callOrFold(pct <= 0.025 * jitter());
    }
    return callOrFold(pct <= 0.015 * jitter());
  }

  function postflop(): Decision {
    const board = ctx.board.slice(0, BOARD_VISIBLE[state.street]);
    const strength = postflopStrength(ctx.holes[p.id], board);
    const pot = state.potTotal();
    const active = state.players.filter((o) => !o.folded).length;
    const multiway = active >= 3;
    const r = ctx.rng();
    const bet = (frac: number): Decision => raiseTo(Math.max(bb, pot * frac));
    const streetIdx = STREETS.indexOf(state.street);
    // Previous street's last aggressor (preflop raiser on the flop).
    const prevStreet = STREETS[streetIdx - 1];
    const aggressor = [...state.log].reverse().find((a) => a.street === prevStreet && (a.type === "bet" || a.type === "raise" || a.type === "allin"))?.playerId;
    const isAggressor = aggressor === p.id;
    const river = state.street === "river";

    if (toCall === 0) {
      const bluff = (multiway ? 0.5 : 1) * (state.street === "flop" ? 0.3 : 0.2);
      if (isAggressor) {
        if (strength === "monster" || strength === "strong") return bet(r < 0.6 ? 0.75 : 0.33);
        if (strength === "medium") return r < 0.4 ? bet(0.33) : passive();
        if (strength === "draw") return r < 0.5 ? bet(0.33) : passive();
        return r < bluff ? bet(0.33) : passive();
      }
      if (strength === "monster") return r < 0.3 ? bet(0.5) : passive();
      if (strength === "strong") return r < 0.15 ? bet(0.33) : passive();
      if (!river && strength === "draw" && r < 0.1) return bet(0.33);
      return passive();
    }

    const price = toCall / (pot + toCall);
    const committed = toCall >= p.stack * 0.5;
    const canRaise = state.raisesThisStreet < 3 && (has("raise") || has("allin"));
    switch (strength) {
      case "monster":
        if (canRaise && r < 0.35) return raiseTo(state.currentBet * 3);
        return callOrFold(true);
      case "strong":
        if (!committed && canRaise && !river && r < 0.1) return raiseTo(state.currentBet * 3);
        return callOrFold(!committed || r < 0.6);
      case "medium":
        return callOrFold(!committed && (price <= 0.3 || (price <= 0.4 && r < 0.6)) && !(multiway && price > 0.3));
      case "draw":
        return callOrFold(!committed && !river && price <= 0.33);
      case "air":
        return callOrFold(!committed && !multiway && !river && price <= 0.22 && r < 0.2);
    }
  }
}
