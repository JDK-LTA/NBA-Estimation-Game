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

describe('season range', () => {
  const seasons = Array.from({ length: 30 }, (_, i) => `${1996 + i}-${String((i + 97) % 100).padStart(2, '0')}`)
  const eras = makeDataset({ playerCount: 300, step: 0.1, startValue: 1, seasons })

  it('only draws players from seasons inside the chosen range', () => {
    for (let i = 0; i < 20; i++) {
      const result = generateInfiniteRound(
        eras,
        config({ scope: 'playoffs', seasonEligibilityCutoff: 150, seasonFrom: 2010, seasonTo: 2020 }),
        createRng(`season-range-${i}`),
      )
      if (!result.ok) throw new Error(result.reason)
      for (const selection of result.round.players) {
        const year = Number.parseInt(selection.season!.slice(0, 4), 10)
        expect(year).toBeGreaterThanOrEqual(2010)
        expect(year).toBeLessThanOrEqual(2020)
      }
    }
  })

  it('fails gracefully when the range leaves too few players', () => {
    const result = generateInfiniteRound(
      eras,
      config({ seasonFrom: 2020, seasonTo: 2020, categoryKeyPool: ['ppg'] }),
      createRng('narrow'),
    )
    expect(result.ok).toBe(false)
  })

  it('clamps, orders and defaults the range', () => {
    expect(sanitizeInfiniteConfig(config({ seasonFrom: 2024, seasonTo: 2005 }))).toMatchObject({
      seasonFrom: 2005,
      seasonTo: 2024,
    })
    expect(sanitizeInfiniteConfig(config({ seasonFrom: 1800, seasonTo: 3000 }))).toMatchObject({
      seasonFrom: 1996,
      seasonTo: 2025,
    })
    const legacy = { ...config(), seasonFrom: undefined, seasonTo: undefined } as unknown as InfiniteModeConfig
    expect(sanitizeInfiniteConfig(legacy)).toMatchObject({ seasonFrom: 1996, seasonTo: 2025 })
    expect(sanitizeInfiniteConfig(config({ seasonFrom: Number.NaN }))).toMatchObject({ seasonFrom: 1996 })
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
