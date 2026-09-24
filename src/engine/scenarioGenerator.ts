/**
 * Random scenario generation for every training mode.
 *
 * Flow (spec §19): generate a random scenario → the rules engine computes the answer
 * → the UI compares the user's answer against it. Generator "targets" only bias WHICH
 * random deals are kept; the answer is always recomputed by the engine and never
 * taken from the target.
 */
import type { AnteType, BlindStructure, Street, TableAction } from "./actions";
import { STREETS } from "./actions";
import { HandState } from "./bettingEngine";
import { type BotContext, decide } from "./strategy";
import { type Card, makeCard, rankValue, SUITS, suitOf, type Suit } from "./cards";
import { createDeck, Dealer } from "./deck";
import { resolveShowdown, type ShowdownResult } from "./handComparator";
import { boardPlays, CATEGORY_ORDER, type EvaluatedHand, evaluateHand, evaluatePlayer, HandCategory } from "./handEvaluator";
import { positionNames } from "./positions";
import { calculatePot } from "./potCalculator";
import { buildPots, potName } from "./sidePotCalculator";
import { type Rng, defaultRng, pick, randInt, shuffle, weightedPick } from "./shuffle";
import type { SkillTag } from "./skills";
import type {
  HandScenario,
  Level,
  PotScenario,
  Scenario,
  SeatedPlayer,
  TableSeat,
  SidePotScenario,
  TrainingMode,
  WinnerPlayer,
  WinnerScenario,
} from "./scenarioTypes";

export interface GenerateOptions {
  rng?: Rng;
  /** Weakness training: prefer scenarios whose derived skills include this tag. */
  focus?: SkillTag;
  /** Fixed player count (WINNER 2-9, POT 2-9, SIDE POT 3-9). Omit for the level default. */
  players?: number;
  /** Ante format for POT / SIDE POT. Default "none". */
  ante?: AnteType;
  /** HAND / WINNER: also ask which board cards play in the hand. Default true. */
  selectBoardCards?: boolean;
}

function clampPlayers(n: number | undefined, min: number, max: number): number | undefined {
  return n === undefined ? undefined : Math.min(max, Math.max(min, Math.round(n)));
}

let idCounter = 0;
function newId(rng: Rng): string {
  idCounter = (idCounter + 1) % 1e6;
  return `${Math.floor(rng() * 1e9).toString(36)}-${idCounter.toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                     */
/* ------------------------------------------------------------------ */

function freshDealer(rng: Rng): Dealer {
  return new Dealer(shuffle(createDeck(), rng));
}

function suitCounts(cards: readonly Card[]): Record<Suit, number> {
  const c: Record<Suit, number> = { s: 0, h: 0, d: 0, c: 0 };
  for (const x of cards) c[suitOf(x)]++;
  return c;
}

function rankCounts(cards: readonly Card[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const x of cards) m.set(rankValue(x), (m.get(rankValue(x)) ?? 0) + 1);
  return m;
}

export function isFourFlushBoard(board: readonly Card[]): boolean {
  return Object.values(suitCounts(board)).some((n) => n === 4);
}

export function isDoublePairedBoard(board: readonly Card[]): boolean {
  return [...rankCounts(board).values()].filter((n) => n >= 2).length >= 2;
}

function isWheel(h: EvaluatedHand): boolean {
  return (h.category === HandCategory.Straight || h.category === HandCategory.StraightFlush) && h.tiebreak[0] === 5;
}

/**
 * Counterfeit: both hole cards paired the board (two pair with the hole cards),
 * but the best five no longer uses both of those pairs.
 */
export function isCounterfeited(hole: readonly Card[], board: readonly Card[], hand: EvaluatedHand): boolean {
  const boardRanks = new Set(board.map(rankValue));
  const [a, b] = hole.map(rankValue);
  if (a === b || !boardRanks.has(a) || !boardRanks.has(b)) return false;
  if (hand.category !== HandCategory.TwoPair && hand.category !== HandCategory.OnePair) return false;
  const pairRanks = hand.category === HandCategory.TwoPair ? hand.tiebreak.slice(0, 2) : hand.tiebreak.slice(0, 1);
  return !(pairRanks.includes(a) && pairRanks.includes(b));
}

const CATEGORY_SKILL: Record<HandCategory, SkillTag> = {
  [HandCategory.HighCard]: "high-card",
  [HandCategory.OnePair]: "pair-detection",
  [HandCategory.TwoPair]: "two-pair-detection",
  [HandCategory.ThreeOfAKind]: "trips-detection",
  [HandCategory.Straight]: "straight-detection",
  [HandCategory.Flush]: "flush-detection",
  [HandCategory.FullHouse]: "full-house-detection",
  [HandCategory.FourOfAKind]: "quads-detection",
  [HandCategory.StraightFlush]: "straight-flush-detection",
};

/* ------------------------------------------------------------------ */
/* HAND READING                                                       */
/* ------------------------------------------------------------------ */

interface Deal {
  hole: Card[];
  board: Card[];
}

function randomDeal(rng: Rng): Deal {
  const d = freshDealer(rng);
  return { hole: d.deal(2), board: d.deal(5) };
}

/** Constructive deal for rare categories: place the core cards, fill randomly, randomize hole/board split. */
function constructedDeal(rng: Rng, core: Card[]): Deal {
  const d = freshDealer(rng);
  core.forEach((c) => d.take(c));
  const all = shuffle([...core, ...d.deal(7 - core.length)], rng);
  return { hole: all.slice(0, 2), board: all.slice(2) };
}

function dealForCategory(rng: Rng, target: HandCategory): Deal | null {
  for (let i = 0; i < 4000; i++) {
    let deal: Deal;
    if (target === HandCategory.StraightFlush) {
      const suit = pick(rng, SUITS);
      const high = randInt(rng, 5, 14);
      const core = [high, high - 1, high - 2, high - 3, high - 4].map((r) => makeCard(r === 1 ? 14 : r, suit));
      deal = constructedDeal(rng, core);
    } else if (target === HandCategory.FourOfAKind) {
      const r = randInt(rng, 2, 14);
      deal = constructedDeal(rng, SUITS.map((s) => makeCard(r, s)));
    } else {
      deal = randomDeal(rng);
    }
    if (evaluatePlayer(deal.hole, deal.board).category === target) return deal;
  }
  return null;
}

type HandPattern = { value: HandCategory | "board-play" | "four-flush-board" | "double-paired-board" | "wheel" | "straight-and-flush" | "board-trips" | "random"; weight: number };

const HAND_PATTERNS: Record<Level, HandPattern[]> = {
  1: [
    { value: HandCategory.OnePair, weight: 3 },
    { value: HandCategory.Straight, weight: 2 },
    { value: HandCategory.Flush, weight: 2 },
    { value: HandCategory.ThreeOfAKind, weight: 1 },
  ],
  2: [
    { value: HandCategory.TwoPair, weight: 3 },
    { value: HandCategory.ThreeOfAKind, weight: 2 },
    { value: HandCategory.FullHouse, weight: 2 },
    { value: HandCategory.FourOfAKind, weight: 1 },
    { value: HandCategory.OnePair, weight: 1 },
  ],
  3: [
    { value: HandCategory.HighCard, weight: 1 },
    { value: HandCategory.OnePair, weight: 1.5 },
    { value: HandCategory.TwoPair, weight: 1.5 },
    { value: HandCategory.ThreeOfAKind, weight: 1 },
    { value: HandCategory.Straight, weight: 1.2 },
    { value: HandCategory.Flush, weight: 1.2 },
    { value: HandCategory.FullHouse, weight: 1 },
    { value: HandCategory.FourOfAKind, weight: 0.6 },
    { value: HandCategory.StraightFlush, weight: 0.4 },
  ],
  4: [
    { value: "board-play", weight: 6 },
    { value: "random", weight: 4 },
  ],
  5: [
    { value: "four-flush-board", weight: 2 },
    { value: "double-paired-board", weight: 2 },
    { value: "wheel", weight: 1.5 },
    { value: "straight-and-flush", weight: 1.5 },
    { value: "board-trips", weight: 1 },
    { value: "board-play", weight: 1 },
  ],
};

function dealRandomCategory(rng: Rng): Deal {
  const target = weightedPick(rng, HAND_PATTERNS[3]) as HandCategory;
  return dealForCategory(rng, target) ?? randomDeal(rng);
}

function dealWhere(rng: Rng, pred: (d: Deal, h: EvaluatedHand) => boolean, tries = 6000): Deal | null {
  for (let i = 0; i < tries; i++) {
    const d = randomDeal(rng);
    if (pred(d, evaluatePlayer(d.hole, d.board))) return d;
  }
  return null;
}

/** Board-first sampling (e.g. boards that are themselves a strong hand). */
function dealWithBoard(rng: Rng, boardPred: (board: Card[]) => boolean, pred: (d: Deal, h: EvaluatedHand) => boolean, tries = 3000): Deal | null {
  for (let i = 0; i < tries; i++) {
    const dealer = freshDealer(rng);
    const board = dealer.deal(5);
    if (!boardPred(board)) continue;
    for (let j = 0; j < 20; j++) {
      const hole = shuffle(dealer.peekAll(), rng).slice(0, 2);
      const d = { hole, board };
      if (pred(d, evaluatePlayer(hole, board))) return d;
    }
  }
  return null;
}

function dealForHandPattern(rng: Rng, pattern: HandPattern["value"]): Deal {
  let d: Deal | null = null;
  switch (pattern) {
    case "random":
      d = dealRandomCategory(rng);
      break;
    case "board-play":
      d = dealWithBoard(
        rng,
        (b) => evaluateHand(b).category >= HandCategory.TwoPair,
        (deal, h) => boardPlays(deal.hole, h),
      );
      break;
    case "four-flush-board":
      d = dealWhere(rng, (deal) => isFourFlushBoard(deal.board));
      break;
    case "double-paired-board":
      d = dealWhere(rng, (deal) => isDoublePairedBoard(deal.board));
      break;
    case "wheel":
      d = dealWhere(rng, (_deal, h) => isWheel(h), 20000);
      break;
    case "straight-and-flush":
      // Both a straight and a flush are available; the best hand is flush or better.
      d = dealWhere(rng, (deal, h) => {
        const all = [...deal.hole, ...deal.board];
        const flushSuit = SUITS.find((s) => all.filter((c) => suitOf(c) === s).length >= 5);
        if (!flushSuit || h.category < HandCategory.Flush) return false;
        const ranks = new Set(all.map(rankValue));
        if (ranks.has(14)) ranks.add(1);
        for (let hi = 14; hi >= 5; hi--) if ([0, 1, 2, 3, 4].every((k) => ranks.has(hi - k))) return true;
        return false;
      }, 20000);
      break;
    case "board-trips":
      d = dealWhere(rng, (deal) => [...rankCounts(deal.board).values()].some((n) => n === 3), 8000);
      break;
    default:
      d = dealForCategory(rng, pattern);
  }
  return d ?? dealRandomCategory(rng);
}

function handSkills(deal: Deal, hand: EvaluatedHand): SkillTag[] {
  const tags: SkillTag[] = [CATEGORY_SKILL[hand.category]];
  if (isWheel(hand)) tags.push("wheel");
  if (boardPlays(deal.hole, hand)) tags.push("board-play");
  if (isFourFlushBoard(deal.board)) tags.push("four-flush-board");
  if (isDoublePairedBoard(deal.board)) tags.push("double-paired-board");
  return tags;
}

const FOCUS_TO_HAND_PATTERN: Partial<Record<SkillTag, HandPattern["value"]>> = {
  "high-card": HandCategory.HighCard,
  "pair-detection": HandCategory.OnePair,
  "two-pair-detection": HandCategory.TwoPair,
  "trips-detection": HandCategory.ThreeOfAKind,
  "straight-detection": HandCategory.Straight,
  "flush-detection": HandCategory.Flush,
  "full-house-detection": HandCategory.FullHouse,
  "quads-detection": HandCategory.FourOfAKind,
  "straight-flush-detection": HandCategory.StraightFlush,
  wheel: "wheel",
  "board-play": "board-play",
  "four-flush-board": "four-flush-board",
  "double-paired-board": "double-paired-board",
};

export function generateHandScenario(level: Level, opts: GenerateOptions = {}): HandScenario {
  const rng = opts.rng ?? defaultRng;
  const focusPattern = opts.focus ? FOCUS_TO_HAND_PATTERN[opts.focus] : undefined;
  const pattern = focusPattern ?? weightedPick(rng, HAND_PATTERNS[level]);
  const deal = dealForHandPattern(rng, pattern);
  // The answer is derived from the evaluator — never from `pattern`.
  const hand = evaluatePlayer(deal.hole, deal.board);
  const requireBoardCards = opts.selectBoardCards ?? true;
  return {
    id: newId(rng),
    mode: "hand",
    level,
    hole: deal.hole,
    board: deal.board,
    hand,
    skills: handSkills(deal, hand),
    choices: [...CATEGORY_ORDER],
    requireBoardCards,
    targetSeconds: 4 + (level - 1) * 0.75 + (requireBoardCards ? 3 : 0),
  };
}

/* ------------------------------------------------------------------ */
/* WINNER                                                             */
/* ------------------------------------------------------------------ */

const MADE_RANKS: Record<HandCategory, number> = {
  [HandCategory.HighCard]: 1,
  [HandCategory.OnePair]: 1,
  [HandCategory.TwoPair]: 2,
  [HandCategory.ThreeOfAKind]: 1,
  [HandCategory.Straight]: 1,
  [HandCategory.Flush]: 5,
  [HandCategory.FullHouse]: 2,
  [HandCategory.FourOfAKind]: 1,
  [HandCategory.StraightFlush]: 1,
};

export function winnerSkills(board: readonly Card[], players: readonly WinnerPlayer[], result: ShowdownResult): SkillTag[] {
  const tags = new Set<SkillTag>();
  const winners = result.entries.filter((e) => e.rank === 1);
  const losers = result.entries.filter((e) => e.rank !== 1);
  if (result.isSplit) tags.add("split-pot");
  const w = winners[0].hand;
  if (losers.length > 0) {
    const runnerUp = losers.reduce((a, b) => (b.hand.value > a.hand.value ? b : a)).hand;
    if (runnerUp.category !== w.category) tags.add("category-comparison");
    else {
      const diff = w.tiebreak.findIndex((r, i) => r !== runnerUp.tiebreak[i]);
      if (diff >= MADE_RANKS[w.category]) tags.add("kicker-comparison");
      if (w.category === HandCategory.TwoPair) tags.add("two-pair-comparison");
      if (w.category === HandCategory.Straight || w.category === HandCategory.StraightFlush) tags.add("straight-comparison");
      if (w.category === HandCategory.Flush) tags.add("flush-comparison");
      if (w.category === HandCategory.FullHouse) tags.add("full-house-comparison");
      if (w.category === HandCategory.HighCard || w.category === HandCategory.OnePair) tags.add("kicker-comparison");
    }
  }
  if (winners.some((e) => boardPlays(players.find((p) => p.id === e.id)!.hole, e.hand))) tags.add("board-play");
  if (result.entries.some((e) => isWheel(e.hand) && e.rank === 1)) tags.add("wheel");
  if (players.some((p) => isCounterfeited(p.hole, board, result.entries.find((e) => e.id === p.id)!.hand))) tags.add("counterfeit");
  if (isFourFlushBoard(board)) tags.add("four-flush-board");
  if (isDoublePairedBoard(board)) tags.add("double-paired-board");
  if (players.length >= 5) tags.add("multiway-showdown");
  return [...tags];
}

/** Default WINNER table size by level (a fixed size can be chosen in settings). */
export const WINNER_PLAYERS: Record<Level, [number, number]> = {
  1: [6, 6],
  2: [6, 7],
  3: [7, 8],
  4: [8, 9],
  5: [9, 9],
};

/** How many players reach showdown, by level (capped by the table size). */
export const WINNER_SHOWDOWN: Record<Level, [number, number]> = {
  1: [2, 2],
  2: [2, 2],
  3: [2, 3],
  4: [2, 3],
  5: [3, 4],
};

type BoardKind = "random" | "paired" | "double-paired" | "four-flush" | "three-flush" | "connected" | "straight" | "flush" | "full-house" | "quads" | "broadway-rainbow";

function boardMatches(kind: BoardKind, b: readonly Card[]): boolean {
  const rc = [...rankCounts(b).values()];
  const sc = Object.values(suitCounts(b));
  const cat = evaluateHand(b).category;
  switch (kind) {
    case "random":
      return true;
    case "paired":
      return rc.filter((n) => n === 2).length === 1 && !rc.includes(3);
    case "double-paired":
      return rc.filter((n) => n >= 2).length >= 2;
    case "four-flush":
      return sc.includes(4);
    case "three-flush":
      return sc.includes(3);
    case "connected": {
      const ranks = [...new Set(b.map(rankValue))].sort((x, y) => x - y);
      return ranks.length >= 4 && ranks.some((r, i) => i + 3 < ranks.length && ranks[i + 3] - r <= 4);
    }
    case "straight":
      return cat === HandCategory.Straight;
    case "flush":
      return cat === HandCategory.Flush;
    case "full-house":
      return cat === HandCategory.FullHouse;
    case "quads":
      return cat === HandCategory.FourOfAKind;
    case "broadway-rainbow":
      return false;
  }
}

function dealBoardOfKind(rng: Rng, kind: BoardKind): { dealer: Dealer; board: Card[] } {
  if (kind === "broadway-rainbow") {
    // A-K-Q-J-T with at most two cards of any suit: nobody can beat or improve the straight.
    for (;;) {
      const suits = [0, 1, 2, 3, 4].map(() => pick(rng, SUITS));
      if (Object.values(suitCounts(suits.map((s) => makeCard(2, s)))).some((n) => n > 2)) continue;
      const board = [14, 13, 12, 11, 10].map((r, i) => makeCard(r, suits[i]));
      const dealer = freshDealer(rng);
      board.forEach((c) => dealer.take(c));
      return { dealer, board: shuffle(board, rng) };
    }
  }
  if (kind === "quads") {
    const r = randInt(rng, 2, 14);
    const dealer = freshDealer(rng);
    const board = SUITS.map((s) => dealer.take(makeCard(r, s)));
    board.push(dealer.dealWhere((c) => rankValue(c) !== r)!);
    return { dealer, board: shuffle(board, rng) };
  }
  for (let i = 0; i < 20000; i++) {
    const dealer = freshDealer(rng);
    const board = dealer.deal(5);
    if (boardMatches(kind, board)) return { dealer, board };
  }
  const dealer = freshDealer(rng);
  return { dealer, board: dealer.deal(5) };
}

const WINNER_BOARDS: Record<Level, { value: BoardKind; weight: number }[]> = {
  1: [{ value: "random", weight: 1 }],
  2: [
    { value: "random", weight: 3 },
    { value: "paired", weight: 1 },
    { value: "three-flush", weight: 1 },
  ],
  3: [
    { value: "random", weight: 2 },
    { value: "paired", weight: 2 },
    { value: "three-flush", weight: 1 },
    { value: "connected", weight: 1 },
  ],
  4: [
    { value: "random", weight: 1 },
    { value: "straight", weight: 1 },
    { value: "flush", weight: 1 },
    { value: "full-house", weight: 0.5 },
    { value: "paired", weight: 1 },
    { value: "connected", weight: 1 },
  ],
  5: [
    { value: "double-paired", weight: 2 },
    { value: "four-flush", weight: 2 },
    { value: "paired", weight: 1.5 },
    { value: "connected", weight: 1.5 },
    { value: "three-flush", weight: 1 },
  ],
};

const SPLIT_BOARDS: { value: BoardKind; weight: number }[] = [
  { value: "straight", weight: 2 },
  { value: "flush", weight: 1 },
  { value: "full-house", weight: 1 },
  { value: "quads", weight: 1 },
  { value: "double-paired", weight: 1 },
];

/** Level-specific preference for which random showdowns to keep (answer is unaffected). */
function winnerAcceptable(level: Level, skills: SkillTag[], rng: Rng): boolean {
  const same = !skills.includes("category-comparison");
  switch (level) {
    case 1:
      return !same || rng() < 0.25;
    case 2:
      return !same || rng() < 0.5;
    case 3:
      return same || rng() < 0.3;
    case 4:
      return same || skills.includes("board-play") || rng() < 0.3;
    case 5:
      return (
        skills.some((s) =>
          ["counterfeit", "full-house-comparison", "flush-comparison", "straight-comparison", "two-pair-comparison", "kicker-comparison", "wheel"].includes(s),
        ) || rng() < 0.15
      );
  }
}

export const WINNER_SPLIT_RATE = 0.15;

/* ------------------------------------------------------------------ */
/* Hand simulation with GTO-inspired bots (POT / SIDE POT / WINNER)    */
/* ------------------------------------------------------------------ */

const BLIND_OPTIONS: BlindStructure[] = [
  { sb: 100, bb: 200, ante: 0 },
  { sb: 200, bb: 400, ante: 0 },
  { sb: 500, bb: 1000, ante: 0 },
  { sb: 1000, bb: 2000, ante: 0 },
];

/** Blinds with the chosen ante: BB ante = 1 BB; traditional ante = 1/8 BB per player. */
function pickBlinds(rng: Rng, ante: AnteType = "none"): BlindStructure {
  const b = pick(rng, BLIND_OPTIONS);
  if (ante === "bb") return { ...b, ante: b.bb, anteType: "bb" };
  if (ante === "all") return { ...b, ante: b.bb / 8, anteType: "all" };
  return { ...b, ante: 0, anteType: "none" };
}

/**
 * Every seat gets real hole cards and plays them with the strategy bot until `stopAfter`
 * finishes (or the hand ends). Returns false if the bot produced an illegal action.
 */
function playHand(state: HandState, ctx: BotContext, stopAfter: Street): boolean {
  for (let guard = 0; guard < 500; guard++) {
    const i = state.nextToAct();
    if (i === -1) {
      if (state.finished || state.street === stopAfter) return true;
      if (!state.advanceStreet()) return true;
      continue;
    }
    try {
      state.apply(i, decide(state, i, ctx));
    } catch {
      return false;
    }
  }
  return false;
}

function dealTable(rng: Rng, n: number, dealer?: Dealer): { holes: Card[][]; board: Card[] | null } {
  const d = dealer ?? freshDealer(rng);
  const holes = Array.from({ length: n }, () => d.deal(2));
  return { holes, board: dealer ? null : d.deal(5) };
}

/* ------------------------------------------------------------------ */
/* WINNER                                                             */
/* ------------------------------------------------------------------ */

/**
 * WINNER: a full table plays a real hand with the strategy bots (each acting on its own
 * cards). Only hands that reach showdown with the level's number of players are kept.
 * Board textures (and split boards) come from the level templates.
 */
export function generateWinnerScenario(level: Level, opts: GenerateOptions = {}): WinnerScenario {
  const rng = opts.rng ?? defaultRng;
  const n = clampPlayers(opts.players, 2, 9) ?? randInt(rng, ...WINNER_PLAYERS[level]);
  const [kmin, kmax] = WINNER_SHOWDOWN[level].map((k) => Math.min(k, n)) as [number, number];
  const requireBoardCards = opts.selectBoardCards ?? true;
  const wantSplit = opts.focus === "split-pot" || rng() < WINNER_SPLIT_RATE;
  let fallback: WinnerScenario | null = null;
  let loose: WinnerScenario | null = null;

  for (let attempt = 0; attempt < 2500; attempt++) {
    const kind: BoardKind = wantSplit ? (attempt > 1200 || rng() < 0.4 ? "broadway-rainbow" : weightedPick(rng, SPLIT_BOARDS)) : weightedPick(rng, WINNER_BOARDS[level]);
    const { dealer, board } = dealBoardOfKind(rng, kind);
    const { holes } = dealTable(rng, n, dealer);
    const blinds = pickBlinds(rng, "none");
    const positions = positionNames(n);
    const table: TableSeat[] = positions.map((pos, i) => ({ id: `S${i}`, name: pos, position: pos, stack: randInt(rng, 100, 250) * blinds.bb, hole: holes[i] }));
    const state = new HandState(table, blinds);
    const ctx: BotContext = { holes: Object.fromEntries(table.map((t) => [t.id, t.hole])), board, rng, unit: blinds.bb / 2 };
    if (!playHand(state, ctx, "river")) continue;
    if (state.street !== "river" || state.nextToAct() !== -1) continue;
    const alive = state.players.filter((p) => !p.folded);
    if (alive.length < 2) continue;

    const players: WinnerPlayer[] = alive.map((p) => {
      const seat = table.find((t) => t.id === p.id)!;
      return { id: p.id, name: seat.position, hole: seat.hole };
    });
    const result = resolveShowdown(board, players);
    // MVP: a single winner or a complete split among everyone at showdown (no partial splits).
    if (!(result.winners.length === 1 || result.winners.length === players.length)) continue;
    if (wantSplit !== result.isSplit) continue;
    const k = players.length;
    const skills = winnerSkills(board, players, result);
    const scenario: WinnerScenario = {
      id: newId(rng),
      mode: "winner",
      level,
      board,
      players,
      table,
      blinds,
      actions: [...state.log],
      result,
      skills,
      choices: [...players.map((p) => ({ key: p.id, label: p.name })), { key: "SPLIT", label: "SPLIT" }],
      correctKey: result.isSplit ? "SPLIT" : result.winners[0],
      requireBoardCards,
      targetSeconds: 3 + k * 1.5 + (requireBoardCards ? 3 : 0),
    };
    // Split hands are rare in real play: for them any showdown size is fine.
    if (!wantSplit && (k < kmin || k > kmax)) {
      loose ??= scenario;
      continue;
    }
    if (opts.focus && opts.focus !== "split-pot" && !skills.includes(opts.focus)) {
      fallback ??= scenario;
      continue;
    }
    if (opts.focus || wantSplit || winnerAcceptable(level, skills, rng)) return scenario;
    fallback ??= scenario;
  }
  if (fallback) return fallback;
  if (loose) return loose;
  throw new Error("Failed to generate winner scenario");
}

function seatPlayers(n: number, stacks: number[]): SeatedPlayer[] {
  const pos = positionNames(n);
  return stacks.map((stack, i) => ({ id: `S${i}`, name: pos[i], position: pos[i], stack }));
}

/* ------------------------------------------------------------------ */
/* POT                                                                */
/* ------------------------------------------------------------------ */

export const POT_LEVELS: Record<Level, { players: [number, number]; street: Street; allIn: boolean; unitDiv: number }> = {
  1: { players: [6, 9], street: "preflop", allIn: false, unitDiv: 2 },
  2: { players: [6, 9], street: "flop", allIn: false, unitDiv: 2 },
  3: { players: [6, 9], street: "turn", allIn: false, unitDiv: 2 },
  4: { players: [7, 9], street: "river", allIn: false, unitDiv: 4 },
  5: { players: [8, 9], street: "river", allIn: true, unitDiv: 4 },
};

export function generatePotScenario(level: Level, opts: GenerateOptions = {}): PotScenario {
  const rng = opts.rng ?? defaultRng;
  const cfg = POT_LEVELS[level];
  let fallback: PotScenario | null = null;
  for (let attempt = 0; attempt < 1500; attempt++) {
    const blinds = pickBlinds(rng, opts.ante);
    const unit = blinds.bb / cfg.unitDiv;
    const n = clampPlayers(opts.players, 2, 9) ?? randInt(rng, cfg.players[0], cfg.players[1]);
    const stacks = Array.from({ length: n }, () =>
      cfg.allIn ? randInt(rng, 25, 150) * blinds.bb + randInt(rng, 0, 3) * unit : randInt(rng, 100, 250) * blinds.bb,
    );
    const players = seatPlayers(n, stacks);
    const { holes, board } = dealTable(rng, n);
    const state = new HandState(players, blinds);
    const ctx: BotContext = { holes: Object.fromEntries(players.map((p, i) => [p.id, holes[i]])), board: board!, rng, unit };
    if (!playHand(state, ctx, cfg.street)) continue;
    if (state.activePlayers.length < 2) continue;
    const actions = [...state.log];
    const result = calculatePot(players, blinds, actions, { settle: true });
    if (!cfg.allIn && result.allIn.length > 0) continue;
    // Multi-street levels should actually see betting on the later streets.
    if (STREETS.indexOf(result.lastStreet) < STREETS.indexOf(cfg.street) && result.allIn.length === 0) continue;
    const skills: SkillTag[] = [cfg.street === "preflop" ? "pot-preflop" : "pot-multistreet"];
    if (result.allIn.length > 0) skills.push("pot-allin");
    if (result.uncalled) skills.push("uncalled-bet");
    if (result.anteTotal > 0) skills.push("ante");
    const voluntary = actions.filter((a) => a.type !== "post_sb" && a.type !== "post_bb" && a.type !== "ante").length;
    const scenario: PotScenario = {
      id: newId(rng),
      mode: "pot",
      level,
      players,
      blinds,
      actions,
      askStreet: result.lastStreet,
      holes: ctx.holes,
      result,
      answer: result.total,
      skills,
      targetSeconds: 3 + voluntary * 0.9,
    };
    if (opts.focus && !skills.includes(opts.focus)) {
      fallback ??= scenario;
      continue;
    }
    return scenario;
  }
  if (fallback) return fallback;
  throw new Error("Failed to generate pot scenario");
}

/* ------------------------------------------------------------------ */
/* SIDE POT                                                           */
/* ------------------------------------------------------------------ */

export const SIDEPOT_LEVELS: Record<Level, { players: [number, number]; minPots: number; stopAfter: Street; needFold: boolean; stackBB: [number, number] }> = {
  1: { players: [5, 6], minPots: 2, stopAfter: "preflop", needFold: false, stackBB: [4, 25] },
  2: { players: [6, 7], minPots: 2, stopAfter: "preflop", needFold: false, stackBB: [4, 30] },
  3: { players: [6, 8], minPots: 3, stopAfter: "preflop", needFold: true, stackBB: [4, 30] },
  4: { players: [7, 9], minPots: 3, stopAfter: "river", needFold: true, stackBB: [4, 35] },
  5: { players: [8, 9], minPots: 3, stopAfter: "river", needFold: true, stackBB: [4, 45] },
};

const LETTERS = "ABCDEFGHI";

/**
 * SIDE POT: tournament-style short stacks play with the strategy bots (push / fold when short,
 * postflop play when deeper). Hands are kept once they create enough pots.
 */
export function generateSidePotScenario(level: Level, opts: GenerateOptions = {}): SidePotScenario {
  const rng = opts.rng ?? defaultRng;
  const cfg = SIDEPOT_LEVELS[level];
  let fallback: SidePotScenario | null = null;
  let loose: SidePotScenario | null = null;
  for (let attempt = 0; attempt < 6000; attempt++) {
    const blinds = pickBlinds(rng, opts.ante);
    const unit = level >= 4 ? blinds.bb / 2 : blinds.bb;
    const n = clampPlayers(opts.players, 3, 9) ?? randInt(rng, cfg.players[0], cfg.players[1]);
    // With 3 players the most is main + 1 side pot (the top stack's excess is returned).
    const minPots = Math.min(cfg.minPots, n - 1);
    // Distinct stacks so all-ins create different levels.
    const stackSet = new Set<number>();
    while (stackSet.size < n) stackSet.add(randInt(rng, cfg.stackBB[0], cfg.stackBB[1]) * blinds.bb + (level >= 4 ? randInt(rng, 0, 1) * unit : 0));
    const stacks = shuffle([...stackSet], rng);
    const pos = positionNames(n);
    const players: SeatedPlayer[] = stacks.map((stack, i) => ({ id: `S${i}`, name: `Player ${LETTERS[i]}`, position: pos[i], stack }));
    const { holes, board } = dealTable(rng, n);
    const state = new HandState(players, blinds);
    const ctx: BotContext = { holes: Object.fromEntries(players.map((p, i) => [p.id, holes[i]])), board: board!, rng, unit };
    if (!playHand(state, ctx, cfg.stopAfter)) continue;
    const actions = [...state.log];
    const potResult = calculatePot(players, blinds, actions, { settle: false });
    // Antes are dead money in the main pot; side pots are cut from betting contributions only.
    const pots = buildPots(
      players.map((p) => ({ playerId: p.id, amount: potResult.betContributions[p.id], folded: potResult.folded.includes(p.id) })),
      { deadMoney: potResult.anteTotal },
    );
    if (pots.pots.length < 2) continue;
    const foldedContribution = potResult.folded.some((id) => potResult.betContributions[id] > 0);
    const skills: SkillTag[] = ["side-pot"];
    if (pots.pots.length >= 3) skills.push("multiple-side-pots");
    if (foldedContribution) skills.push("folded-contribution");
    if (pots.returned.length > 0) skills.push("uncalled-bet");
    if (potResult.anteTotal > 0) skills.push("ante");
    const nameOf = (id: string) => players.find((p) => p.id === id)!.name;
    const questions = [
      ...pots.pots.map((p) => ({ key: `pot${p.index}`, label: potName(p.index), answer: p.amount })),
      ...pots.returned.map((r) => ({ key: `return-${r.playerId}`, label: `RETURN → ${nameOf(r.playerId)}`, answer: r.amount })),
    ];
    const scenario: SidePotScenario = {
      id: newId(rng),
      mode: "sidepot",
      level,
      players,
      blinds,
      actions,
      potResult,
      holes: ctx.holes,
      pots,
      questions,
      skills,
      targetSeconds: 4 + questions.length * 5,
    };
    if (pots.pots.length < minPots || (cfg.needFold && !foldedContribution && rng() < 0.7)) {
      loose ??= scenario;
      continue;
    }
    if (opts.focus && !skills.includes(opts.focus)) {
      fallback ??= scenario;
      continue;
    }
    return scenario;
  }
  if (fallback) return fallback;
  if (loose) return loose;
  throw new Error("Failed to generate side pot scenario");
}

/* ------------------------------------------------------------------ */
/* Entry point                                                        */
/* ------------------------------------------------------------------ */

export function generateScenario(mode: TrainingMode, level: Level, opts: GenerateOptions = {}): Scenario {
  switch (mode) {
    case "hand":
      return generateHandScenario(level, opts);
    case "winner":
      return generateWinnerScenario(level, opts);
    case "pot":
      return generatePotScenario(level, opts);
    case "sidepot":
      return generateSidePotScenario(level, opts);
  }
}

export type { TableAction };
