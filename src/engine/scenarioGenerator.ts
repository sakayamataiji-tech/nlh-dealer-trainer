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
import { HandState, type LegalAction } from "./bettingEngine";
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
  /** WINNER: also ask which board cards play in the winning hand. Default true. */
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
  return {
    id: newId(rng),
    mode: "hand",
    level,
    hole: deal.hole,
    board: deal.board,
    hand,
    skills: handSkills(deal, hand),
    choices: [...CATEGORY_ORDER],
    targetSeconds: 4 + (level - 1) * 0.75,
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

const PLAYER_NAMES = Array.from({ length: 9 }, (_, i) => `PLAYER ${i + 1}`);

/** Default WINNER player count by level (a fixed count can be chosen in settings). */
export const WINNER_PLAYERS: Record<Level, [number, number]> = {
  1: [2, 2],
  2: [3, 3],
  3: [4, 5],
  4: [6, 7],
  5: [8, 9],
};

function makeWinnerPlayers(dealer: Dealer, n: number, rng: Rng): WinnerPlayer[] {
  return Array.from({ length: n }, (_, i) => ({ id: `P${i + 1}`, name: PLAYER_NAMES[i], hole: dealer.deal(2) })).map((p) => ({
    ...p,
    hole: shuffle(p.hole, rng),
  }));
}

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

export function generateWinnerScenario(level: Level, opts: GenerateOptions = {}): WinnerScenario {
  const rng = opts.rng ?? defaultRng;
  const n = clampPlayers(opts.players, 2, 9) ?? randInt(rng, ...WINNER_PLAYERS[level]);
  const requireBoardCards = opts.selectBoardCards ?? true;
  const wantSplit = opts.focus === "split-pot" || rng() < WINNER_SPLIT_RATE;
  const build = (board: Card[], players: WinnerPlayer[]): WinnerScenario => {
    const result = resolveShowdown(board, players);
    const skills = winnerSkills(board, players, result);
    const correctKey = result.isSplit ? "SPLIT" : result.winners[0];
    return {
      id: newId(rng),
      mode: "winner",
      level,
      board,
      players,
      result,
      skills,
      choices: [...players.map((p) => ({ key: p.id, label: p.name })), { key: "SPLIT", label: "SPLIT" }],
      correctKey,
      requireBoardCards,
      targetSeconds: 3 + n * 1.5 + (requireBoardCards ? 3 : 0),
    };
  };
  // MVP: only complete splits (every player ties) or a single winner. Partial ties are rejected.
  const isValid = (r: ShowdownResult) => r.winners.length === 1 || r.winners.length === r.entries.length;

  if (wantSplit) {
    for (let i = 0; i < 400; i++) {
      let board: Card[];
      let players: WinnerPlayer[];
      if (n === 2 && rng() < 0.4) {
        // Heads-up: same hole ranks on a random board often chop.
        const dealer = freshDealer(rng);
        const p1 = dealer.deal(2);
        const p2 = p1.map((c) => dealer.dealWhere((x) => rankValue(x) === rankValue(c)));
        if (p2.some((c) => !c)) continue;
        board = dealer.deal(5);
        players = [
          { id: "P1", name: PLAYER_NAMES[0], hole: p1 },
          { id: "P2", name: PLAYER_NAMES[1], hole: p2 as Card[] },
        ];
      } else {
        const { dealer, board: b } = dealBoardOfKind(rng, weightedPick(rng, SPLIT_BOARDS));
        board = b;
        players = makeWinnerPlayers(dealer, n, rng);
      }
      const r = resolveShowdown(board, players);
      if (r.isSplit && r.winners.length === n) return build(board, players);
    }
    const { dealer, board } = dealBoardOfKind(rng, "broadway-rainbow");
    return build(board, makeWinnerPlayers(dealer, n, rng));
  }

  let fallback: WinnerScenario | null = null;
  for (let i = 0; i < 600; i++) {
    const { dealer, board } = dealBoardOfKind(rng, weightedPick(rng, WINNER_BOARDS[level]));
    const players = makeWinnerPlayers(dealer, n, rng);
    const r = resolveShowdown(board, players);
    if (!isValid(r) || r.isSplit) continue;
    const s = build(board, players);
    if (opts.focus) {
      if (s.skills.includes(opts.focus)) return s;
      fallback ??= s;
      continue;
    }
    if (winnerAcceptable(level, s.skills, rng)) return s;
    fallback ??= s;
  }
  if (fallback) return fallback;
  // Extremely unlikely: fall back to plain random deals until a unique winner appears.
  for (;;) {
    const dealer = freshDealer(rng);
    const board = dealer.deal(5);
    const players = makeWinnerPlayers(dealer, n, rng);
    if (resolveShowdown(board, players).winners.length === 1) return build(board, players);
  }
}

/* ------------------------------------------------------------------ */
/* Betting simulation (POT / SIDE POT)                                */
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

interface Policy {
  allowAllIn: boolean;
  foldFacing: number;
  callFacing: number;
  raiseFacing: number;
  allinFacing: number;
  betWhenChecked: number;
  allinWhenChecked: number;
  maxRaisesPerStreet: number;
  /** Chip unit for sizing. */
  unit: number;
  /** Never let the hand end before this street by everyone folding. */
  keepTwoUntil: Street;
}

function roundTo(x: number, unit: number): number {
  return Math.round(x / unit) * unit;
}

function chooseAction(state: HandState, index: number, policy: Policy, rng: Rng): { type: LegalAction["type"]; to?: number } {
  const legal = state.legalActions(index);
  const has = (t: LegalAction["type"]) => legal.find((l) => l.type === t);
  const p = state.players[index];
  const facing = state.currentBet - p.street > 0;
  const activeCount = state.activePlayers.length;
  const mustStay = activeCount <= 2 && STREETS.indexOf(state.street) <= STREETS.indexOf(policy.keepTwoUntil);
  const pot = state.potTotal();
  const unit = policy.unit;

  // Without all-ins, keep every bet small enough that nobody is forced to shove to continue.
  const effectiveCap = policy.allowAllIn
    ? Infinity
    : Math.min(...state.players.filter((o, j) => j !== index && !o.folded).map((o) => (o.street + o.stack) * 0.5));
  const withinCap = (to: number) => (to <= effectiveCap ? to : null);
  const sizeRaise = (rule: LegalAction): number | null => {
    const mult = state.street === "preflop" ? pick(rng, [2.5, 3, 3.5, 4]) : pick(rng, [2.5, 3, 3.5]);
    let to = roundTo(state.currentBet * mult, unit);
    if (state.street !== "preflop" && rng() < 0.4) to = roundTo(state.currentBet + pot * pick(rng, [0.5, 0.75, 1] as const), unit);
    to = Math.max(to, rule.minTo!);
    to = Math.ceil(to / unit) * unit;
    return to <= rule.maxTo! ? withinCap(to) : null;
  };
  const sizeBet = (rule: LegalAction): number | null => {
    let to = roundTo(pot * pick(rng, [0.33, 0.5, 0.66, 0.75, 1] as const), unit);
    to = Math.max(to, rule.minTo!);
    to = Math.ceil(to / unit) * unit;
    return to <= rule.maxTo! ? withinCap(to) : null;
  };

  const options: { value: () => { type: LegalAction["type"]; to?: number } | null; weight: number }[] = [];
  const canRaiseMore = state.raisesThisStreet < policy.maxRaisesPerStreet;
  if (facing) {
    if (has("fold") && !mustStay) options.push({ value: () => ({ type: "fold" }), weight: policy.foldFacing });
    if (has("call")) options.push({ value: () => ({ type: "call" }), weight: policy.callFacing });
    const raise = has("raise");
    if (raise && canRaiseMore) options.push({ value: () => { const to = sizeRaise(raise); return to ? { type: "raise", to } : null; }, weight: policy.raiseFacing });
    const allin = has("allin");
    if (allin && (policy.allowAllIn || !has("call")) && (canRaiseMore || allin.allinTo! <= state.currentBet)) {
      options.push({ value: () => ({ type: "allin" }), weight: has("call") ? policy.allinFacing : policy.callFacing });
    }
  } else {
    options.push({ value: () => ({ type: "check" }), weight: 1 - policy.betWhenChecked });
    const bet = has("bet");
    const raise = has("raise"); // BB option preflop
    if (bet && canRaiseMore) options.push({ value: () => { const to = sizeBet(bet); return to ? { type: "bet", to } : null; }, weight: policy.betWhenChecked });
    if (raise && canRaiseMore) options.push({ value: () => { const to = sizeRaise(raise); return to ? { type: "raise", to } : null; }, weight: policy.betWhenChecked * 0.6 });
    if (has("allin") && policy.allowAllIn && canRaiseMore) options.push({ value: () => ({ type: "allin" }), weight: policy.allinWhenChecked });
  }
  for (let i = 0; i < 10; i++) {
    const chosen = weightedPick(rng, options)();
    if (chosen) return chosen;
  }
  if (has("check")) return { type: "check" };
  if (has("call")) return { type: "call" };
  if (has("allin")) return { type: "allin" };
  return { type: "fold" };
}

/** Plays betting rounds until `stopAfter` finishes (or the hand ends). */
function simulate(state: HandState, policy: Policy, rng: Rng, stopAfter: Street): void {
  for (let guard = 0; guard < 500; guard++) {
    const i = state.nextToAct();
    if (i === -1) {
      if (state.finished || state.street === stopAfter) return;
      if (!state.advanceStreet()) return;
      continue;
    }
    state.apply(i, chooseAction(state, i, policy, rng));
  }
  throw new Error("Betting simulation did not terminate");
}

function seatPlayers(n: number, stacks: number[]): SeatedPlayer[] {
  const pos = positionNames(n);
  return stacks.map((stack, i) => ({ id: `S${i}`, name: pos[i], position: pos[i], stack }));
}

/* ------------------------------------------------------------------ */
/* POT                                                                */
/* ------------------------------------------------------------------ */

export const POT_LEVELS: Record<Level, { players: [number, number]; street: Street; allIn: boolean; unitDiv: number }> = {
  1: { players: [2, 5], street: "preflop", allIn: false, unitDiv: 2 },
  2: { players: [3, 6], street: "flop", allIn: false, unitDiv: 2 },
  3: { players: [4, 7], street: "turn", allIn: false, unitDiv: 2 },
  4: { players: [5, 9], street: "river", allIn: false, unitDiv: 4 },
  5: { players: [6, 9], street: "river", allIn: true, unitDiv: 4 },
};

export function generatePotScenario(level: Level, opts: GenerateOptions = {}): PotScenario {
  const rng = opts.rng ?? defaultRng;
  const cfg = POT_LEVELS[level];
  let fallback: PotScenario | null = null;
  for (let attempt = 0; attempt < 200; attempt++) {
    const blinds = pickBlinds(rng, opts.ante);
    const unit = blinds.bb / cfg.unitDiv;
    const n = clampPlayers(opts.players, 2, 9) ?? randInt(rng, cfg.players[0], cfg.players[1]);
    const stacks = Array.from({ length: n }, () =>
      cfg.allIn ? randInt(rng, 15, 150) * blinds.bb + randInt(rng, 0, 3) * unit : randInt(rng, 150, 300) * blinds.bb,
    );
    const players = seatPlayers(n, stacks);
    const state = new HandState(players, blinds);
    const policy: Policy = {
      allowAllIn: cfg.allIn,
      foldFacing: 0.4,
      callFacing: 0.45,
      raiseFacing: level >= 3 ? 0.2 : 0.12,
      allinFacing: 0.08,
      betWhenChecked: 0.45,
      allinWhenChecked: 0.04,
      maxRaisesPerStreet: level >= 4 ? 3 : 2,
      unit,
      keepTwoUntil: cfg.street,
    };
    simulate(state, policy, rng, cfg.street);
    if (state.activePlayers.length < 2) continue;
    const actions = [...state.log];
    const result = calculatePot(players, blinds, actions, { settle: true });
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

export const SIDEPOT_LEVELS: Record<Level, { players: [number, number]; minPots: number; stopAfter: Street; foldRate: number; needFold: boolean }> = {
  1: { players: [3, 3], minPots: 2, stopAfter: "preflop", foldRate: 0, needFold: false },
  2: { players: [3, 5], minPots: 2, stopAfter: "preflop", foldRate: 0.15, needFold: false },
  3: { players: [4, 6], minPots: 3, stopAfter: "preflop", foldRate: 0.2, needFold: true },
  4: { players: [5, 8], minPots: 3, stopAfter: "river", foldRate: 0.2, needFold: true },
  5: { players: [6, 9], minPots: 3, stopAfter: "river", foldRate: 0.25, needFold: true },
};

const LETTERS = "ABCDEFGHI";

export function generateSidePotScenario(level: Level, opts: GenerateOptions = {}): SidePotScenario {
  const rng = opts.rng ?? defaultRng;
  const cfg = SIDEPOT_LEVELS[level];
  let fallback: SidePotScenario | null = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const blinds = pickBlinds(rng, opts.ante);
    const unit = level >= 4 ? blinds.bb / 2 : blinds.bb;
    const n = clampPlayers(opts.players, 3, 9) ?? randInt(rng, cfg.players[0], cfg.players[1]);
    // With 3 players the most is main + 1 side pot (the top stack's excess is returned).
    const minPots = Math.min(cfg.minPots, n - 1);
    // Distinct stacks so all-ins create different levels.
    const stackSet = new Set<number>();
    while (stackSet.size < n) stackSet.add(randInt(rng, 8, 90) * blinds.bb + (level >= 4 ? randInt(rng, 0, 1) * unit : 0));
    const stacks = shuffle([...stackSet], rng);
    const pos = positionNames(n);
    const players: SeatedPlayer[] = stacks.map((stack, i) => ({ id: `S${i}`, name: `Player ${LETTERS[i]}`, position: pos[i], stack }));
    const state = new HandState(players, blinds);
    const preflopPolicy: Policy = {
      allowAllIn: true,
      foldFacing: cfg.foldRate,
      callFacing: 0.35,
      raiseFacing: level >= 4 ? 0.15 : 0,
      allinFacing: 0.6,
      betWhenChecked: 0.3,
      allinWhenChecked: 0.3,
      maxRaisesPerStreet: 6,
      unit,
      keepTwoUntil: "river",
    };
    if (cfg.stopAfter === "preflop") {
      simulate(state, preflopPolicy, rng, "preflop");
    } else {
      // Preflop shoves, then normal postflop betting between players with chips.
      simulate(state, preflopPolicy, rng, "preflop");
      const postPolicy: Policy = { ...preflopPolicy, foldFacing: 0.3, callFacing: 0.45, raiseFacing: 0.1, allinFacing: 0.15, betWhenChecked: 0.5, allinWhenChecked: 0.1, maxRaisesPerStreet: 2 };
      if (!state.finished && state.advanceStreet()) simulate(state, postPolicy, rng, "river");
    }
    const actions = [...state.log];
    const potResult = calculatePot(players, blinds, actions, { settle: false });
    // Antes are dead money in the main pot; side pots are cut from betting contributions only.
    const pots = buildPots(
      players.map((p) => ({ playerId: p.id, amount: potResult.betContributions[p.id], folded: potResult.folded.includes(p.id) })),
      { deadMoney: potResult.anteTotal },
    );
    if (pots.pots.length < minPots) continue;
    const foldedContribution = potResult.folded.some((id) => potResult.betContributions[id] > 0);
    if (cfg.needFold && !foldedContribution && rng() < 0.7) continue;
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
      pots,
      questions,
      skills,
      targetSeconds: 4 + questions.length * 5,
    };
    if (opts.focus && !skills.includes(opts.focus)) {
      fallback ??= scenario;
      continue;
    }
    return scenario;
  }
  if (fallback) return fallback;
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
