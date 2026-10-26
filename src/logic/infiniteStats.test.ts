import { describe, expect, it } from 'vitest'
import { summarizeInfinite } from './infiniteStats.ts'
import type { InfiniteRoundResult } from '../types/index.ts'

const result = (id: string, overrides: Partial<InfiniteRoundResult> = {}): InfiniteRoundResult => ({
  id,
  completedAt: '2026-10-23T12:00:00.000Z',
  categoryKey: 'ppg',
  scope: 'season',
  middlePlayerCount: 5,
  score: 400,
  bonus: 0,
  maxScore: 500,
  hintsUsed: 0,
  ...overrides,
})

describe('summarizeInfinite', () => {
  it('handles no results', () => {
    expect(summarizeInfinite([])).toMatchObject({ rounds: 0, averagePercent: 0, bestPercent: 0, byCategory: [], byScope: [] })
  })

  it('averages on placement points as a share of each round\'s own maximum', () => {
    const summary = summarizeInfinite([
      result('a', { score: 400, maxScore: 500 }),
      result('b', { score: 150, maxScore: 300, middlePlayerCount: 3, bonus: 100, hintsUsed: 2 }),
    ])
    expect(summary.rounds).toBe(2)
    expect(summary.averagePercent).toBeCloseTo((0.8 + 0.5) / 2)
    expect(summary.bestPercent).toBeCloseTo(0.8)
    expect(summary.bonusRounds).toBe(1)
    expect(summary.hintsUsed).toBe(2)
  })

  it('breaks results down by stat and scope, most played first', () => {
    const summary = summarizeInfinite([
      result('a', { categoryKey: 'apg', scope: 'career', score: 500 }),
      result('b', { categoryKey: 'ppg', score: 250 }),
      result('c', { categoryKey: 'ppg', score: 500 }),
    ])
    expect(summary.byCategory.map((row) => [row.key, row.rounds])).toEqual([
      ['ppg', 2],
      ['apg', 1],
    ])
    expect(summary.byCategory[0].averagePercent).toBeCloseTo(0.75)
    expect(summary.byScope.map((row) => row.key)).toEqual(['season', 'career'])
  })
})
