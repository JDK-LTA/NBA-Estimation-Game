# The Range

A daily NBA stat-estimation game. Two **anchor** players sit at the ends of a slider with their real numbers shown; place five more players where you think their stat falls. Three rounds a day, each with a different stat (mostly PPG, APG and RPG, with SPG, BPG, 3PM/G, FG%, 3P%, FT% and turnovers as an occasional change of pace) and scope (career, single season, or playoff run). Hints halve a player's range at a scoring cost, and nailing the exact left-to-right order of a round earns an optional +100 bonus on top of the 1,500 maximum. There is also an archive of past puzzles and an Infinite Mode with configurable rounds.

Design details live in [TDD.md](TDD.md).

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm test           # unit + component tests (Vitest)
npm run build      # type-check + production build into dist/
```

The app is fully static: puzzles and stats are pre-generated JSON in `public/data`, and progress is stored in `localStorage`.

## Refresh the data

Requires Python 3 (`py` launcher on Windows) and `pip install -r data-pipeline/requirements.txt`.

```
npm run ingest             # nba_api -> public/data/players.json + stats/*.json (cached in data-pipeline/.cache)
npm run generate:puzzles   # Node 24 -> public/data/puzzles/*.json   (--start 2027-03-01 --days 90 to extend)
npm run photos             # headshots for players used in puzzles -> public/images/players
```

Existing puzzle dates are never regenerated, so re-running the generator only appends. Pass `--refresh` to `ingest_stats.py` to bypass the API cache.

## Deploy

`npm run build`, then serve `dist/` from any static host. The build uses a relative base path, so sub-path hosting works.
