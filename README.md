# NLH Dealer Trainer

A training web app for No-Limit Hold'em dealers: hand reading, winner judgment, pot and side-pot calculation, played from the dealer's seat.
Next.js (static export) + TypeScript + Tailwind CSS + Lucide. No backend; progress is stored in LocalStorage.

```bash
npm install
npm run dev      # http://localhost:3000
npm run test     # engine + stats unit tests (Vitest)
npm run build    # static export → ./out (deploy anywhere)
```

## Architecture

```
src/engine/            Poker rules engine (framework-free, fully unit-tested)
  cards.ts deck.ts shuffle.ts         52-card deck, Fisher–Yates, seeded RNG
  handEvaluator.ts                    7 cards → best 5 (wheel, royal, kickers)
  handComparator.ts                   n-way showdown, returns ALL winners (split-ready)
  bettingEngine.ts                    NLH betting state machine (legal actions only, min-raise, incomplete all-in)
  potCalculator.ts                    independent action-log replay → pot per street, uncalled return
  sidePotCalculator.ts                contribution-based main/side pots, eligibility, odd-chip split
  scenarioGenerator.ts                random scenarios per mode & level; answers derived by the engine
  grading.ts                          answer check, FAST/NORMAL/SLOW, score
  realTable/types.ts                  REAL TABLE MODE design (post-MVP)
src/stats/             Stats schema (schemaVersion), repository interface, aggregations, rating, weakness
src/features/training/ Session controller and the 4 mode views
src/app/               HOME, /train/[mode], /stats
tests/                 Vitest suites
```

Flow (spec §19): **Scenario generation → rules engine computes the answer → user answers → compare → explanation**.
No answers are hard-coded; generator "targets" (e.g. "make a straight") only filter which random deals are kept, and the
answer is always recomputed by the evaluator / calculators.

Conventions: bet/raise amounts are **"to"** amounts (the player's total on that street). MVP uses no ante (the engine supports one).

Storage: `StatsRepository` (LocalStorage implementation) holds a single versioned document (`schemaVersion: 1`); swapping in a Supabase repository only requires implementing `load/save/clear`.

## Playing on a phone

The app is deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push:

**https://sakayamataiji-tech.github.io/nlh-dealer-trainer/**

- One-time setup: repository **Settings → Pages → Build and deployment → Source: "GitHub Actions"**, then re-run the "Deploy to GitHub Pages" workflow (or push any commit).
- On the phone, open the URL and use **Share → Add to Home Screen** (iOS Safari) or **Install app** (Android Chrome); it then launches full-screen like an app.
- Everything runs in the browser; progress is kept in that phone's LocalStorage (it is not shared with other devices).
- Touch devices use the on-screen keypad for POT / SIDE POT (the OS keyboard is suppressed so it never covers the table).

The build reads `PAGES_BASE_PATH` (e.g. `/nlh-dealer-trainer`) for the sub-path; local `npm run dev` / `npm run build` need nothing.
