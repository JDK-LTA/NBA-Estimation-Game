import { describe, expect, it } from 'vitest'
import { makeDataset } from '../test/fixtures.ts'
import {
  DEFAULT_INFINITE_CONFIG,
  INFINITE_LIMITS,
  generateInfiniteRound,
  sanitizeInfiniteConfig,
} from './infiniteMode.ts'
import { createRng } from './rng.ts'
import type { InfiniteModeConfig } from '../types/index.ts'

const dataset = makeDataset({ playerCount: 200, step: 0.1 })
const config = (overrides: Partial<InfiniteModeConfig> = {}): InfiniteModeConfig => ({
  ...DEFAULT_INFINITE_CONFIG,
  seasonEligibilityCutoff: 150,
  careerEligibilityCutoff: 200,
  ...overrides,
})

describe('generateInfiniteRound', () => {
  it('respects the configured scope, pool, and middle player count', () => {
    for (let i = 0; i < 20; i++) {
      const result = generateInfiniteRound(
        dataset,
        config({ scope: 'playoffs', categoryKeyPool: ['apg', 'rpg'], middlePlayerCount: 4 }),
        createRng(`infinite-${i}`),
      )
      if (!result.ok) throw new Error(result.reason)
      expect(result.round.scope).toBe('playoffs')
      expect(['apg', 'rpg']).toContain(result.round.categoryKey)
      expect(result.round.middlePlayerCount).toBe(4)
      expect(result.round.players).toHaveLength(6)
    }
  })

  it('applies rangeSize overrides', () => {
    const result = generateInfiniteRound(
      dataset,
      config({ categoryKeyPool: ['ppg'], rangeSizeOverrides: { ppg: 6 } }),
      createRng('override'),
    )
    if (!result.ok) throw new Error(result.reason)
    expect(result.round.nominalRangeSize).toBe(6)
  })

  it('fails gracefully with a friendly message for an impossible config', () => {
    const narrow = makeDataset({ playerCount: 40, step: 0.02 })
    const started = Date.now()
    const result = generateInfiniteRound(narrow, config(), createRng('impossible'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toMatch(/try adjusting/i)
    expect(Date.now() - started).toBeLessThan(3000)
  })
})

describe('sanitizeInfiniteConfig', () => {
  it('clamps absurd numbers into the allowed limits', () => {
    const safe = sanitizeInfiniteConfig(
      config({
        middlePlayerCount: 9999,
        hintsPerRound: -5,
        seasonEligibilityCutoff: 1e9,
        careerEligibilityCutoff: 0,
      }),
    )
    expect(safe.middlePlayerCount).toBe(INFINITE_LIMITS.middlePlayerCount.max)
    expect(safe.hintsPerRound).toBe(INFINITE_LIMITS.hintsPerRound.min)
    expect(safe.seasonEligibilityCutoff).toBe(INFINITE_LIMITS.seasonEligibilityCutoff.max)
    expect(safe.careerEligibilityCutoff).toBe(INFINITE_LIMITS.careerEligibilityCutoff.min)
  })

  it('handles NaN and unknown categories', () => {
    const safe = sanitizeInfiniteConfig(
      config({
        middlePlayerCount: Number.NaN,
        categoryKeyPool: ['nope' as never],
      }),
    )
    expect(safe.middlePlayerCount).toBe(INFINITE_LIMITS.middlePlayerCount.min)
    expect(safe.categoryKeyPool.length).toBeGreaterThan(0)
  })

  it('clamps range size overrides to a sane multiple of the default', () => {
    const safe = sanitizeInfiniteConfig(config({ rangeSizeOverrides: { ppg: 0.0001, apg: 9999 } }))
    expect(safe.rangeSizeOverrides?.ppg).toBe(2.5)
    expect(safe.rangeSizeOverrides?.apg).toBe(12)
  })
})
