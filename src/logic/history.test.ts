import { describe, expect, it } from 'vitest'
import type { UserDailyHistoryEntry } from '../types/index.ts'
import { describeDay } from './history.ts'

function entry(overrides: Partial<UserDailyHistoryEntry> = {}, hints = 0, bonus = 0): UserDailyHistoryEntry {
  const keys = ['ppg', 'apg', 'rpg'] as const
  return {
    date: '2026-10-23',
    dailyScore: 1250,
    maxScore: 1500,
    completedAt: '2026-10-23T12:00:00Z',
    roundResults: keys.map((categoryKey, roundIndex) => ({
      date: '2026-10-23',
      roundIndex,
      categoryKey,
      score: [300, 420, 380][roundIndex],
      bonus: roundIndex < bonus ? 100 : 0,
      hintsUsedByPlayer: (roundIndex === 0 && hints > 0 ? { a: hints } : {}) as Record<string, number>,
      guesses: {},
    })),
    ...overrides,
  }
}

describe('describeDay', () => {
  it('summarizes a hint-free day with its best round', () => {
    const day = describeDay(entry())
    expect(day.hintFree).toBe(true)
    expect(day.tidbits).toEqual(['No hints', 'Best: APG 420/500'])
    expect(day.verdict).toBe('Sharp')
  })

  it('counts hints and order bonuses', () => {
    const day = describeDay(entry({}, 2, 2))
    expect(day.hintFree).toBe(false)
    expect(day.hintsUsed).toBe(2)
    expect(day.tidbits.slice(0, 2)).toEqual(['Exact order x2', '2 hints'])
  })

  it('calls out an exact order in every round', () => {
    expect(describeDay(entry({}, 0, 3)).tidbits[0]).toBe('Exact order every round')
  })

  it('labels a poor day as tough', () => {
    expect(describeDay(entry({ dailyScore: 400 })).verdict).toBe('Tough day')
  })
})
