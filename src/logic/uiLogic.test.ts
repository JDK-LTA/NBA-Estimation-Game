import { describe, expect, it } from 'vitest'
import { scoreRound, hintBandFor, isOrderCorrect, middlePlayersOf, truePercent, valueAtPercent, totalHintsUsed } from './roundScoring.ts'
import { computeStreaks, scoreTier, summarizeHistory, totalScoreOf, type HistoryMap } from './history.ts'
import { puzzleSignature } from './gameState.ts'
import { buildShareText, squareFor } from './share.ts'
import { daysInMonth, formatLongDate, makeDate, shiftDate, toDateString, weekdayOf } from './dates.ts'
import type { PuzzleRound, UserDailyHistoryEntry } from '../types/index.ts'

const round: PuzzleRound = {
  categoryKey: 'ppg',
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
}

describe('roundScoring', () => {
  it('scores a hand-computed round with and without hints', () => {
    const scored = scoreRound(round, {
      positions: { a: 0.25, b: 0.4, c: 0.8 },
      hints: { b: 1 },
    })
    // a: exact -> 100. b: |0.5-0.4|=0.1 -> 90 * 0.75 = 67.5 -> 68. c: exact -> 100.
    expect(scored.playerScores).toEqual({ a: 100, b: 68, c: 100 })
    expect(scored.total).toBe(268)
    expect(scored.max).toBe(300)
  })

  it('treats a missing guess as the slider center', () => {
    expect(scoreRound(round, { positions: {}, hints: {} }).playerScores.b).toBe(100)
  })

  it('exposes helpers', () => {
    expect(middlePlayersOf(round).map((p) => p.playerId)).toEqual(['a', 'b', 'c'])
    expect(truePercent(round, round.players[2])).toBeCloseTo(0.25)
    expect(valueAtPercent(round, 0.5)).toBe(25)
    expect(totalHintsUsed({ a: 2, b: 1 })).toBe(3)
  })

  it('computes a hint band that contains the true position', () => {
    const player = round.players[3]
    const band = hintBandFor(round, player, 2)
    expect(band.end - band.start).toBeCloseTo(0.25)
    expect(truePercent(round, player)).toBeGreaterThanOrEqual(band.start - 1e-9)
    expect(truePercent(round, player)).toBeLessThanOrEqual(band.end + 1e-9)
  })
})

describe('dates', () => {
  it('formats local dates without timezone drift', () => {
    expect(toDateString(new Date(2026, 9, 23, 23, 59))).toBe('2026-10-23')
    expect(toDateString(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01')
  })

  it('shifts and formats', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(formatLongDate('2026-10-23')).toBe('Friday, October 23, 2026')
    expect(weekdayOf('2026-10-23')).toBe(5)
    expect(daysInMonth(2028, 1)).toBe(29)
    expect(makeDate(2026, 0, 5)).toBe('2026-01-05')
  })
})

describe('computeStreaks', () => {
  it('is zero with no history', () => {
    expect(computeStreaks([], '2026-10-23')).toEqual({ current: 0, longest: 0 })
  })

  it('counts a streak ending today', () => {
    expect(computeStreaks(['2026-10-21', '2026-10-22', '2026-10-23'], '2026-10-23')).toEqual({ current: 3, longest: 3 })
  })

  it('keeps the streak alive if today is not played yet', () => {
    expect(computeStreaks(['2026-10-21', '2026-10-22'], '2026-10-23').current).toBe(2)
  })

  it('breaks the streak after a missed day but remembers the longest', () => {
    const result = computeStreaks(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-20'], '2026-10-23')
    expect(result).toEqual({ current: 0, longest: 3 })
  })

  it('handles month boundaries and duplicates', () => {
    expect(computeStreaks(['2026-10-31', '2026-11-01', '2026-11-01'], '2026-11-01')).toEqual({ current: 2, longest: 2 })
  })
})

describe('summarizeHistory', () => {
  const entry = (date: string, dailyScore: number, hints: number): UserDailyHistoryEntry => ({
    date,
    dailyScore,
    maxScore: 1500,
    completedAt: `${date}T12:00:00.000Z`,
    roundResults: [
      { date, roundIndex: 0, categoryKey: 'ppg', score: dailyScore, hintsUsedByPlayer: { a: hints }, guesses: {} },
    ],
  })

  it('aggregates games, averages, bests and hints', () => {
    const history: HistoryMap = {
      '2026-10-22': entry('2026-10-22', 1000, 1),
      '2026-10-23': entry('2026-10-23', 1200, 2),
    }
    const summary = summarizeHistory(history, '2026-10-23')
    expect(summary.gamesPlayed).toBe(2)
    expect(summary.averageScore).toBe(1100)
    expect(summary.bestScore).toBe(1200)
    expect(summary.hintsUsed).toBe(3)
    expect(summary.averagePercent).toBeCloseTo(1100 / 1500)
    expect(summary.streaks.current).toBe(2)
  })

  it('handles an empty history', () => {
    expect(summarizeHistory({}, '2026-10-23')).toMatchObject({ gamesPlayed: 0, averageScore: 0, bestScore: 0 })
  })
})

describe('score tiers and sharing', () => {
  it('maps fractions to tiers', () => {
    expect([0.95, 0.85, 0.7, 0.5, 0.1].map(scoreTier)).toEqual([4, 3, 2, 1, 0])
    expect(squareFor(95)).toBe('🟩')
    expect(squareFor(10)).toBe('⬛')
  })

  it('builds a spoiler-free share text', () => {
    const text = buildShareText('Oct 23', [
      { categoryKey: 'ppg', scope: 'season', playerScores: [95, 85, 70, 50, 10], bonus: 0, hintsUsed: 1 },
      { categoryKey: '3ptpg', scope: 'career', playerScores: [100, 100, 100, 100, 100], bonus: 100, hintsUsed: 0 },
    ])
    expect(text).toBe(
      [
        'The Range - Oct 23',
        '🟩🟨🟧🟥⬛ PPG (Single Season) 310',
        '🟩🟩🟩🟩🟩 3PM/G (Career) 500 +100',
        'Total: 910 (810 + 100 order bonus) / 1,000 - 1 hint',
      ].join('\n'),
    )
  })

  it('omits the bonus breakdown when none was earned', () => {
    const text = buildShareText('Oct 23', [
      { categoryKey: 'ppg', scope: 'season', playerScores: [100, 100], bonus: 0, hintsUsed: 0 },
    ])
    expect(text).toContain('Total: 200 / 200 - no hints')
  })
})

describe('order bonus', () => {
  it('is earned only when guesses rise strictly in the true order', () => {
    expect(isOrderCorrect(round, { a: 0.1, b: 0.5, c: 0.9 })).toBe(true)
    expect(isOrderCorrect(round, { a: 0.1, b: 0.9, c: 0.5 })).toBe(false)
    expect(isOrderCorrect(round, { a: 0.5, b: 0.5, c: 0.9 })).toBe(false)
    expect(isOrderCorrect(round, { a: 0.1, b: 0.5 })).toBe(false)
  })

  it('adds a separate 100-point bonus that does not change the base total or the max', () => {
    const ordered = scoreRound(round, { positions: { a: 0.2, b: 0.5, c: 0.9 }, hints: {} })
    expect(ordered.bonus).toBe(100)
    expect(ordered.max).toBe(300)
    expect(ordered.total).toBe(95 + 100 + 90)

    const unordered = scoreRound(round, { positions: { a: 0.9, b: 0.5, c: 0.2 }, hints: {} })
    expect(unordered.bonus).toBe(0)
  })

  it('is included in history totals and summaries', () => {
    const entry: UserDailyHistoryEntry = {
      date: '2026-10-23',
      dailyScore: 1000,
      bonusScore: 200,
      maxScore: 1500,
      completedAt: '2026-10-23T12:00:00.000Z',
      roundResults: [],
    }
    expect(totalScoreOf(entry)).toBe(1200)
    expect(totalScoreOf({ ...entry, bonusScore: undefined })).toBe(1000)
    const summary = summarizeHistory({ [entry.date]: entry }, entry.date)
    expect(summary.bestScore).toBe(1200)
    expect(summary.averagePercent).toBeCloseTo(1000 / 1500)
  })

  it('puzzle signatures change when the puzzle changes', () => {
    const changed = { ...round, players: round.players.map((p) => (p.playerId === 'a' ? { ...p, playerId: 'z' } : p)) }
    expect(puzzleSignature([round])).toBe(puzzleSignature([round]))
    expect(puzzleSignature([round])).not.toBe(puzzleSignature([changed]))
  })
})
