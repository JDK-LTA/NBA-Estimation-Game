import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { summarizeHistory } from '../logic/history.ts'
import type { UserDailyHistoryEntry } from '../types/index.ts'
import { usePersonalHistory } from './usePersonalHistory.ts'

const entry = (date: string, dailyScore: number): UserDailyHistoryEntry => ({
  date,
  dailyScore,
  maxScore: 1500,
  completedAt: `${date}T12:00:00.000Z`,
  roundResults: [],
})

beforeEach(() => window.localStorage.clear())

describe('usePersonalHistory', () => {
  it('keeps practice results out of official history and stats, but saves them', () => {
    const { result, unmount } = renderHook(() => usePersonalHistory())
    act(() => {
      result.current.record(entry('2026-10-23', 1200))
      result.current.recordPractice(entry('2026-10-20', 900))
    })

    expect(Object.keys(result.current.history)).toEqual(['2026-10-23'])
    expect(Object.keys(result.current.practice)).toEqual(['2026-10-20'])
    expect(summarizeHistory(result.current.history, '2026-10-23').gamesPlayed).toBe(1)
    unmount()

    const reloaded = renderHook(() => usePersonalHistory())
    expect(reloaded.result.current.practice['2026-10-20'].dailyScore).toBe(900)
    expect(reloaded.result.current.history['2026-10-20']).toBeUndefined()
  })

  it('never overwrites an official result, but a newer practice replay replaces the old one', () => {
    const { result } = renderHook(() => usePersonalHistory())
    act(() => {
      result.current.record(entry('2026-10-23', 1200))
      result.current.record(entry('2026-10-23', 100))
      result.current.recordPractice(entry('2026-10-20', 900))
      result.current.recordPractice(entry('2026-10-20', 1300))
    })
    expect(result.current.history['2026-10-23'].dailyScore).toBe(1200)
    expect(result.current.practice['2026-10-20'].dailyScore).toBe(1300)
  })
})
