import { describe, expect, it } from 'vitest'
import {
  actualPercent,
  baseScore,
  maxRoundScore,
  penaltyMultiplier,
  playerScore,
  sumScores,
} from './scoring.ts'

describe('penaltyMultiplier', () => {
  it('escalates faster when hints are stacked on one player', () => {
    expect(penaltyMultiplier(0)).toBe(1)
    expect(penaltyMultiplier(1)).toBeCloseTo(0.75)
    expect(penaltyMultiplier(2)).toBeCloseTo(0.3)
    // 1 - (0.45 + 0.9) is negative, so the floor applies.
    expect(penaltyMultiplier(3)).toBeCloseTo(0.1)
  })

  it('never goes below the floor, even for absurd hint counts', () => {
    expect(penaltyMultiplier(50)).toBeCloseTo(0.1)
  })

  it('treats negative input as zero hints', () => {
    expect(penaltyMultiplier(-2)).toBe(1)
  })
})

describe('actualPercent', () => {
  it('maps the window onto 0..1', () => {
    expect(actualPercent(20, 20, 10)).toBe(0)
    expect(actualPercent(25, 20, 10)).toBe(0.5)
    expect(actualPercent(30, 20, 10)).toBe(1)
  })

  it('rejects a non-positive range instead of dividing by zero', () => {
    expect(() => actualPercent(5, 1, 0)).toThrow(RangeError)
    expect(() => actualPercent(5, 1, -2)).toThrow(RangeError)
  })
})

describe('baseScore', () => {
  it('is 100 for an exact match', () => {
    expect(baseScore(0.42, 0.42)).toBe(100)
  })

  it('loses one point per percent of error', () => {
    expect(baseScore(0.5, 0.6)).toBe(90)
    expect(baseScore(0.5, 0.2)).toBe(70)
  })

  it('is clamped to 0..100', () => {
    expect(baseScore(0, 1)).toBe(0)
    expect(baseScore(0.5, 3)).toBe(0)
    expect(baseScore(0.5, 0.5)).toBe(100)
  })
})

describe('playerScore', () => {
  const window = { lowAnchorValue: 20, rangeSize: 10 }

  it('matches a hand-computed example without hints', () => {
    // actual 27.5 -> 0.75, guess 0.65 -> error 0.10 -> 90
    expect(playerScore({ ...window, actualValue: 27.5, userPercent: 0.65, hintsOnThisPlayer: 0 })).toBe(90)
  })

  it('applies the hint penalty to the base score', () => {
    // base 90 * 0.75 = 67.5 -> 68
    expect(playerScore({ ...window, actualValue: 27.5, userPercent: 0.65, hintsOnThisPlayer: 1 })).toBe(68)
    // base 90 * 0.30 = 27
    expect(playerScore({ ...window, actualValue: 27.5, userPercent: 0.65, hintsOnThisPlayer: 2 })).toBe(27)
  })
})

describe('aggregation', () => {
  it('sums scores', () => {
    expect(sumScores([90, 68, 100])).toBe(258)
    expect(sumScores([])).toBe(0)
  })

  it('computes the maximum round score from the middle player count', () => {
    expect(maxRoundScore(5)).toBe(500)
    expect(maxRoundScore(3)).toBe(300)
  })
})
