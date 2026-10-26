import { describe, expect, it } from 'vitest'
import { makeDataset } from '../test/fixtures.ts'
import {
  DEFAULT_DAILY_CONFIG,
  addDays,
  dayIndexOf,
  emptyHistory,
  generateBatch,
  generateDailyPuzzle,
  toIndexEntry,
} from './dailyGenerator.ts'
import { validateDailyPuzzle } from './puzzleValidation.ts'
import { CATEGORY_KEYS } from '../types/index.ts'

describe('date helpers', () => {
  it('computes day indexes and adds days across month boundaries', () => {
    expect(dayIndexOf('1970-01-02') - dayIndexOf('1970-01-01')).toBe(1)
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('generateDailyPuzzle', () => {
  const dataset = makeDataset({ playerCount: 150, step: 0.1 })
  const config = {
    ...DEFAULT_DAILY_CONFIG,
    eligibility: { seasonEligibilityCutoff: 150, careerEligibilityCutoff: 150 },
    playerCooldownDays: 3,
  }

  it('creates 3 valid rounds with distinct categories', () => {
    const { puzzle } = generateDailyPuzzle(dataset, '2026-10-23', 'seed', emptyHistory(), config)
    expect(puzzle.rounds).toHaveLength(3)
    expect(new Set(puzzle.rounds.map((r) => r.categoryKey)).size).toBe(3)
    expect(() => validateDailyPuzzle(puzzle)).not.toThrow()
  })

  it('is deterministic for a date + seed', () => {
    const a = generateDailyPuzzle(dataset, '2026-10-23', 'seed', emptyHistory(), config)
    const b = generateDailyPuzzle(dataset, '2026-10-23', 'seed', emptyHistory(), config)
    expect(a.puzzle).toEqual(b.puzzle)
  })

  it('does not reuse a player within a single day', () => {
    const { puzzle } = generateDailyPuzzle(dataset, '2026-10-23', 'seed', emptyHistory(), config)
    const ids = puzzle.rounds.flatMap((round) => round.players.map((p) => p.playerId))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('does not mutate the history passed in', () => {
    const history = emptyHistory()
    generateDailyPuzzle(dataset, '2026-10-23', 'seed', history, config)
    expect(history).toEqual(emptyHistory())
  })
})

describe('generateBatch', () => {
  const dataset = makeDataset({ playerCount: 400, step: 0.1, startValue: 1 })
  const config = {
    ...DEFAULT_DAILY_CONFIG,
    eligibility: { seasonEligibilityCutoff: 400, careerEligibilityCutoff: 400 },
    playerCooldownDays: 3,
    anchorPairCooldownDays: 30,
  }
  const puzzles = generateBatch(dataset, '2026-10-01', 30, 'batch-seed', config)

  it('produces consecutive dates', () => {
    expect(puzzles.map((p) => p.date)).toEqual(Array.from({ length: 30 }, (_, i) => addDays('2026-10-01', i)))
  })

  it('rotates categories: back-to-back overlap stays at or below chance (1.5 of 3)', () => {
    let overlap = 0
    for (let i = 1; i < puzzles.length; i++) {
      const previous = new Set(puzzles[i - 1].rounds.map((r) => r.categoryKey))
      overlap += puzzles[i].rounds.filter((r) => previous.has(r.categoryKey)).length
    }
    expect(overlap / (puzzles.length - 1)).toBeLessThanOrEqual(1.5)
  })

  it('favours the classic stats while still rotating in the rarer ones', () => {
    const long = generateBatch(dataset, '2026-10-01', 150, 'weights-seed', config)
    const core = new Set(['ppg', 'apg', 'rpg'])
    const coreCounts = long.map((p) => p.rounds.filter((r) => core.has(r.categoryKey)).length)

    expect(coreCounts.filter((count) => count >= 1).length / long.length).toBeGreaterThanOrEqual(0.8)
    expect(coreCounts.reduce((a, b) => a + b, 0) / long.length).toBeGreaterThan(1.3)

    const used = new Map<string, number>()
    for (const puzzle of long) {
      for (const round of puzzle.rounds) used.set(round.categoryKey, (used.get(round.categoryKey) ?? 0) + 1)
    }
    expect(used.size).toBe(CATEGORY_KEYS.length)
    expect(used.get('ppg')!).toBeGreaterThan(used.get('tovpg')! * 2)
  })

  it('respects the player cooldown', () => {
    const lastSeen = new Map<string, number>()
    puzzles.forEach((puzzle, day) => {
      for (const round of puzzle.rounds) {
        for (const player of round.players) {
          const last = lastSeen.get(player.playerId)
          if (last !== undefined) expect(day - last).toBeGreaterThanOrEqual(config.playerCooldownDays)
          lastSeen.set(player.playerId, day)
        }
      }
    })
  })

  it('never repeats an anchor pair inside the pair cooldown', () => {
    const seen = new Set<string>()
    for (const puzzle of puzzles) {
      for (const round of puzzle.rounds) {
        const key = [round.players[0].playerId, round.players[1].playerId].sort().join('|')
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
  })

  it('builds index entries that mirror the puzzle', () => {
    const entry = toIndexEntry(puzzles[0])
    expect(entry.date).toBe(puzzles[0].date)
    expect(entry.categoryKeys).toEqual(puzzles[0].rounds.map((r) => r.categoryKey))
    expect(entry.scopes).toEqual(puzzles[0].rounds.map((r) => r.scope))
  })
})

describe('generateDailyPuzzle failure', () => {
  it('throws a clear error when the dataset cannot support a puzzle', () => {
    const tiny = makeDataset({ playerCount: 5 })
    expect(() => generateDailyPuzzle(tiny, '2026-10-23', 'seed', emptyHistory())).toThrow(/Could not generate/)
  })
})
