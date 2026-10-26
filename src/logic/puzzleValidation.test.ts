import { describe, expect, it } from 'vitest'
import { PuzzleValidationError, validateDailyPuzzle, validateRound } from './puzzleValidation.ts'

const player = (playerId: string, value: number, anchor: 'low' | 'high' | null = null) => ({
  playerId,
  season: '2023-24',
  value,
  isAnchor: anchor !== null,
  anchorPosition: anchor,
})

const round = (categoryKey: string) => ({
  categoryKey,
  scope: 'season',
  rangeSize: 10,
  lowAnchorValue: 10,
  middlePlayerCount: 3,
  players: [
    player(`${categoryKey}-a`, 10, 'low'),
    player(`${categoryKey}-b`, 20, 'high'),
    player(`${categoryKey}-c`, 12.5),
    player(`${categoryKey}-d`, 15),
    player(`${categoryKey}-e`, 18.1),
  ],
})

const puzzle = () => ({
  date: '2026-10-23',
  seed: 's',
  rounds: [round('ppg'), round('apg'), round('rpg')],
})

describe('validateDailyPuzzle', () => {
  it('accepts a well-formed puzzle', () => {
    expect(validateDailyPuzzle(puzzle()).rounds).toHaveLength(3)
  })

  it('rejects non-objects and bad dates', () => {
    expect(() => validateDailyPuzzle(null)).toThrow(PuzzleValidationError)
    expect(() => validateDailyPuzzle({ ...puzzle(), date: '10/23/2026' })).toThrow(/date/)
  })

  it('requires exactly 3 rounds', () => {
    const bad = { ...puzzle(), rounds: puzzle().rounds.slice(0, 2) }
    expect(() => validateDailyPuzzle(bad)).toThrow(/exactly 3/)
  })

  it('requires distinct categories', () => {
    const bad = { ...puzzle(), rounds: [round('ppg'), round('ppg'), round('rpg')] }
    expect(() => validateDailyPuzzle(bad)).toThrow(/distinct/)
  })
})

describe('validateRound', () => {
  it('rejects unknown categories and scopes', () => {
    expect(() => validateRound({ ...round('ppg'), categoryKey: 'fg%' })).toThrow(/categoryKey/)
    expect(() => validateRound({ ...round('ppg'), scope: 'decade' })).toThrow(/scope/)
  })

  it('rejects a zero range', () => {
    expect(() => validateRound({ ...round('ppg'), rangeSize: 0 })).toThrow(/rangeSize/)
  })

  it('rejects the wrong number of players', () => {
    const bad = round('ppg')
    bad.players.pop()
    expect(() => validateRound(bad)).toThrow(/expected 5 players/)
  })

  it('rejects middle players outside the window', () => {
    const bad = round('ppg')
    bad.players[3] = player('ppg-d', 25)
    expect(() => validateRound(bad)).toThrow(/outside the window/)
  })

  it('rejects anchors that are not on the window edges', () => {
    const bad = round('ppg')
    bad.players[1] = player('ppg-b', 19, 'high')
    expect(() => validateRound(bad)).toThrow(/window end/)
  })

  it('rejects duplicate players', () => {
    const bad = round('ppg')
    bad.players[3] = player('ppg-c', 15)
    expect(() => validateRound(bad)).toThrow(/more than once/)
  })

  it('requires season to match the scope', () => {
    const bad = { ...round('ppg'), scope: 'career' }
    expect(() => validateRound(bad)).toThrow(/season must be null/)
  })
})
