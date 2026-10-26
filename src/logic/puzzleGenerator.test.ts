import { describe, expect, it } from 'vitest'
import { makeDataset } from '../test/fixtures.ts'
import { DEFAULT_DIFFICULTY } from './eligibility.ts'
import { generateRound, type RoundGenerationOptions } from './puzzleGenerator.ts'
import { createRng } from './rng.ts'
import type { Dataset, PuzzleRound } from '../types/index.ts'

const baseOptions: RoundGenerationOptions = {
  categoryKey: 'ppg',
  scope: 'season',
  middlePlayerCount: 5,
  eligibility: DEFAULT_DIFFICULTY,
}

function expectOk(dataset: Dataset, options: Partial<RoundGenerationOptions>, seed: string): PuzzleRound {
  const result = generateRound(dataset, { ...baseOptions, ...options }, createRng(seed))
  if (!result.ok) throw new Error(result.reason)
  return result.round
}

describe('generateRound', () => {
  // 90 players, 2.0 .. 19.8 in 0.2 steps (17.8 wide) so a 10.0 window fits.
  const dataset = makeDataset()

  it('produces a valid window: anchors on the edges, middles strictly inside', () => {
    for (let i = 0; i < 100; i++) {
      const round = expectOk(dataset, {}, `valid-${i}`)
      const [low, high, ...middles] = round.players

      expect(round.nominalRangeSize).toBe(10)
      expect(round.rangeSize).toBeGreaterThanOrEqual(9.5 - 1e-9)
      expect(round.rangeSize).toBeLessThanOrEqual(10.5 + 1e-9)
      expect(low.anchorPosition).toBe('low')
      expect(high.anchorPosition).toBe('high')
      expect(low.value).toBeCloseTo(round.lowAnchorValue, 9)
      expect(high.value).toBeCloseTo(round.lowAnchorValue + round.rangeSize, 9)
      expect(middles).toHaveLength(5)
      for (const middle of middles) {
        expect(middle.isAnchor).toBe(false)
        expect(middle.value).toBeGreaterThan(low.value)
        expect(middle.value).toBeLessThan(high.value)
      }
    }
  })

  it('never repeats a player and never shows two identical values', () => {
    for (let i = 0; i < 100; i++) {
      const round = expectOk(dataset, {}, `unique-${i}`)
      expect(new Set(round.players.map((p) => p.playerId)).size).toBe(7)
      expect(new Set(round.players.map((p) => p.value.toFixed(1))).size).toBe(7)
    }
  })

  it('does not present middle players sorted by value', () => {
    let sortedCount = 0
    for (let i = 0; i < 60; i++) {
      const middles = expectOk(dataset, {}, `order-${i}`).players.slice(2).map((p) => p.value)
      if (middles.every((value, index) => index === 0 || value >= middles[index - 1])) sortedCount++
    }
    expect(sortedCount).toBeLessThan(10)
  })

  it('is reproducible from the same seed', () => {
    expect(expectOk(dataset, {}, 'same')).toEqual(expectOk(dataset, {}, 'same'))
  })

  it('honours a non-default middlePlayerCount', () => {
    const round = expectOk(dataset, { middlePlayerCount: 3 }, 'three')
    expect(round.players).toHaveLength(5)
    expect(round.middlePlayerCount).toBe(3)
  })

  it('honours a rangeSize override', () => {
    const round = expectOk(dataset, { rangeSize: 6 }, 'override')
    expect(round.nominalRangeSize).toBe(6)
    expect(Math.abs(round.rangeSize - 6)).toBeLessThanOrEqual(0.3 + 1e-9)
    expect(round.players[1].value - round.players[0].value).toBeCloseTo(round.rangeSize, 9)
  })

  it('varies the slider width within the leeway, and is exact when leeway is 0', () => {
    const widths = new Set<number>()
    for (let i = 0; i < 80; i++) {
      const round = expectOk(dataset, {}, `leeway-${i}`)
      expect(round.rangeSize).toBeGreaterThanOrEqual(9.5 - 1e-9)
      expect(round.rangeSize).toBeLessThanOrEqual(10.5 + 1e-9)
      widths.add(round.rangeSize)
    }
    expect(widths.size).toBeGreaterThan(2)

    for (let i = 0; i < 20; i++) {
      const exact = expectOk(dataset, { rangeLeeway: 0 }, `exact-${i}`)
      expect(exact.rangeSize).toBe(10)
    }
  })

  it('keeps small ranges workable by allowing at least one display unit of leeway', () => {
    const steals = makeDataset({ playerCount: 80, startValue: 0.5, step: 0.04, categoryKeys: ['spg'] })
    const widths = new Set<number>()
    for (let i = 0; i < 40; i++) widths.add(expectOk(steals, { categoryKey: 'spg' }, `small-${i}`).rangeSize)
    for (const width of widths) {
      expect(width).toBeGreaterThanOrEqual(0.9 - 1e-9)
      expect(width).toBeLessThanOrEqual(1.1 + 1e-9)
    }
  })

  it('enforces the season eligibility cutoff', () => {
    // Rank = 90 - index, so a cutoff of 60 keeps indexes 30+ (values >= 8.0).
    for (let i = 0; i < 40; i++) {
      const round = expectOk(dataset, { eligibility: { ...DEFAULT_DIFFICULTY, seasonEligibilityCutoff: 60 } }, `cut-${i}`)
      expect(round.players.every((p) => p.value >= 7.99)).toBe(true)
    }
  })

  it('uses careerEligibilityCutoff for career scope and leaves season value null', () => {
    const round = expectOk(
      dataset,
      { scope: 'career', eligibility: { ...DEFAULT_DIFFICULTY, careerEligibilityCutoff: 70 } },
      'career',
    )
    expect(round.players.every((p) => p.season === null)).toBe(true)
    expect(round.players.every((p) => p.value >= 5.99)).toBe(true)
  })

  it('respects the optional team restriction', () => {
    const wide = makeDataset({ playerCount: 120 })
    const round = expectOk(wide, { eligibility: { seasonEligibilityCutoff: 120, careerEligibilityCutoff: 120, teamAbbreviation: 'LAL' } }, 'team')
    expect(round.players.every((p) => Number(p.playerId) % 2 === 0)).toBe(true)
  })

  it('skips excluded players and anchor pairs', () => {
    const excluded = new Set(Array.from({ length: 20 }, (_, i) => String(i)))
    const round = expectOk(dataset, { excludedPlayerIds: excluded }, 'excluded')
    expect(round.players.every((p) => !excluded.has(p.playerId))).toBe(true)
  })

  it('fails gracefully (and quickly) when no window can exist', () => {
    // Everyone is within a 2.0 spread, but the window needs 10.0.
    const narrow = makeDataset({ playerCount: 40, step: 0.05 })
    const started = Date.now()
    const result = generateRound(narrow, baseOptions, createRng('impossible'))
    expect(result.ok).toBe(false)
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it('fails with a clear reason when the pool is too small', () => {
    const tiny = makeDataset({ playerCount: 4 })
    const result = generateRound(tiny, baseOptions, createRng('tiny'))
    expect(result).toMatchObject({ ok: false })
  })

  it('caps retries via maxAttempts', () => {
    const narrow = makeDataset({ playerCount: 40, step: 0.05 })
    const result = generateRound(narrow, { ...baseOptions, maxAttempts: 3 }, createRng('cap'))
    expect(result.ok).toBe(false)
  })

  it('rejects invalid middlePlayerCount values', () => {
    expect(generateRound(dataset, { ...baseOptions, middlePlayerCount: 0 }, createRng('x')).ok).toBe(false)
    expect(generateRound(dataset, { ...baseOptions, middlePlayerCount: 2.5 }, createRng('x')).ok).toBe(false)
  })

  it('works for the 1.0-wide steals window where displayed tenths are scarce', () => {
    const steals = makeDataset({ playerCount: 80, startValue: 0.5, step: 0.04, categoryKeys: ['spg'] })
    for (let i = 0; i < 30; i++) {
      const round = expectOk(steals, { categoryKey: 'spg' }, `spg-${i}`)
      expect(new Set(round.players.map((p) => p.value.toFixed(1))).size).toBe(7)
    }
  })
})
