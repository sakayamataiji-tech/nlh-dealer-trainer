import type { BlindStructure, Street, TableAction, TablePlayer } from "./actions";
import { STREETS } from "./actions";

/**
 * NLH betting state machine used to generate only-legal action sequences.
 * Players are ordered clockwise starting from the SB (heads-up: BTN/SB, BB).
 *
 * Rules implemented (TDA-style NLH):
 *  - Blinds capped by stack; a short BB still sets the bet to the full BB.
 *  - Min bet = BB. Min raise-to = current bet + last full raise size.
 *  - An all-in raise smaller than a full raise does not reopen betting for players
 *    who already acted (unless cumulative short raises add up to a full raise).
 *  - Heads-up: BTN posts SB and acts first preflop, last postflop.
 */
export interface LegalAction {
  type: "fold" | "check" | "call" | "bet" | "raise" | "allin";
  /** call: amount to put in; bet/raise: min & max raise-to (street totals). allin: street total after shove. */
  callAmount?: number;
  minTo?: number;
  maxTo?: number;
  allinTo?: number;
}

interface PState {
  id: string;
  stack: number;
  street: number;
  total: number;
  folded: boolean;
  hasActed: boolean;
  /** Current bet level the player had matched at their last voluntary action. */
  matchedAt: number;
}

export class HandState {
  readonly players: PState[];
  readonly blinds: BlindStructure;
  readonly log: TableAction[] = [];
  street: Street = "preflop";
  currentBet = 0;
  lastRaiseSize: number;
  raisesThisStreet = 0;
  private lastActorIndex = -1;
  finished = false;

  constructor(players: readonly TablePlayer[], blinds: BlindStructure) {
    if (players.length < 2) throw new Error("Need at least 2 players");
    this.blinds = blinds;
    this.lastRaiseSize = blinds.bb;
    this.players = players.map((p) => ({ id: p.id, stack: p.stack, street: 0, total: 0, folded: false, hasActed: false, matchedAt: 0 }));
    this.postForced();
  }

  private get n() {
    return this.players.length;
  }
  private get sbIndex() {
    return 0;
  }
  private get bbIndex() {
    return 1;
  }
  private get buttonIndex() {
    return this.n === 2 ? 0 : this.n - 1;
  }

  private put(p: PState, amount: number, toStreet = true) {
    const a = Math.min(amount, p.stack);
    p.stack -= a;
    p.total += a;
    if (toStreet) p.street += a;
    return a;
  }

  private postForced() {
    const { ante, sb, bb } = this.blinds;
    if (ante > 0) {
      for (const p of this.players) {
        this.put(p, ante, false);
        this.log.push({ playerId: p.id, street: "preflop", type: "ante", amount: ante });
      }
    }
    const sbP = this.players[this.sbIndex];
    const bbP = this.players[this.bbIndex];
    if (sbP.stack > 0) {
      this.put(sbP, sb);
      this.log.push({ playerId: sbP.id, street: "preflop", type: "post_sb", amount: sb });
    }
    if (bbP.stack > 0) {
      this.put(bbP, bb);
      this.log.push({ playerId: bbP.id, street: "preflop", type: "post_bb", amount: bb });
    }
    this.currentBet = bb;
    this.lastRaiseSize = bb;
    this.lastActorIndex = this.bbIndex;
  }

  get activePlayers(): PState[] {
    return this.players.filter((p) => !p.folded);
  }

  private canAct(p: PState) {
    return !p.folded && p.stack > 0;
  }

  private needsAction(p: PState): boolean {
    if (!this.canAct(p)) return false;
    if (p.street < this.currentBet) return true;
    if (p.hasActed) return false;
    return this.players.some((o) => o !== p && this.canAct(o));
  }

  /** Index of the next player to act on this street, or -1 if the round is complete. */
  nextToAct(): number {
    if (this.finished) return -1;
    if (this.activePlayers.length <= 1) return -1;
    for (let k = 1; k <= this.n; k++) {
      const i = (this.lastActorIndex + k) % this.n;
      if (this.needsAction(this.players[i])) return i;
    }
    return -1;
  }

  get roundComplete(): boolean {
    return this.nextToAct() === -1;
  }

  legalActions(index: number): LegalAction[] {
    const p = this.players[index];
    const toCall = Math.max(0, this.currentBet - p.street);
    const maxTo = p.street + p.stack;
    const out: LegalAction[] = [];
    const canReopen = !p.hasActed || this.currentBet - p.matchedAt >= this.lastRaiseSize;
    if (toCall > 0) {
      out.push({ type: "fold" });
      if (p.stack > toCall) out.push({ type: "call", callAmount: toCall });
    } else {
      out.push({ type: "check" });
    }
    if (this.currentBet === 0) {
      const minTo = this.blinds.bb;
      if (maxTo > minTo) out.push({ type: "bet", minTo, maxTo: maxTo - 1 });
      out.push({ type: "allin", allinTo: maxTo });
    } else if (p.stack > toCall) {
      if (canReopen) {
        const minTo = this.currentBet + this.lastRaiseSize;
        if (maxTo > minTo) out.push({ type: "raise", minTo, maxTo: maxTo - 1 });
        out.push({ type: "allin", allinTo: maxTo });
      }
    } else {
      // Can only call all-in for the same or less.
      out.push({ type: "allin", allinTo: maxTo });
    }
    return out;
  }

  /** Apply an action for the player at `index`. Validates legality. */
  apply(index: number, action: { type: LegalAction["type"]; to?: number }): TableAction {
    if (index !== this.nextToAct()) throw new Error("Not this player's turn");
    const p = this.players[index];
    const legal = this.legalActions(index);
    const rule = legal.find((l) => l.type === action.type);
    if (!rule) throw new Error(`Illegal action ${action.type}`);
    let logged: TableAction;
    switch (action.type) {
      case "fold":
        p.folded = true;
        logged = { playerId: p.id, street: this.street, type: "fold" };
        break;
      case "check":
        logged = { playerId: p.id, street: this.street, type: "check" };
        break;
      case "call":
        this.put(p, rule.callAmount!);
        logged = { playerId: p.id, street: this.street, type: "call", amount: this.currentBet };
        break;
      case "bet":
      case "raise": {
        const to = action.to!;
        if (to < rule.minTo! || to > rule.maxTo!) throw new Error(`${action.type} to ${to} outside [${rule.minTo}, ${rule.maxTo}]`);
        const size = to - this.currentBet;
        this.put(p, to - p.street);
        if (size >= this.lastRaiseSize) this.lastRaiseSize = size;
        this.currentBet = to;
        this.raisesThisStreet++;
        logged = { playerId: p.id, street: this.street, type: action.type, amount: to };
        break;
      }
      case "allin": {
        this.put(p, p.stack);
        const to = p.street;
        if (to > this.currentBet) {
          const size = to - this.currentBet;
          if (size >= this.lastRaiseSize || this.currentBet === 0) this.lastRaiseSize = Math.max(size, this.blinds.bb);
          this.currentBet = to;
          this.raisesThisStreet++;
        }
        logged = { playerId: p.id, street: this.street, type: "allin", amount: to };
        break;
      }
    }
    p.hasActed = true;
    p.matchedAt = this.currentBet;
    this.lastActorIndex = index;
    this.log.push(logged);
    if (this.activePlayers.length <= 1) this.finished = true;
    return logged;
  }

  /** Move to the next street. Returns false if the hand is over (river done or one player left). */
  advanceStreet(): boolean {
    if (!this.roundComplete) throw new Error("Betting round not complete");
    if (this.activePlayers.length <= 1 || this.street === "river") {
      this.finished = true;
      return false;
    }
    this.street = STREETS[STREETS.indexOf(this.street) + 1];
    this.currentBet = 0;
    this.lastRaiseSize = this.blinds.bb;
    this.raisesThisStreet = 0;
    for (const p of this.players) {
      p.street = 0;
      p.hasActed = false;
      p.matchedAt = 0;
    }
    // Postflop: first to act is the first active seat left of the button.
    this.lastActorIndex = this.buttonIndex;
    return true;
  }

  /** Total chips committed per player (before any uncalled-bet return). */
  contributions(): Record<string, number> {
    return Object.fromEntries(this.players.map((p) => [p.id, p.total]));
  }

  foldedIds(): string[] {
    return this.players.filter((p) => p.folded).map((p) => p.id);
  }

  potTotal(): number {
    return this.players.reduce((s, p) => s + p.total, 0);
  }

  playerState(id: string) {
    const p = this.players.find((x) => x.id === id);
    if (!p) throw new Error(`Unknown player ${id}`);
    return { ...p, allIn: !p.folded && p.stack === 0 };
  }
}
