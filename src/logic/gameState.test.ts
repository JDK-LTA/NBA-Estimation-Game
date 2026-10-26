import { describe, expect, it } from 'vitest'
import {
  buildHistoryEntry,
  canUseHint,
  gameTotal,
  initialGameState,
  isGameComplete,
  placePlayer,
  restoreGameState,
  spendHint,
  submitRound,
} from './gameState.ts'
import { hintBandFor, truePercent } from './roundScoring.ts'
import type { PuzzleRound } from '../types/index.ts'

const makeRound = (categoryKey: PuzzleRound['categoryKey']): PuzzleRound => ({
  categoryKey,
  scope: 'season',
  rangeSize: 10,
  lowAnchorValue: 20,
  middlePlayerCount: 3,
  players: [
    { playerId: 'low', season: '2020-21', value: 20, isAnchor: true, anchorPosition: 'low' },
    { playerId: 'high', season: '2021-22', value: 30, isAnchor: true, anchorPosition: 'high' },
    { playerId: 'a', season: '2019-20', value: 22.5, isAnchor: false, anchorPosition: null },
    { playerId: 'b', season: '2018-19', value: 25, isAnchor: false, anchorPosition: null },
    { playerId: 'c', season: '2017-18', value: 28, isAnchor: false, anchorPosition: null },
  ],
})

const rounds = [makeRound('ppg'), makeRound('apg'), makeRound('rpg')]

describe('placePlayer', () => {
  it('stores the position, clamped to 0..1', () => {
    let state = initialGameState(3)
    state = placePlayer(state, rounds, 0, 'a', 0.4)
    state = placePlayer(state, rounds, 0, 'b', 4)
    state = placePlayer(state, rounds, 0, 'c', -2)
    expect(state.rounds[0].positions).toEqual({ a: 0.4, b: 1, c: 0 })
  })

  it('ignores anchors, unknown players, NaN and submitted rounds', () => {
    const state = initialGameState(3)
    expect(placePlayer(state, rounds, 0, 'low', 0.5)).toBe(state)
    expect(placePlayer(state, rounds, 0, 'nobody', 0.5)).toBe(state)
    expect(placePlayer(state, rounds, 0, 'a', Number.NaN)).toBe(state)
    expect(placePlayer(state, rounds, 9, 'a', 0.5)).toBe(state)
  })

  it('does not mutate the previous state', () => {
    const state = initialGameState(3)
    placePlayer(state, rounds, 0, 'a', 0.4)
    expect(state.rounds[0].positions).toEqual({})
  })
})

describe('hints', () => {
  it('counts hints per player, capped per round', () => {
    let state = initialGameState(3)
    state = spendHint(state, rounds, 0, 'a', 2)
    state = spendHint(state, rounds, 0, 'a', 2)
    expect(state.rounds[0].hints).toEqual({ a: 2 })
    expect(canUseHint(state, 0, 'b', 2)).toBe(false)
    expect(spendHint(state, rounds, 0, 'b', 2)).toBe(state)
    // Other rounds have their own budget.
    expect(canUseHint(state, 1, 'a', 2)).toBe(true)
  })

  it('confines later placements to the hint band, which contains the answer', () => {
    let state = spendHint(initialGameState(3), rounds, 0, 'b', 3)
    const band = hintBandFor(rounds[0], rounds[0].players[3], 1)
    state = placePlayer(state, rounds, 0, 'b', 0)
    expect(state.rounds[0].positions.b).toBeCloseTo(band.start)
    state = placePlayer(state, rounds, 0, 'b', 1)
    expect(state.rounds[0].positions.b).toBeCloseTo(band.end)
    expect(truePercent(rounds[0], rounds[0].players[3])).toBeGreaterThanOrEqual(band.start)
    expect(truePercent(rounds[0], rounds[0].players[3])).toBeLessThanOrEqual(band.end)
  })

  it('pulls an already placed marker into the new band', () => {
    let state = placePlayer(initialGameState(3), rounds, 0, 'b', 0)
    state = spendHint(state, rounds, 0, 'b', 3)
    const band = hintBandFor(rounds[0], rounds[0].players[3], 1)
    expect(state.rounds[0].positions.b).toBeGreaterThanOrEqual(band.start - 1e-9)
    expect(state.rounds[0].positions.b).toBeLessThanOrEqual(band.end + 1e-9)
  })

  it('cannot hint anchors or submitted rounds', () => {
    const state = initialGameState(3)
    expect(spendHint(state, rounds, 0, 'low', 3)).toBe(state)
  })
})

describe('submitRound and totals', () => {
  const place = (positions: Record<string, number>, roundIndex: number, state = initialGameState(3)) =>
    Object.entries(positions).reduce(
      (current, [playerId, position]) => placePlayer(current, rounds, roundIndex, playerId, position),
      state,
    )

  it('refuses to submit until every middle player is placed', () => {
    const partial = place({ a: 0.25, b: 0.5 }, 0)
    expect(submitRound(partial, rounds, 0)).toBe(partial)
  })

  it('locks a submitted round', () => {
    let state = place({ a: 0.25, b: 0.5, c: 0.8 }, 0)
    state = submitRound(state, rounds, 0)
    expect(state.rounds[0].submitted).toBe(true)
    expect(placePlayer(state, rounds, 0, 'a', 0.9)).toBe(state)
    expect(spendHint(state, rounds, 0, 'a', 3)).toBe(state)
  })

  it('aggregates the daily score and builds a history entry once all rounds are done', () => {
    let state = initialGameState(3)
    for (let roundIndex = 0; roundIndex < 3; roundIndex++) {
      state = place({ a: 0.25, b: 0.5, c: 0.8 }, roundIndex, state)
      expect(isGameComplete(state)).toBe(false)
      state = submitRound(state, rounds, roundIndex)
    }
    expect(isGameComplete(state)).toBe(true)
    // Perfect guesses in the true order also earn the +100 order bonus per round.
    expect(gameTotal(state, rounds)).toEqual({ score: 900, max: 900, bonus: 300 })

    const entry = buildHistoryEntry('2026-10-23', rounds, state, new Date('2026-10-23T12:00:00Z'))
    expect(entry.dailyScore).toBe(900)
    expect(entry.bonusScore).toBe(300)
    expect(entry.maxScore).toBe(900)
    expect(entry.roundResults.map((r) => r.categoryKey)).toEqual(['ppg', 'apg', 'rpg'])
    expect(entry.roundResults[0].guesses).toEqual({ a: 0.25, b: 0.5, c: 0.8 })
  })

  it('only counts submitted rounds toward the running total', () => {
    let state = place({ a: 0.25, b: 0.5, c: 0.8 }, 0)
    expect(gameTotal(state, rounds).score).toBe(0)
    state = submitRound(state, rounds, 0)
    expect(gameTotal(state, rounds).score).toBe(300)
  })
})

describe('restoreGameState', () => {
  it('round-trips valid saved state', () => {
    let state = placePlayer(initialGameState(3), rounds, 1, 'a', 0.3)
    state = spendHint(state, rounds, 1, 'a', 3)
    const restored = restoreGameState(JSON.parse(JSON.stringify(state)), rounds)
    expect(restored).toEqual(state)
  })

  it('falls back to a fresh state for garbage', () => {
    expect(restoreGameState(null, rounds)).toEqual(initialGameState(3))
    expect(restoreGameState('x', rounds)).toEqual(initialGameState(3))
    expect(restoreGameState({ rounds: [] }, rounds)).toEqual(initialGameState(3))
  })

  it('drops unknown players, bad numbers, and submissions that are incomplete', () => {
    const restored = restoreGameState(
      {
        rounds: [
          { positions: { a: 7, ghost: 0.5, b: 'x' }, hints: { a: 2.5, c: 1 }, submitted: true },
          null,
          { positions: { a: 0.1, b: 0.2, c: 0.3 }, hints: {}, submitted: true },
        ],
      },
      rounds,
    )
    expect(restored.rounds[0]).toEqual({ positions: { a: 1 }, hints: { c: 1 }, submitted: false })
    expect(restored.rounds[1]).toEqual({ positions: {}, hints: {}, submitted: false })
    expect(restored.rounds[2].submitted).toBe(true)
  })
})
