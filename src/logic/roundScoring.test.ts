import { describe, expect, it } from 'vitest'
import { makeRound } from '../test/roundFixture.ts'
import { guessUnits, isOrderCorrect, scoreRound, snapPosition } from './roundScoring.ts'

const round = makeRound() // ppg, window 20.0-30.0; a = 22.5, b = 25.0, c = 28.0

describe('discrete scoring', () => {
  it('rewards a guess that rounds to the exact displayed value in full', () => {
    // 22.46 displays as 22.5, so a slider a hair off still counts as exact.
    const scored = scoreRound(round, { positions: { a: 0.246, b: 0.5, c: 0.8 }, hints: {} })
    expect(scored.playerScores).toEqual({ a: 100, b: 100, c: 100 })
  })

  it('scores a one-tenth miss as a one-tenth miss', () => {
    const scored = scoreRound(round, { positions: { a: 0.26, b: 0.5, c: 0.8 }, hints: {} })
    expect(scored.playerScores.a).toBe(99)
  })

  it('snaps positions to the displayed grid inside the slider', () => {
    expect(guessUnits(round, 0.2468)).toBe(225)
    expect(snapPosition(round, 0.2468)).toBeCloseTo(0.25, 10)
    expect(snapPosition(round, -0.2)).toBe(0)
    expect(snapPosition(round, 1.4)).toBe(1)
  })

  it('does not treat two markers on the same displayed value as correctly ordered', () => {
    expect(isOrderCorrect(round, { a: 0.5, b: 0.504, c: 0.9 })).toBe(false)
    expect(isOrderCorrect(round, { a: 0.5, b: 0.51, c: 0.9 })).toBe(true)
  })
})

describe('hint penalties in a scored round', () => {
  it('reports the score without hints and what the hints cost', () => {
    // a at 0.5 is 25 off on a 100-point scale: 75 base, x0.75 for one hint = 56.
    const scored = scoreRound(round, { positions: { a: 0.5, b: 0.5, c: 0.8 }, hints: { a: 1 } })
    expect(scored.playerBaseScores.a).toBe(75)
    expect(scored.playerScores.a).toBe(56)
    expect(scored.hintPenalty).toBe(19)
    expect(scored.total).toBe(56 + 100 + 100)
  })

  it('has no penalty when no hints are used', () => {
    const scored = scoreRound(round, { positions: { a: 0.5, b: 0.5, c: 0.8 }, hints: {} })
    expect(scored.hintPenalty).toBe(0)
    expect(scored.playerBaseScores).toEqual(scored.playerScores)
  })
})
