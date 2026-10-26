import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTheme } from './useTheme.ts'

function mockSystemTheme(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: dark && query.includes('dark'), media: query }))
}

beforeEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
})

afterEach(() => vi.unstubAllGlobals())

describe('useTheme', () => {
  it('starts from the OS preference when nothing is saved', () => {
    mockSystemTheme(true)
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('toggles, applies the theme to the page, and remembers the choice', () => {
    mockSystemTheme(true)
    const first = renderHook(() => useTheme())
    act(() => first.result.current.toggleTheme())
    expect(first.result.current.theme).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    first.unmount()

    // The saved choice wins over the OS preference on the next visit.
    const second = renderHook(() => useTheme())
    expect(second.result.current.theme).toBe('light')
    act(() => second.result.current.toggleTheme())
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('defaults to light when matchMedia is unavailable and ignores a corrupted save', () => {
    vi.stubGlobal('matchMedia', undefined)
    window.localStorage.setItem('range.v1.theme', '"purple"')
    expect(renderHook(() => useTheme()).result.current.theme).toBe('light')
  })
})
