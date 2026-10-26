import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_INFINITE_RESULTS } from '../data/storage.ts'
import type { InfiniteRoundResult } from '../types/index.ts'
import { useInfiniteResults } from './useInfiniteResults.ts'

const result = (id: string): InfiniteRoundResult => ({
  id,
  completedAt: '2026-10-23T12:00:00.000Z',
  categoryKey: 'ppg',
  scope: 'career',
  middlePlayerCount: 5,
  score: 300,
  bonus: 0,
  maxScore: 500,
  hintsUsed: 0,
})

beforeEach(() => window.localStorage.clear())

describe('useInfiniteResults', () => {
  it('stores each round once and keeps it after a reload', () => {
    const first = renderHook(() => useInfiniteResults())
    act(() => {
      first.result.current.recordResult(result('a'))
      first.result.current.recordResult(result('a'))
      first.result.current.recordResult(result('b'))
    })
    expect(first.result.current.results.map((r) => r.id)).toEqual(['a', 'b'])
    first.unmount()

    const second = renderHook(() => useInfiniteResults())
    expect(second.result.current.results.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('keeps only the newest results and ignores corrupted saves', () => {
    const { result: hook } = renderHook(() => useInfiniteResults())
    act(() => {
      for (let i = 0; i < MAX_INFINITE_RESULTS + 5; i++) hook.current.recordResult(result(`r${i}`))
    })
    expect(hook.current.results).toHaveLength(MAX_INFINITE_RESULTS)
    expect(hook.current.results[0].id).toBe('r5')

    window.localStorage.setItem('range.v1.infinite-results', '[{"id":1},"nope",null]')
    expect(renderHook(() => useInfiniteResults()).result.current.results).toEqual([])
  })
})
