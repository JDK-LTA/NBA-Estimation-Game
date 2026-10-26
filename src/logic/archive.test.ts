import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateDailyPuzzle } from './puzzleValidation.ts'
import {
  CATEGORY_KEYS,
  type DailyPuzzle,
  type Player,
  type PlayerStatValue,
  type PuzzleArchiveIndexEntry,
} from '../types/index.ts'

// Integrity checks against the real, committed archive (TDD.md section 8).
const DATA_DIR = join(process.cwd(), 'public', 'data')
const hasArchive = existsSync(join(DATA_DIR, 'puzzles', 'index.json'))

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, relativePath), 'utf-8')) as T
}

describe.skipIf(!hasArchive)('puzzle archive', () => {
  const index = readJson<PuzzleArchiveIndexEntry[]>('puzzles/index.json')
  const years = [...new Set(index.map((entry) => entry.date.slice(0, 4)))]
  const puzzles = years.flatMap((year) => readJson<unknown[]>(`puzzles/${year}.json`).map(validateDailyPuzzle))
  const byDate = new Map<string, DailyPuzzle>(puzzles.map((puzzle) => [puzzle.date, puzzle]))
  const players = new Map(readJson<Player[]>('players.json').map((player) => [player.id, player]))
  const stats = new Map<string, PlayerStatValue>()
  for (const key of CATEGORY_KEYS) {
    for (const row of readJson<PlayerStatValue[]>(`stats/${key}.json`)) {
      stats.set(`${row.categoryKey}|${row.scope}|${row.season}|${row.playerId}`, row)
    }
  }

  it('has a year-file entry for every index entry, in matching order', () => {
    expect(puzzles).toHaveLength(index.length)
    for (const entry of index) {
      const puzzle = byDate.get(entry.date)
      expect(puzzle, entry.date).toBeDefined()
      expect(puzzle!.rounds.map((r) => r.categoryKey)).toEqual(entry.categoryKeys)
      expect(puzzle!.rounds.map((r) => r.scope)).toEqual(entry.scopes)
    }
  })

  it('covers consecutive dates with no gaps', () => {
    const dates = index.map((entry) => Date.parse(`${entry.date}T00:00:00Z`))
    for (let i = 1; i < dates.length; i++) expect(dates[i] - dates[i - 1]).toBe(86_400_000)
  })

  it('references only known players and real stat rows with matching values', () => {
    for (const puzzle of puzzles) {
      for (const round of puzzle.rounds) {
        for (const selection of round.players) {
          expect(players.has(selection.playerId), selection.playerId).toBe(true)
          const row = stats.get(`${round.categoryKey}|${round.scope}|${selection.season}|${selection.playerId}`)
          expect(row, `${puzzle.date} ${round.categoryKey} ${selection.playerId}`).toBeDefined()
          expect(row!.value).toBe(selection.value)
        }
      }
    }
  })

  it('does not repeat a stat category on back-to-back days more than chance (1.5/3)', () => {
    let overlap = 0
    for (let i = 1; i < index.length; i++) {
      const previous = new Set(index[i - 1].categoryKeys)
      overlap += index[i].categoryKeys.filter((key) => previous.has(key)).length
    }
    expect(overlap / (index.length - 1)).toBeLessThanOrEqual(1.5)
  })

  it('does not repeat an anchor pair anywhere in the archive', () => {
    const pairs = new Set<string>()
    for (const puzzle of puzzles) {
      for (const round of puzzle.rounds) {
        const key = [round.players[0].playerId, round.players[1].playerId].sort().join('|')
        expect(pairs.has(key)).toBe(false)
        pairs.add(key)
      }
    }
  })

  it('keeps players out of the same-role repeat window', () => {
    const cooldown = 7
    const lastSeen = new Map<string, number>()
    puzzles.forEach((puzzle, day) => {
      for (const player of puzzle.rounds.flatMap((round) => round.players)) {
        const last = lastSeen.get(player.playerId)
        if (last !== undefined) expect(day - last, player.playerId).toBeGreaterThanOrEqual(cooldown)
        lastSeen.set(player.playerId, day)
      }
    })
  })

  it('mixes all three scopes and all six categories', () => {
    const scopes = new Set(index.flatMap((entry) => entry.scopes))
    const categories = new Set(index.flatMap((entry) => entry.categoryKeys))
    expect(scopes.size).toBe(3)
    expect(categories.size).toBe(CATEGORY_KEYS.length)
  })
})
