# Technical Design Document — NBA Stat Slider ("Estimation Duel")

Working title: **The Range** (placeholder — rename freely)

## 1. Overview

A daily web game inspired by NYT-style puzzles. Each day the player completes
**3 rounds**, each built around a different **stat category** (no repeats
within a day) and an independently chosen **scope** (`career`, `season`, or
`playoffs` — scopes may repeat across the day's 3 rounds). Each round shows
**2 anchor players** plus **N "middle" players** (N = 5 by default,
configurable). The anchors sit at the two ends of a slider with their real
stat values revealed as fixed reference points; the player drags each middle
player onto the slider to estimate where its value falls. Every stat category
has a **fixed slider range width** (e.g. always a 10 PPG span for points,
always 1.5 BPG for blocks), so the anchors are **not necessarily the true
record-holders** for that stat — they're simply the two players whose values
happen to bound that day's fixed-size window, which keeps puzzle difficulty
consistent day to day. Placement uses a **continuous (decimal) scale**, not
discrete slots. Players may spend a **configurable number of hints per
round** (default 3), each of which halves the guessed range for one target
middle player, at a scoring cost. All 3 of the day's rounds are visible and
playable upfront (not unlocked sequentially). After submitting a round,
actual values are revealed and a score is calculated based on placement
accuracy.

Stack choice: **React** (the user is using this project to learn React), with
a lightweight static/serverless backend for data since puzzles are precomputed
daily rather than computed live. Primary data source: **`nba_api`** (see
section 3). No accounts are planned — progress/streaks/history are tracked
**locally** (`localStorage`) only.

## 2. Game Rules & Mechanics

### 2.1 Daily structure
- Each day consists of **3 rounds**, all **visible and playable upfront**
  (not unlocked/revealed sequentially) — the player can tackle them in any
  order.
- Each round uses a **different stat category** (no stat category repeats
  within the same day).
- Each round independently picks one **scope**: `career`, `season`, or
  `playoffs`. Scopes may repeat across the day's 3 rounds (e.g. all 3 rounds
  could be `season`, or any mix).
- Each round has **2 anchor players** (fixed reference points at the two ends
  of the slider) and **N middle players** to place (default `N = 5`,
  configurable via `middlePlayerCount`).

### 2.2 Fixed range size per stat (anchors need not be record-holders)
- Every `StatCategory` defines a fixed **`rangeSize`** — the total width of
  the slider in stat units, independent of which players are chosen that day.
  Examples (tune during data exploration): career/season PPG → 10.0, BPG →
  1.5, APG → 6.0, 3PT% → 8.0, etc.
- Puzzle generation picks a window `[low, low + rangeSize]` for the round,
  then:
  1. Selects an eligible **low anchor** player (uniformly at random from the
     eligible pool); its value defines `low`.
  2. Selects a **high anchor** whose displayed value lies within the
     **leeway** of `low + rangeSize` (compared in display units, e.g.
     tenths): `rangeSize` is a *nominal* width, and each puzzle's real width
     may be up to ±5% off (a 10.0 PPG slider can span 9.5 to 10.5; small
     ranges get at least one display unit, e.g. SPG 0.9 to 1.1). Both anchors
     still sit precisely on the slider's ends, and scoring uses the real
     width. The UI shows the nominal width with a tilde ("Slider spans ~10.0
     PPG"). If no such player exists the generator tries another low anchor.
  3. Selects `N` **middle players** strictly inside the window: the interior
     is split into `N` equal bins and each bin contributes one player where
     possible (so players are spread across the slider), with a minimum
     separation so every displayed value in the round is distinct. A player
     never appears twice in a round, even with different seasons.
- Net effect: anchors are just whichever two players happen to bound that
  day's near-fixed-size window — not necessarily the statistical extremes for
  that category — while every round for a given stat covers roughly the same
  total range, keeping precision/difficulty consistent day to day.
- If no valid window/anchor/middle-player combination is found for a
  stat+scope pick (e.g. sparse data), the generator should retry with a
  different stat, scope, or season before falling back to a wider tolerance.

#### Launch stat categories & starting range sizes
Ten categories. Counting stats are **per-game averages**; the three shooting
percentages are stored in percent points (51.2, not 0.512), and season/playoff
percentages only count players with enough made shots (the NBA's own
leaderboard minimums, scaled for short seasons). `weight` is how often a
category is drawn for a daily round (see 3.3): the classic three dominate, the
rest are an occasional change of pace.

| Stat | `key` | Unit | `rangeSize` | `weight` |
|---|---|---|---|---|
| Points | `ppg` | PPG | 10.0 | 5 |
| Assists | `apg` | APG | 4.0 | 5 |
| Rebounds | `rpg` | RPG | 6.0 | 5 |
| Steals | `spg` | SPG | 1.0 | 2 |
| Blocks | `bpg` | BPG | 1.5 | 2 |
| Three-Pointers Made | `3ptpg` | 3PM/G | 2.0 | 2 |
| Field Goal % | `fgpct` | FG% | 8.0 | 1 |
| 3-Point % | `3ppct` | 3P% | 6.0 | 1 |
| Free Throw % | `ftpct` | FT% | 10.0 | 1 |
| Turnovers | `tovpg` | TOV | 2.0 | 1 |

Turnovers were first recorded in 1977-78, so career turnovers per game only
include players who debuted after that.

### 2.3 Scope & per-player season assignment
- Scope (`career` / `season` / `playoffs`) is uniform for all 7 players
  within a round.
- When scope is `season`: **each player in the round may be assigned a
  different season/year** — e.g. one player's 1996-97 season vs. another's
  2010-11 season — as long as the stat being compared is the same category.
  Not all 7 need share the same year.
- When scope is `playoffs`: same idea — each player may have a different
  playoff year, but all 7 must be drawing from playoff stats (never mixed
  with regular-season or career numbers within the same round).
- When scope is `career`: no season/year needed; career totals/averages are
  used directly.

### 2.4 Player eligibility pool
- For `season` or `playoffs` scope: a player is only eligible for a given
  stat if they rank within the **top `seasonEligibilityCutoff`** (default
  **100**) for that specific stat, in that specific season (or playoff
  year). This filtering happens per season/year, not across all history.
- For `career` scope: a player is only eligible for a given stat if they
  rank within the **top `careerEligibilityCutoff`** (default **500**)
  all-time for that stat (career totals/averages).
- Both cutoffs are **configurable difficulty parameters**, not fixed
  constants: lowering them (e.g. top 25 / top 100) restricts the pool to
  more famous/recognizable players and produces **easier** puzzles; raising
  them (e.g. top 300 / top 1500) pulls in more obscure players and produces
  **harder** puzzles. They can be set per daily puzzle, per difficulty mode,
  or globally.
- This eligibility filtering happens during data ingestion / puzzle
  generation (pre-computed leaderboards), not at runtime.

### 2.5 Hints ("Helps")
- Each round gives the player a **configurable number of hints** to spend
  (`hintsPerRound`, default **3**) — exposed as a config value so it can be
  tuned as a difficulty knob without code changes.
- A hint is applied to **one specific middle player** and **halves the width
  of the guessing range** for that player. Implementation: each hint
  confines the player's marker to a band of the slider (width `0.5^k` after
  `k` hints, nested inside the previous band) that is guaranteed to contain
  the true value; where the truth sits inside the band is derived
  deterministically from the round content, so it is stable across renders
  but never simply centered. Markers are clamped into the band, and the band
  is drawn on the track.
- Hints can be spent multiple times on the **same** player (2nd use halves it
  again, etc.) or spread across different players.
- **Scoring cost:** each hint used reduces the max score obtainable for the
  player it was used on. Re-using a hint on a player that already had one
  costs **more** than spending an unused hint on a fresh player — i.e. the
  penalty escalates faster for stacking hints on a single player than for
  spreading them out. Suggested starting formula — **exact values are
  deferred until after playtesting**:
  ```
  // hintsOnThisPlayer = how many hints have been spent on this specific player (0 to hintsPerRound)
  penaltyMultiplier = 1 - (0.15 * hintsOnThisPlayer + 0.10 * hintsOnThisPlayer^2)
  // e.g. 0 hints -> 1.00x, 1 hint -> 0.75x, 2 hints -> 0.30x, 3 hints -> -0.35x (clamp to a small floor like 0.1x)
  ```
- UI note: "halving the range" needs a visual representation — e.g.
  shading/highlighting the narrower band of the slider that the hint reveals
  around the true value. Exact interaction design is a Phase 3/4 UI task.

### 2.6 Scoring
For each middle player in a round:

```
actual_pct   = (actual_value - low_anchor_value) / rangeSize
user_pct     = user_slider_position          // 0.0 to 1.0, decimal precision
error        = abs(actual_pct - user_pct)
base_score   = round(100 * (1 - error))       // clamp to [0, 100]
player_score = round(base_score * penaltyMultiplier(hintsOnThisPlayer))
```

Round score = sum of the `N` middle-player scores. Daily score = sum of the
3 round scores; the shown maximum is `3 x N x 100` (1,500 by default).

**Discrete scoring:** guesses are scored on the grid of displayed values
(tenths for most stats), not on raw slider pixels. Both the guess and the real
value are rounded to one display unit before `user_pct` / `actual_pct` are
computed, so a marker that reads 2.0 is exactly 2.0 even if the thumb sits a
hair off. Placing a marker snaps it to that grid, and arrow keys move one
displayed unit. The order bonus compares the same rounded values, so two
markers on the same displayed value are a tie and don't earn it.

**Hint cost is shown:** each revealed player card shows the pre-hint score
struck through next to the final one, and the round and day summaries state
how many points hints cost (and the score without them).

**Order bonus (optional extra):** a round earns **+100** if every middle
marker ends up in the exact left-to-right order of the real values (ties in the
guesses don't count). It is never part of the shown maximum, so the total can
exceed it. The UI shows the total including the bonus large, with the
without-bonus points small beside it, and streaks/percentages use the base
score.

## 3. History, Archive & Long-Range Puzzle Generation

### 3.1 Puzzle history / archive
- Every generated `DailyPuzzle` is retained permanently, not overwritten or
  deleted — this naturally forms a browsable **archive** of past puzzles.
- Puzzles are organized on disk as files split by year (see 3.3) plus a
  lightweight **archive index** (`data/puzzles/index.json`) listing every
  available date and its 3 stat categories/scopes, so the UI can build a
  calendar/list view without loading every day's full data.
- The app should let a player **replay any past day's puzzle** for practice,
  kept clearly separate from "today's official score" (mirrors NYT's Wordle
  Archive: browsing/replaying old puzzles doesn't affect streaks).

### 3.2 Personal play history (separate from the puzzle archive)
- In addition to the puzzle content itself, store the **player's own
  results** per day: date, per-round score, hints used per round, daily
  total, completion timestamp.
- This is what powers a personal stats page (win streak, average score,
  score history graph, calendar heatmap), similar to Wordle's stats modal.
- Storage: start with `localStorage` (simple, matches the persistence work
  in the build plan). It has a practical ~5-10MB ceiling, which is unlikely
  to matter until the archive/history grows large (see 3.3's phased
  rollout) — no need to solve this before it's a real problem.
- **IndexedDB, in plain terms (only if/when needed):** it's a storage
  system built into the browser for larger amounts of structured data —
  think of it as a simple local database (key-value records with indexes)
  rather than the plain string-only storage `localStorage` offers. Its
  quota is far larger (often hundreds of MB+, browser-dependent) and it
  won't block the main thread on large reads/writes. The raw browser API is
  a bit clunky (callback/event-based), but a small, well-known wrapper
  library like [`idb`](https://github.com/jakearchibald/idb) makes it feel
  almost identical to `localStorage` (simple `async`/`await` get/set/list
  calls) — it's not inherently "hard," just an extra async layer. Treat it
  as a drop-in upgrade to reach for later, not a decision to make now.

### 3.3 Generating the puzzle archive (start small, scale up later)
- **Don't pre-generate 10 years of puzzles yet.** Prove the concept first
  with a **small batch** (e.g. a few weeks to a couple of months) using the
  current 6 stat categories, and only scale up the horizon once:
  1. The core game loop is actually fun/balanced after playtesting, and
  2. More variety dimensions exist to keep a much larger volume of puzzles
     from feeling repetitive (see below).
- **Additional variety dimensions to add before scaling up** (beyond the 6
  launch stat categories):
  - **More stat categories** (e.g. FG%, 3PT%, minutes, turnovers — see
    Remaining Tuning Items).
  - **Team-restricted player pools** — an optional generator constraint
    that limits the eligible pool to players from a **single team's
    history** (e.g. "only players who ever played for the Lakers"),
    producing a themed round. This is a new optional filter dimension on
    top of the existing stat/scope/season/eligibility filters (2.4) — worth
    designing the eligibility-filtering code to accept an optional
    `teamId` constraint from the start, even if it's unused until this
    expansion lands.
  - Other similar restriction ideas worth keeping in mind for the same
    reason (decade-restricted pools, position-restricted pools, draft-class
    pools) — same mechanism as the team filter, just a different predicate
    over the eligible player pool.
- **Once ready to scale up:** batch-generate a larger horizon (10 years is
  still the eventual target) in one pipeline run rather than one day at a
  time, using the same generator module extended with whichever new
  variety dimensions have been added by then.
- **File layout:** split by year (e.g. `data/puzzles/2025.json`,
  `data/puzzles/2026.json`, ...) instead of one file per day or one giant
  file — keeps individual downloads small and works the same whether the
  archive currently spans two months or ten years.
- **Storage efficiency:** each `PuzzleRound` should reference players by
  `playerId` (+ `season` where relevant) rather than embedding full player
  bios/photos — actual `Player` records are looked up from the shared
  `players.json`, keeping the puzzle files themselves small.
- **Variety / anti-repetition constraints** — even at small scale, avoid
  obvious repeats (see Risks):
  - **Weighted** rotation of the stat categories: each day's 3 distinct
    categories are drawn without replacement using the per-category `weight`
    (2.2) multiplied by a recency damping (a category used yesterday counts
    for 25% of its weight, back to 100% after 4 days). In the shipped
    archive about 90% of days contain at least one of PPG/APG/RPG and about
    half contain two or more; the percentage stats and turnovers together make
    up roughly one round in four.
  - A **cooldown window** (14 days for players, 365 for an anchor pair).
    Cooldowns relax in steps when a round can't be built: first the player
    cooldown is dropped, then the pair cooldown.
  - These constraints are just generator-side bookkeeping (track
    recently-used player/category combos while generating sequentially
    through the date range) — no need for a database, a simple in-memory
    recency map during the batch script run is enough. This becomes more
    important, not less, once the horizon scales up to 10 years.
- **Stats staleness note:** any generated batch is a **snapshot** — career
  stats for currently-active players will keep changing in real life after
  ingestion. Treat it as "frozen as of ingestion date X" rather than trying
  to keep it live; regenerating a fresh batch periodically (e.g. whenever
  new variety dimensions or stat categories are added) naturally refreshes
  this too.

### 3.4 Aggressive caching
Caching applies at every layer of this project, not just "don't call APIs
live from the deployed game":
- **Ingestion layer:** cache raw `nba_api` responses to local files as soon
  as they're fetched, before any processing. Re-running the ingestion
  script should reuse those cached raw responses by default (only re-fetch
  on an explicit `--refresh` flag or similar), so iterating on the
  generation logic never re-hits `nba_api` unnecessarily and stays a good
  citizen of an unofficial, rate-limitable API (see Risks #1).
- **Processed dataset layer:** `players.json` / chunked stat files / puzzle
  archive files are themselves a cache — they're committed/deployed as-is
  and only regenerated when the pipeline is deliberately re-run.
- **Images:** always download and serve player photos from your own
  `/public/images/players/` — never hotlink NBA CDN/Wikipedia URLs directly
  from the deployed app (also see Risks #8 on licensing/attribution).
- **HTTP/CDN caching:** since everything served is static JSON/images, set
  long cache lifetimes (the static host's default long-`max-age` behavior
  for hashed/versioned assets is usually sufficient; no custom cache logic
  needed for MVP).
- **Browser-side caching (later):** a service worker (see Future
  Expansions' PWA item) can cache archive data and images for offline play
  once the app is otherwise stable — not needed for MVP, but the aggressive
  caching approach above makes it a natural, low-effort addition later.

## 4. Infinite Mode

### 4.1 Concept
- A non-daily mode where the player can generate a fresh, random puzzle
  round on demand and **reroll** as many times as they want.
- The player can adjust a **custom configuration** before
  generating/rerolling: stat category (or a pool to randomize from), scope,
  `middlePlayerCount`, `hintsPerRound`, `seasonEligibilityCutoff`,
  `careerEligibilityCutoff`, and optionally override a stat's `rangeSize`.
- Infinite Mode results are **not part of the daily archive** and don't
  affect the daily streak — they're a separate, casual/practice context.
  Whether to save Infinite Mode history locally too is a nice-to-have (see
  Future Expansions), not required for MVP.

### 4.2 Architecture implication: a shared, reusable generation module
Client-side "reroll on demand" requires generating a valid puzzle **without
a backend server**, since this project has none. This means the
puzzle-generation algorithm (window/anchor/middle selection from 2.2,
eligibility filtering from 2.4, variety constraints from 3.3) must be
written as a **pure, isomorphic TypeScript module** — one implementation
used by both:
- The offline **Node batch-generation script** (for the puzzle archive,
  starting small and scaling up over time per 3.3), and
- The **in-browser Infinite Mode generator**, running directly against a
  bundled stats dataset.

This means data **ingestion** (Python, `nba_api`-specific, pulls raw stats)
and puzzle **generation** (pure TypeScript, operates only on already-ingested
JSON) should be kept as two clearly separate stages/codebases — ingestion
doesn't need to be reusable client-side, but generation does.

### 4.3 Shipping data for client-side generation
- The client needs access to the full ingested dataset (players +
  `PlayerStatValue` rows + `leaderboardRank`) to generate new puzzles on the
  fly — not just the small per-day puzzle file.
- To avoid a huge upfront download, **chunk the dataset per stat category**
  (e.g. `data/stats/ppg.json`, `data/stats/bpg.json`, ...) and lazily fetch
  only the chunk(s) needed for the category(s) currently selected in
  Infinite Mode's config.
- Cap/guard the generation algorithm's retry loop (see 2.2) with a maximum
  attempt count so a pathological custom config (e.g. an absurdly high
  eligibility cutoff or tiny `rangeSize` with no valid data) can't freeze the
  browser tab — fail gracefully with a "couldn't generate a puzzle with this
  configuration, try adjusting it" message instead.

## 5. Data Sourcing — research findings

You asked specifically about Basketball-Reference. Summary:

| Source | Free? | Has stats? | Has photos? | Notes |
|---|---|---|---|---|
| **Basketball-Reference (Sports Reference)** | No public API | Yes, extremely rich | Some player images | **No official free API.** Their Terms of Service explicitly restrict automated scraping/bulk downloading without permission. Sports Reference does sell a commercial data license (Stathead/data licensing) — worth contacting them if this becomes a real product, but not something to scrape directly for a hobby project. |
| **balldontlie.io** | Yes (free tier, rate-limited; paid tiers for more) | Player bios, teams, season averages, per-game stats | No | Simple REST API, easiest legal option for stats. Free tier has rate limits and sometimes lags the current season. |
| **stats.nba.com (unofficial)** via the open-source **`nba_api`** Python package | Yes, but unofficial/undocumented | Very rich: career totals, season splits, playoffs, advanced stats | No (stats only) | Widely used by hobby projects; can break without notice; be a polite client (cache results, don't hammer endpoints, set a real User-Agent). |
| **NBA CDN headshots** (`https://cdn.nba.com/headshots/nba/latest/1040x760/{PERSON_ID}.png`) | Yes, publicly reachable | N/A | Yes, current/recent players | Commonly used pattern in fan projects. Coverage is weak for retired/historical players from before the 2000s. |
| **Wikipedia / Wikidata (via Wikipedia REST API)** | Yes, CC-licensed | No | Yes, especially for historical/retired players | Good fallback for old players' portraits; requires attribution per license. |
| **Kaggle "NBA Players stats" datasets** | Yes, free download | Historical career + season stats (static snapshot) | No | Good for bootstrapping a historical dataset; needs periodic manual re-download, not live. |

**Recommendation:** Use `nba_api` (or balldontlie.io if you prefer a
simpler/legally cleaner REST API) for stat ingestion, NBA CDN for current
player headshots, and Wikipedia as a fallback for players missing from the
CDN. Cache everything into your own local dataset — don't call these APIs
live from the deployed game; ingest periodically offline instead. Add an
attribution line in the site footer regardless of source.

**Decision: `nba_api`** is the primary data source going forward. NBA CDN
headshots remain the primary photo source (no Wikipedia fallback was built;
players without a photo get an initials avatar).

**Implementation findings (what actually works):**
- `leagueleaders` started returning an HTML error page, so season/playoff
  leaderboards come from `leaguedashplayerstats` (per-game mode), ranked
  locally per stat. That endpoint only has data from **1996-97 onwards**, so
  the `season` and `playoffs` scopes cover 1996-97 to the last completed
  season; older seasons are a possible later expansion (e.g. via per-player
  `playercareerstats`).
- **Career** scope uses one `alltimeleadersgrids` call (all ~5,000 players'
  totals) divided by games played, for players with at least 400 games.
  Steals/blocks (tracked from 1973-74) and 3PM (from 1979-80) only include
  players who debuted after that point, so their per-game numbers are never
  diluted by untracked games.
- Bios (name, position) come from `playerindex`; `teams` is the list of teams
  seen in the ingested seasons.
- "Qualified" filters keep tiny samples out: at least half of the season's
  maximum games (regular season) or 5 games (playoffs), and 10+ minutes per
  game. Zero-valued stats are dropped.
- Ingest depth: top 150 per season/playoff year and top 750 career, so
  Infinite Mode can raise cutoffs above the 100 / 500 gameplay defaults.

Note on eligibility pools (see 2.4): puzzle generation needs **per-stat
leaderboards/rankings**, not just raw stat values — configurable top-N for a
given season/playoff year, configurable top-M for career. `nba_api` exposes
leaderboard-style endpoints (e.g. `leagueleaders`) that make this
straightforward to compute at ingestion time; balldontlie.io would require
pulling all player-season rows yourself and ranking them locally.

## 6. Data Model

```
Player
  id            string   (stable internal id)
  fullName      string
  photoUrl      string   (locally cached, not hot-linked)
  photoAttribution string (e.g. "NBA.com" or "Wikipedia - CC BY-SA")
  position      string
  teams         string[] (teams played for, for flavor text)
  firstYear     number | null  (start year of first season, e.g. 2003 for 2003-04)
  lastYear      number | null  (start year of last season played)

StatCategory
  key           string   (e.g. "ppg", "bpg", "apg")
  label         string   (display name, e.g. "Points Per Game")
  unit          string   (e.g. "PPG", "BPG", "%")
  decimals      number   (precision for display, e.g. 1)
  rangeSize     number   (fixed slider width in stat units, e.g. 10.0 for PPG)

PlayerStatValue
  playerId          string
  categoryKey        string
  scope              "career" | "season" | "playoffs"
  season             string | null   (null only when scope is "career")
  value              number
  leaderboardRank    number  (this player's rank for this stat+scope+season;
                              compared against the configurable
                              `seasonEligibilityCutoff` / 
                              `careerEligibilityCutoff` for eligibility
                              filtering — see 2.4)

DifficultyConfig
  seasonEligibilityCutoff  number  (default 100 — top-N players eligible for
                                    season/playoffs scope; lower = easier)
  careerEligibilityCutoff  number  (default 500 — top-M players eligible for
                                    career scope; lower = easier)

RoundPlayerSelection
  playerId       string
  season         string | null   (per-player season/year when scope is
                                  "season" or "playoffs")
  value          number          (the real stat value, shipped in the puzzle
                                  file so daily play needs no stat chunks;
                                  hidden in the UI until the round is submitted)
  isAnchor       boolean
  anchorPosition "low" | "high" | null

PuzzleRound
  categoryKey       string
  scope             "career" | "season" | "playoffs"
  rangeSize         number    (copied from StatCategory at generation time)
  lowAnchorValue    number    (hidden until reveal; window = [low, low + rangeSize])
  players           RoundPlayerSelection[]  (2 anchors first, then the
                                              middlePlayerCount middle players
                                              in shuffled display order)
  middlePlayerCount number    (configurable N, default 5)

DailyPuzzle
  date          string (YYYY-MM-DD)
  rounds        [PuzzleRound, PuzzleRound, PuzzleRound]  // 3 distinct stat categories
  seed          string  (for reproducibility/debugging)

PuzzleArchiveIndexEntry
  date          string (YYYY-MM-DD)
  categoryKeys  [string, string, string]  // quick lookup without loading the full year file
  scopes        [string, string, string]

UserRoundResult
  date            string (YYYY-MM-DD)
  roundIndex      number  (0-2)
  categoryKey     string
  score           number
  hintsUsedByPlayer Record<playerId, number>
  guesses           Record<playerId, number>   (submitted slider positions, 0-1)

UserDailyHistoryEntry
  date            string (YYYY-MM-DD)
  roundResults    [UserRoundResult, UserRoundResult, UserRoundResult]
  dailyScore      number
  maxScore        number  (rounds x middle players x 100)
  completedAt     string (ISO timestamp)

InfiniteModeConfig
  categoryKeyPool           string[]  (categories to randomize from)
  scope                     "career" | "season" | "playoffs"
  middlePlayerCount         number
  hintsPerRound             number
  seasonEligibilityCutoff   number
  careerEligibilityCutoff   number
  seasonFrom                number  (first season start year allowed, e.g. 2006
                                     for 2006-07; default = first season in data)
  seasonTo                  number  (last season start year allowed)
  rangeSizeOverrides        Record<categoryKey, number> | null
```

`seasonFrom`/`seasonTo` limit which seasons can appear: single-season and
playoff rows must start inside the range, and career rows keep players whose
careers overlap it (using `Player.firstYear`/`lastYear`). A range covering all
the data means no filtering.

Puzzles are generated **offline** and shipped as static JSON — no need for a
live database or backend server for the MVP. `UserDailyHistoryEntry` records
are generated at runtime in the browser and persisted locally (3.2).

## 7. Architecture

Since this is also a React-learning project, keep the stack simple and add
complexity gradually rather than reaching for everything at once.

- **Frontend:** React + TypeScript via **Vite**. No heavy framework (no
  Next.js needed) since there's no server-rendering requirement for a
  single daily puzzle page.
- **State management:** Start with plain `useState`/`useReducer` in a single
  game component; introduce Context only if/when prop-drilling actually
  becomes painful. Avoid Redux/Zustand for this scope.
- **Styling:** CSS Modules or plain CSS to start (skip Tailwind/UI kits
  initially so the focus stays on learning React fundamentals, not a CSS
  framework's API).
- **Ingestion vs. generation, kept separate (see 4.2):**
  - **Ingestion** (Python + `nba_api`): fetches raw stats/ranks, caches raw
    responses locally before processing (3.4), and outputs
    `data/players.json` and chunked `data/stats/{category}.json` files.
  - **Generation** (pure TypeScript, `src/logic/puzzleGenerator.ts`):
    consumes the ingested JSON and produces `PuzzleRound`s. Reused by:
    - a Node script (run via `tsx`/`ts-node`) that batch-produces the
      puzzle archive (small at first, scaled up later per 3.3), and
    - the React app directly, for Infinite Mode's client-side rerolls.
- **Hosting:** Any static host (GitHub Pages, Netlify, Vercel static export).
  No backend server required — the "daily" rotation is just "load today's
  date's entry from the current year's puzzle file." Step-by-step phone
  testing and deployment instructions are in section 14.
- **Caching:** applied aggressively at every layer — see 3.4 for the full
  breakdown (ingestion response caching, processed dataset caching, local
  image hosting, static asset cache lifetimes, and an optional future
  service-worker layer).
- **Persistence for user progress:** `localStorage` for streaks/personal
  history to start (3.2); IndexedDB (via the `idb` wrapper library) is a
  straightforward upgrade path if/when storage size becomes a real
  constraint — not a concern at MVP scale.

### Folder structure (as built)
The project root is this folder (`NBA-Estimation-Game/`). Data lives in
`public/` so Vite serves it as static files.
```
/data-pipeline/
  config.py                 # stat categories, scopes, qualification filters
  cache_utils.py            # JSON response cache (3.4)
  nba_client.py             # cached, retrying nba_api wrappers
  ingest_stats.py           # -> public/data/players.json, stats/*.json, meta.json
  fetch_photos.py           # headshots for puzzle players -> public/images/players
  generate_daily_batch.ts   # Node 24 runs it directly; imports src/logic/*.ts
/public/
  data/
    players.json  meta.json
    stats/{ppg,apg,spg,bpg,rpg,3ptpg}.json   # lazily loaded by Infinite Mode
    puzzles/index.json, 2026.json, ...        # archive (3.1)
  images/players/{id}.png   # locally hosted headshots
/src/
  types/index.ts            # data model (section 6)
  logic/                    # pure, framework-free, unit-tested
    puzzleGenerator.ts      # window/anchor/middle selection (2.2)
    dailyGenerator.ts       # 3 rounds/day, variety + cooldowns, batches (3.3)
    infiniteMode.ts         # config sanitising + on-demand rounds (4)
    eligibility.ts  scoring.ts  hints.ts  roundScoring.ts  gameState.ts
    puzzleValidation.ts  history.ts  share.ts  lanes.ts  dates.ts  rng.ts
  data/                     # fetch loaders + localStorage wrappers
  hooks/                    # useGame, usePersonalHistory, useAsync, ...
  components/               # RoundBoard, SliderTrack, PlayerCard, DayView,
                            # ArchiveCalendar, StatsView, InfiniteMode, ...
  App.tsx
TDD.md
```

## 8. Testing Strategy

Since scoring correctness matters and is pure logic, write it test-first:

- **Unit tests (Vitest + React Testing Library):**
  - `scoring.ts`: normalize/score functions — test boundary cases (exact
    match, worst case, clamped values, division-by-zero guard when
    `rangeSize` is misconfigured as 0) plus the hint `penaltyMultiplier`
    function (0-3 hints on the same player, escalating penalty).
  - Puzzle generator: window/anchor-selection algorithm (2.2) — verify
    selected anchors + middle players always fall within `[low, low +
    rangeSize]`, respects configurable eligibility pools (2.4), and retries
    sanely when no valid window exists. Property-based tests recommended.
    Include test cases with different `seasonEligibilityCutoff` /
    `careerEligibilityCutoff` values to confirm difficulty scaling works.
  - Puzzle loader/validation: rejects malformed puzzle JSON, handles
    missing categories gracefully, validates a day has exactly 3 rounds with
    distinct `categoryKey`s.
  - Archive integrity: every date in `index.json` has a matching entry in
    its year file; a sample multi-year batch run has no category repeat on
    consecutive days and respects the anchor/player cooldown window (3.3).
  - Infinite Mode generation: given a custom `InfiniteModeConfig`, the
    result respects all constraints; a deliberately impossible config (e.g.
    absurd eligibility cutoffs) hits the retry cap and fails gracefully
    instead of hanging (4.3, Risks #6).
- **Component tests:** Slider renders anchors correctly, drag updates
  position state, hint button narrows the visible range for the targeted
  player, disabled/revealed states render actual values.
- **Integration test:** Full round — load a fixture puzzle, simulate
  placing all N middle markers (with and without hints used), submit, assert
  final score matches expected value. Include a fixture with a non-default
  `middlePlayerCount` to confirm the game isn't hardcoded to 5, and a
  full-day fixture (3 rounds) to confirm daily score aggregation.

## 9. Risks

1. **Unofficial data source** — `nba_api` wraps undocumented
   `stats.nba.com` endpoints with no SLA; endpoints can be rate-limited,
   change shape, or disappear without notice. Mitigation: ingest
   once/offline, cache aggressively, never call live from the deployed app.
2. **Stat staleness for active players** — a pre-generated 10-year archive
   freezes stats as of ingestion date; an active player's career averages
   will keep changing in reality after that. Mitigation: treat the archive
   as a dated snapshot; consider periodic re-ingestion + regeneration of
   only a rolling near-term window rather than the whole archive.
3. **Missing historical stats** — steals and blocks weren't officially
   tracked by the NBA before the 1973-74 season; eligibility pools for
   SPG/BPG must exclude earlier seasons entirely or those rounds will have
   no valid candidates.
4. **Puzzle repetition at scale** — only 6 launch categories × limited
   scopes; a large multi-year archive (~10,950+ rounds for 10 years) risks
   noticeable repeats without enforced variety/cooldown rules (3.3).
   Mitigation: start with a small proof-of-concept batch, and only scale
   the horizon up once additional variety dimensions exist (more stat
   categories, team-restricted pools, etc. — 3.3).
5. **Client bundle size for Infinite Mode** — shipping the full stats
   dataset to the browser risks slow initial loads; must chunk per stat
   category and lazy-load only what's needed (4.3).
6. **Generation algorithm non-termination** — the anchor "near edge"
   search (2.2) could fail to converge for sparse stat+scope+season
   combos, or for pathological custom Infinite Mode configs; must cap
   retries and fail gracefully rather than hang the batch script or freeze
   the browser tab.
7. **Local storage limits** — `localStorage` has a practical ~5-10MB
   ceiling; a decade of personal history plus Infinite Mode results could
   approach it. IndexedDB is the recommended fallback if this becomes a
   real constraint (3.2).
8. **Photo licensing/hotlinking** — NBA CDN and Wikipedia images carry
   usage/attribution terms; cache locally and keep attribution rather than
   relying on live hotlinks that could break or violate terms.
9. **Difficulty balance across stat categories** — a single fixed
   `rangeSize` per stat may not equally challenge across categories (e.g.
   blocks vs. points have very different real-world variance); needs
   per-category playtesting, not just a global pass.
10. **Config validation for Infinite Mode** — if custom configuration is
    ever exposed beyond a trusted single local user (e.g. a future
    shared-link/multiplayer feature), unvalidated extreme parameter values
    could cause excessive client-side computation (a soft DoS on the
    user's own browser tab); validate/clamp config bounds even in
    local-only mode as good practice.

## 10. Future Expansions

- **Accounts + cloud-synced history/leaderboards** — opt-in later, without
  disrupting the local-only MVP.
- **Difficulty presets** ("Rookie" / "All-Star" / "Hall of Fame") mapping
  to pre-tuned eligibility cutoff + `rangeSize` + hint combinations, so
  casual players don't need to touch raw config numbers (Infinite Mode
  could default to presets with an "Advanced" toggle for the raw knobs).
- **Other sports** — the core "fixed-range slider + anchors + hints"
  engine is fairly sport-agnostic; NFL/MLB/soccer stat variants could reuse
  most of the scoring/UI logic behind a swappable data source.
- **Themed puzzles** — e.g. a day themed around a single franchise, draft
  class, or decade, layered on top of the existing generator.
- **Achievements/badges** — "no hints used," "perfect round," "N-day
  streak," etc., building on the personal history data already tracked.
- **Async challenge/share mode** — share a specific seed + config so a
  friend plays the exact same generated round and you can compare scores,
  without needing real-time multiplayer infrastructure.
- **Advanced/hard-mode stat categories** — true shooting %, PER, win
  shares, etc., as an unlockable or "hard mode" expansion once the core 6
  categories are proven out.
- **Saved Infinite Mode history** — optionally let players save notable
  Infinite Mode rounds/scores locally, separate from the daily archive.
- **PWA/offline support** — service worker + cached archive data for
  offline play, useful since most of the content is static JSON already.
- **Localization** — NYT-style games often go multilingual; stat
  labels/UI text would need an i18n pass.

## 11. Step-by-step Build Plan

This plan was originally written for a hand-built, learn-as-you-go
workflow. **Status: Phases 0-12 are implemented and tested; Phase 13 is
intentionally deferred** (the batch script already takes `--start`/`--days`,
so scaling up is a one-line change once the extra variety dimensions exist).
Commands: `npm run ingest`, `npm run generate:puzzles`, `npm run photos`,
`npm run dev`, `npm test`.

Original framing, kept for reference: each phase is broken into small, independently testable steps with
an explicit **checkpoint** — something concrete you should be able to
run/see before moving on. Suggested working pattern per step: write a first
attempt yourself, then ask AI to review it, explain a concept you're unsure
about, or help debug — rather than asking it to produce the implementation
outright.

**Phase 0 — Decisions & setup**
- Data source, launch stat categories, and starting `rangeSize` values are
  set (see 2.2 and 5) — scaffold from there rather than re-deciding.
- Scaffold project: `npm create vite@latest` (React + TypeScript template).
- Decide the personal-history storage mechanism up front: start with
  `localStorage` for MVP, noting IndexedDB as the planned upgrade path
  (3.2, Risks #7).
- *Checkpoint:* empty Vite + React + TypeScript app runs locally
  (`npm run dev`).

**Phase 1 — Data ingestion (Python + `nba_api`, no React yet)**
- Write a small Python script that fetches, for **one** stat category first
  (e.g. PPG), player stat values across career/season/playoffs scopes plus
  their `leagueleaders`-derived `leaderboardRank`.
- Once that works end-to-end for one category, extend to all 6 launch
  categories (PPG, APG, SPG, BPG, RPG, 3PTPG).
- Handle the pre-1973-74 missing steals/blocks data explicitly (Risks #3)
  — exclude those seasons rather than letting them silently produce bad
  data.
- Output `data/players.json` and chunked `data/stats/{category}.json`
  files (4.3).
- *Checkpoint:* you can open the output JSON and manually find a
  recognizable player's known career PPG and confirm it's correct.

**Phase 2 — Shared puzzle-generation module (pure TypeScript, test-first)**
- Implement the window/anchor/middle-player selection algorithm (2.2) and
  eligibility filtering (2.4) as pure functions with no dependency on React
  or Node-specific APIs, so the exact same code can run in a Node script
  and in the browser later.
- Add the variety/cooldown bookkeeping described in 3.3 (recently-used
  category/player tracking) as an explicit parameter (e.g. a "recent
  history" object passed in), not global/hidden state — keeps it testable
  and reusable for both batch generation and Infinite Mode.
- Add a hard retry cap (Risks #6) so an unsatisfiable config fails with a
  clear error/result instead of looping forever.
- Write unit tests first for: valid window/anchor selection, eligibility
  cutoff enforcement, variety constraint enforcement, and the retry-cap
  failure path.
- *Checkpoint:* calling the generator function directly (e.g. from a test
  or a scratch script) with a small fixture dataset produces a valid,
  inspectable `PuzzleRound` object.

**Phase 3 — Batch-generate a proof-of-concept puzzle archive (Node script)**
- Write a Node/TypeScript script (`tsx` or `ts-node`) that imports the
  shared generator from Phase 2 and produces a **small initial batch**
  (e.g. a few weeks to a couple of months) of `DailyPuzzle`s, split into
  per-year files (3.3), plus the `index.json` archive index.
- Deliberately **don't** generate the full 10-year horizon yet — that's a
  later step (Phase 13) once the concept is validated and more variety
  dimensions exist (more stat categories, team-restricted pools, etc.).
- *Checkpoint:* running the script produces a small run of daily puzzle
  files, and spot-checking them shows no obviously repeated anchor pairs
  nearby.

**Phase 4 — Scoring logic (pure TypeScript, test-first)**
- Write `scoring.ts` (including the hint `penaltyMultiplier` function) and
  its unit tests before any UI exists.
- *Checkpoint:* tests pass for a hand-computed example (known actual
  value, known guess, known hint count → known expected score).

**Phase 5 — Static React UI for one round (learn: components, props, JSX)**
- Render 2 anchor `PlayerCard`s + N (default 5) middle `PlayerCard`s and a
  non-interactive slider bar from a hardcoded single-round fixture. No
  interactivity yet — just layout/props.
- *Checkpoint:* the fixture round renders correctly in the browser with
  real player names/photos from your ingested data.

**Phase 6 — Interactivity (learn: state, events)**
- Make the N middle markers draggable (mouse/touch, or a simple range
  input per marker to start, before attempting freeform drag-and-drop).
- Track marker positions in component state.
- Keep `middlePlayerCount` as a prop/config value so the number of markers
  isn't hardcoded into the component logic.
- *Checkpoint:* you can drag every middle marker to any position and see
  its state update (e.g. log it to the console).

**Phase 7 — Hints (learn: derived state, conditional rendering)**
- Add a hint button per middle player; track `hintsOnThisPlayer` count in
  state, capped at `hintsPerRound` total across all players in the round.
- Visually narrow the guessing range shown for a player each time a hint
  is used on them (halving logic).
- Wire the hint count into `scoring.ts`'s penalty calculation on submit.
- *Checkpoint:* using hints visibly narrows a player's guess band, and the
  final score reflects the penalty correctly.

**Phase 8 — Multi-round day flow (learn: hooks, effects, conditional rendering)**
- `useDailyPuzzle` hook to load the correct file for today's date from the
  batch-generated archive (Phase 3), pulling out that day's 3 rounds.
- Render all 3 rounds simultaneously (visible/playable upfront, in any
  order); track each round's submission state independently and sum into
  a running daily score.
- *Checkpoint:* loading the app on a given date shows exactly 3 distinct
  rounds, each individually submittable, with a correct combined daily
  score once all 3 are done.

**Phase 9 — Personal history & persistence (learn: side effects, storage)**
- Store today's completion/score in `localStorage`; prevent replay of
  "today's official" attempt (practice/archive replays are separate — see
  Phase 11).
- Track a streak counter and a history array of past results (3.2).
- *Checkpoint:* refreshing the page preserves today's completed state and
  the streak count persists across sessions.

**Phase 10 — Archive/history UI**
- Build a calendar or list view sourced from `data/puzzles/index.json`
  (3.1) letting the player pick any past date to view/replay that day's
  puzzle, clearly marked as practice (not affecting streak).
- Build a personal stats view (score history, streak, average score) from
  the data tracked in Phase 9.
- *Checkpoint:* you can browse to an arbitrary past date, replay it, and
  confirm it doesn't alter today's streak/official score.

**Phase 11 — Infinite Mode**
- Build a configuration panel exposing: stat category (or pool), scope,
  `middlePlayerCount`, `hintsPerRound`, `seasonEligibilityCutoff`,
  `careerEligibilityCutoff`, and optional `rangeSize` overrides (4.1).
- Wire a "Generate/Reroll" button to call the **shared generator module**
  from Phase 2 directly in the browser, against the lazily-loaded, chunked
  stat dataset (4.3).
- Handle the "no valid puzzle found for this config" failure path
  gracefully (surfaced from the generator's retry cap).
- *Checkpoint:* changing the config and rerolling produces a genuinely new,
  playable round without a page reload or backend call.

**Phase 12 — Polish**
- Results/share card (copyable text summary, no images needed to share).
- Responsive/mobile styling, accessibility pass (labels, keyboard-operable
  slider).

**Phase 13 — Scale up & automate (optional, later)**
- Once the core loop is validated by playtesting, add the additional
  variety dimensions from 3.3 (more stat categories, team-restricted player
  pools, etc.) before generating a much larger horizon.
- Re-run the Phase 3 batch script with the expanded generator to produce
  the full ~10-year archive.
- Optionally add a scheduled job (e.g. GitHub Actions cron) to keep
  extending the archive further into the future over time, and/or
  periodically re-ingest + regenerate a rolling near-term window to keep
  active players' stats reasonably fresh (Risks #2).

## 12. Decisions Made

- **Data source:** `nba_api`.
- **Launch stat categories:** PPG, APG, SPG, BPG, RPG, 3PTPG (see table in
  2.2 for starting `rangeSize` guesses).
- **Hints:** configurable per round via `hintsPerRound` (default 3); exact
  penalty-formula constants deferred until after playtesting (2.5).
- **Eligibility cutoffs:** configurable via `seasonEligibilityCutoff`
  (default 100) and `careerEligibilityCutoff` (default 500) — tune these
  down for easier/more-recognizable-player puzzles, or up for harder/more
  obscure ones (2.4).
- **Round presentation:** all 3 daily rounds visible/playable upfront.
- **Accounts:** none planned; progress/streaks are local-only
  (`localStorage`).
- **History/Archive:** every generated puzzle is retained permanently as a
  browsable archive (per-year files + index); personal play history is
  stored locally (`localStorage` for MVP, IndexedDB via the `idb` wrapper
  library as the upgrade path if/when needed) (3.1, 3.2).
- **Archive generation is phased:** a small proof-of-concept batch first;
  the full ~10-year horizon is generated later, only after the concept is
  validated and more variety dimensions (extra stats, team-restricted
  pools, etc.) are added (3.3).
- **Caching is aggressive at every layer:** cached raw ingestion responses,
  cached processed datasets, locally-hosted images, long static-asset cache
  lifetimes, with an optional service-worker layer later (3.4).
- **Infinite Mode:** implemented via a shared, isomorphic TypeScript
  generation module usable both by the Node batch script and directly
  in-browser against a chunked, lazily-loaded stats dataset — no backend
  required (4.2, 4.3).
- **Season/playoff coverage:** 1996-97 onward (endpoint limit); career scope
  is all-time (section 5).
- **Anchors sit on the slider ends, width has leeway:** both anchors are the
  exact ends of the slider, whose width is the nominal `rangeSize` ±5%
  (shown as "~10.0"); the middle players are spread across the window and
  never share a displayed value (2.2).
- **Practice vs. official:** only today's puzzle (Daily tab) counts toward
  history, streaks and stats. Archive replays are saved separately (progress
  plus a practice result shown as a marker on the calendar, with a "play
  again" option) but are never counted. In-progress daily state (placements
  and hints) is persisted so a refresh can't be used to reset hints (3.2).
- **Stats tab sections:** Daily (official results: streaks, averages,
  heatmap), Archive (saved replays: days replayed, averages, order bonuses)
  and Infinite (every finished round is saved, newest 500 kept, with
  accuracy by stat and by scope). Percentages are placement points as a share
  of each round's own maximum, so rounds of different sizes compare fairly;
  order bonuses are counted separately.
- **Scope mix and recency in the daily:** each round's scope is drawn with
  weights career 4 / single season 4 / playoffs 2, so playoff rounds are
  about half as common as the others. Season rows (and careers still active
  in that window) from the latest 20 seasons are 2x as likely to be picked as
  older ones: in the shipped archive about 79% of season/playoff entries are
  from 2006-07 or later (67% if uniform), and earlier eras still appear.
- **Round type is always visible:** every round shows a colour-coded badge
  (Career / Single Season / Playoff Run) with a one-line explanation, the
  round tabs carry the badge, and each player's line says what their number
  refers to ("Career", "2016-17" or "2016-17 playoffs").
- **Archive immutability:** the batch script never regenerates an existing
  date; it only fills missing dates and rebuilds cooldown history from disk.
- **Hint-free reward (official daily only):** a round finished without hints
  gets a gold "No hints used" chip and a gold star on its tab; a day with no
  hints at all gets a gold "Hint-free day" frame on the results panel and a
  gold corner on its archive cell. Practice replays never show these.
- **Archive calendar shows results:** each played day shows its score in the
  cell (tier colour for official play). Practice-only days show the score in
  desaturated colours with a dotted outline; the day detail lists the official
  and practice results separately with short tidbits from `describeDay` (exact
  orders, hints, best round, verdict). Practice results use muted colours
  everywhere (round summary, score chips, results panel, tabs).
- **Score animation:** when a round or the day is finished on screen, the big
  score counts up and the +100 order bonus lands afterwards (gold pop, glow and
  shine when earned; a muted, struck-through "Order bonus missed" with a small
  wobble when not). Nothing animates when a finished round or day is reopened,
  or when the user prefers reduced motion.
- **Photos:** only players that appear in generated puzzles get a downloaded
  headshot; everyone else gets an initials avatar.

## 13. Remaining Tuning Items (non-blocking)

- Validate/adjust the starting `rangeSize` guesses per stat. Checked against
  the ingested data: every category has plenty of exact-width windows for
  all three scopes, so the starting values were kept; SPG (1.0) is the
  tightest because only 10 distinct tenths fit in the window.
- Tune the hint `penaltyMultiplier` constants after playtesting (2.5).
- Decide whether to add more stat categories beyond the launch 6 later
  (e.g. FG%, 3PT%, minutes) once the pipeline is proven out.
- Tune the variety/cooldown window length (3.3) once real batch output can
  be spot-checked for repetition, and again once the horizon scales up.
- Design/prioritize the team-restricted (and similar decade/position/draft-
  class-restricted) pool filters as a scaling-up prerequisite (3.3).
- Decide the exact dataset chunking granularity for Infinite Mode (per
  stat category vs. finer) based on real measured payload sizes (4.3).
- Decide if/when to migrate personal history storage from `localStorage`
  to IndexedDB (3.2, Risks #7) — not urgent given the phased archive
  rollout.

## 14. Phone Testing & Deployment

The app is a static site (HTML/JS/CSS plus JSON and images), so testing on a
phone and publishing are both just "serve the files".

### 14.1 Test on your phone over the local network
1. Phone and PC on the same Wi-Fi (guest networks often isolate devices and
   will block this).
2. Start the dev server so it listens on the network, not just `localhost`:
   `npm run dev:lan` (same as `vite --host`).
3. Vite prints a `Network:` URL such as `http://192.168.1.23:5173/`; or find
   the PC's address with `ipconfig` (the IPv4 address of the Wi-Fi adapter).
   Open that URL in the phone's browser.
4. On Windows, the first run shows a firewall prompt for Node.js: allow it on
   **Private** networks. If the page won't load, check that the network
   profile is "Private" and that no VPN is intercepting traffic.
5. To test the real production bundle instead of the dev server:
   `npm run build` then `npm run preview:lan` (serves `dist/` on
   `http://<PC-IP>:4173/`).

Things to know while testing this way:
- `localStorage` is per origin, so the phone starts with an empty history and
  streak; nothing syncs with the PC (by design, there are no accounts).
- Plain `http://<ip>` is not a "secure context", so the browser's Clipboard
  API is blocked. The Copy results button falls back to a hidden-textarea
  copy, which works on most phones; if a browser still refuses it shows
  "Copy failed". The deployed site uses https, so this only affects LAN
  testing.
- A quick way to see the site from outside your network without deploying is a
  tunnel (e.g. `npx localtunnel --port 5173` or Cloudflare Tunnel); treat the
  URL as public while it runs.

### 14.2 Before publishing: what gets deployed
- Only the output of `npm run build` (`dist/`) is deployed. The Python
  pipeline and the Node batch script are **not** run on the host; run them
  locally and commit their output (`public/data/**`, `public/images/**`).
- `vite.config.ts` sets `base: './'`, so the build works at a domain root
  (Vercel) and at a sub-path (`https://<user>.github.io/<repo>/`) with no
  changes. There is no client-side router, so no 404 rewrite rules are needed.
- No environment variables or secrets are required.
- Initialise git **inside `NBA-Estimation-Game/`** so that folder is the
  repository root (otherwise set the host's "root directory" to it):
  `git init`, `git add .`, `git commit -m "Initial commit"`, create an empty
  GitHub repository, then `git remote add origin <url>` and `git push -u
  origin main`. `.gitignore` already excludes `node_modules/`, `dist/`, and
  the pipeline's API cache. The committed data is roughly 10 MB of JSON plus
  the player photos.
- **Keep the archive ahead of the calendar.** The shipped puzzles end on
  2027-12-31; after that the Daily tab shows "No puzzle for this date".
  Extend it well before then (existing dates are never regenerated):
  `npm run generate:puzzles -- --start 2026-09-01 --days 1000` (about
  2029-05; the script accepts up to 4,000 days), then `npm run photos`,
  commit and redeploy. Each year file is loaded whole when that year's puzzle
  is opened (about 0.8 MB uncompressed for a full year, far less gzipped).
- **Photos and licensing:** the headshots come from NBA.com's public CDN. That
  is fine for local development, but review their terms before making a
  public site (Risks #8); the fallback is deleting `public/images/players/`,
  which makes every player an initials avatar, with no code changes.

### 14.3 Vercel
1. Push the repository to GitHub (14.2).
2. On vercel.com choose **Add New, Project**, import the repository.
3. Settings are auto-detected: Framework Preset **Vite**, Build Command
   `npm run build`, Output Directory `dist`, Install Command `npm install`.
   If the repository root is the parent folder, set **Root Directory** to
   `NBA-Estimation-Game`.
4. Click **Deploy**. Every later push to `main` redeploys automatically and
   pull requests get preview URLs. A custom domain can be added under
   Project Settings, Domains.
5. CLI alternative: `npx vercel` in the project folder (first run links the
   project), then `npx vercel --prod`.

Vercel serves the hashed JS/CSS with long cache lifetimes and everything else
with revalidation, which is what this app wants (a changed puzzle file is
picked up on the next load).

### 14.4 GitHub Pages
1. Push the repository to GitHub (14.2).
2. In the repository, Settings, Pages, set **Source** to **GitHub Actions**.
3. Add `.github/workflows/deploy.yml` (at the repository root, i.e. inside
   `NBA-Estimation-Game/` if that is the repo root):

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

4. Push. The site appears at `https://<user>.github.io/<repo>/` after the
   workflow finishes (Actions tab). If the repository is a monorepo, add
   `defaults: run: working-directory: NBA-Estimation-Game` to the build job
   and point `path:` at `NBA-Estimation-Game/dist`.

`npm test` is in the pipeline on purpose: it includes the archive integrity
tests, so a broken or malformed puzzle file blocks the deploy.

### 14.5 Optional: keep the archive growing automatically
A scheduled workflow (Phase 13) can run `node data-pipeline/generate_daily_batch.ts
--days 365`, commit any new puzzle files, and let the normal deploy workflow
publish them. It needs no Python or API access because it only reads the
already-committed stats. Re-ingesting stats (`npm run ingest`) stays a manual,
occasional step because it calls the unofficial NBA API.

