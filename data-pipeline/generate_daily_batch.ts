// Phase 3: batch-generate the puzzle archive from the ingested dataset.
//
//   node data-pipeline/generate_daily_batch.ts [--start 2026-09-01] [--days 180] [--seed the-range-v1]
//
// Existing puzzles are never regenerated (TDD.md 3.1): only missing dates in
// the range are added, with cooldown history rebuilt from what is already on disk.

import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  addDays,
  dayIndexOf,
  emptyHistory,
  generateDailyPuzzle,
  recordPuzzle,
  toIndexEntry,
} from '../src/logic/dailyGenerator.ts'
import { validateDailyPuzzle } from '../src/logic/puzzleValidation.ts'
import {
  CATEGORY_KEYS,
  type DailyPuzzle,
  type Dataset,
  type Player,
  type PlayerStatValue,
} from '../src/types/index.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = join(ROOT, 'public', 'data')
const PUZZLE_DIR = join(DATA_DIR, 'puzzles')

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 2) args.set(argv[i].replace(/^--/, ''), argv[i + 1])
  const start = args.get('start') ?? '2026-09-01'
  const days = Number(args.get('days') ?? 180)
  const seed = args.get('seed') ?? 'the-range-v1'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error(`Invalid --start: ${start}`)
  if (!Number.isInteger(days) || days < 1 || days > 4000) throw new Error(`Invalid --days: ${days}`)
  return { start, days, seed }
}

function loadDataset(): Dataset {
  const players: Record<string, Player> = {}
  for (const player of readJson<Player[]>(join(DATA_DIR, 'players.json'))) players[player.id] = player

  const stats: Dataset['stats'] = {}
  for (const key of CATEGORY_KEYS) {
    stats[key] = readJson<PlayerStatValue[]>(join(DATA_DIR, 'stats', `${key}.json`))
  }
  return { players, stats }
}

function loadExistingPuzzles(): Map<string, DailyPuzzle> {
  const puzzles = new Map<string, DailyPuzzle>()
  if (!existsSync(PUZZLE_DIR)) return puzzles
  for (const file of readdirSync(PUZZLE_DIR)) {
    if (!/^\d{4}\.json$/.test(file)) continue
    for (const raw of readJson<unknown[]>(join(PUZZLE_DIR, file))) {
      const puzzle = validateDailyPuzzle(raw)
      puzzles.set(puzzle.date, puzzle)
    }
  }
  return puzzles
}

function writeArchive(puzzles: Map<string, DailyPuzzle>) {
  mkdirSync(PUZZLE_DIR, { recursive: true })
  const sorted = [...puzzles.values()].sort((a, b) => a.date.localeCompare(b.date))

  const byYear = new Map<string, DailyPuzzle[]>()
  for (const puzzle of sorted) {
    const year = puzzle.date.slice(0, 4)
    byYear.set(year, [...(byYear.get(year) ?? []), puzzle])
  }
  for (const [year, yearPuzzles] of byYear) {
    writeFileSync(join(PUZZLE_DIR, `${year}.json`), JSON.stringify(yearPuzzles))
  }
  writeFileSync(join(PUZZLE_DIR, 'index.json'), JSON.stringify(sorted.map(toIndexEntry)))
}

const { start, days, seed } = parseArgs(process.argv.slice(2))
const dataset = loadDataset()
const puzzles = loadExistingPuzzles()

let history = emptyHistory()
const datesToGenerate = Array.from({ length: days }, (_, i) => addDays(start, i)).filter(
  (date) => !puzzles.has(date),
)
const firstNewDay = datesToGenerate.length > 0 ? dayIndexOf(datesToGenerate[0]) : Infinity
for (const puzzle of [...puzzles.values()].sort((a, b) => a.date.localeCompare(b.date))) {
  if (dayIndexOf(puzzle.date) < firstNewDay) {
    history = recordPuzzle(history, puzzle.rounds, dayIndexOf(puzzle.date))
  }
}

for (const date of datesToGenerate) {
  const result = generateDailyPuzzle(dataset, date, seed, history)
  validateDailyPuzzle(result.puzzle)
  puzzles.set(date, result.puzzle)
  history = result.history
}

writeArchive(puzzles)
console.log(
  `Generated ${datesToGenerate.length} new puzzle(s); archive now holds ${puzzles.size} day(s) in ${PUZZLE_DIR}`,
)
