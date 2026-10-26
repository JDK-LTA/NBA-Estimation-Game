import { STAT_CATEGORIES } from './categories.ts'
import { generateRound, type RoundResult } from './puzzleGenerator.ts'
import { shuffle, type Rng } from './rng.ts'
import {
  CATEGORY_KEYS,
  SCOPES,
  type CategoryKey,
  type Dataset,
  type InfiniteModeConfig,
} from '../types/index.ts'

// Bounded by how deep the ingested datasets go (data-pipeline/config.py).
export const INFINITE_LIMITS = {
  middlePlayerCount: { min: 1, max: 8 },
  hintsPerRound: { min: 0, max: 10 },
  seasonEligibilityCutoff: { min: 10, max: 150 },
  careerEligibilityCutoff: { min: 25, max: 750 },
} as const

export const DEFAULT_INFINITE_CONFIG: InfiniteModeConfig = {
  categoryKeyPool: [...CATEGORY_KEYS],
  scope: 'season',
  middlePlayerCount: 5,
  hintsPerRound: 3,
  seasonEligibilityCutoff: 100,
  careerEligibilityCutoff: 500,
  rangeSizeOverrides: null,
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Clamps every field into a safe range (TDD.md Risks #10). */
export function sanitizeInfiniteConfig(config: InfiniteModeConfig): InfiniteModeConfig {
  const pool = [...new Set(config.categoryKeyPool)].filter((key): key is CategoryKey =>
    CATEGORY_KEYS.includes(key),
  )

  let rangeSizeOverrides: InfiniteModeConfig['rangeSizeOverrides'] = null
  if (config.rangeSizeOverrides) {
    rangeSizeOverrides = {}
    for (const key of CATEGORY_KEYS) {
      const override = config.rangeSizeOverrides[key]
      if (override === undefined || !Number.isFinite(override)) continue
      const base = STAT_CATEGORIES[key].rangeSize
      const clamped = Math.min(base * 3, Math.max(base * 0.25, override))
      rangeSizeOverrides[key] = Math.round(clamped * 10) / 10
    }
  }

  const limits = INFINITE_LIMITS
  return {
    categoryKeyPool: pool.length > 0 ? pool : [...DEFAULT_INFINITE_CONFIG.categoryKeyPool],
    scope: SCOPES.includes(config.scope) ? config.scope : DEFAULT_INFINITE_CONFIG.scope,
    middlePlayerCount: clampInt(config.middlePlayerCount, limits.middlePlayerCount.min, limits.middlePlayerCount.max),
    hintsPerRound: clampInt(config.hintsPerRound, limits.hintsPerRound.min, limits.hintsPerRound.max),
    seasonEligibilityCutoff: clampInt(
      config.seasonEligibilityCutoff,
      limits.seasonEligibilityCutoff.min,
      limits.seasonEligibilityCutoff.max,
    ),
    careerEligibilityCutoff: clampInt(
      config.careerEligibilityCutoff,
      limits.careerEligibilityCutoff.min,
      limits.careerEligibilityCutoff.max,
    ),
    rangeSizeOverrides,
  }
}

/** Random category from the pool; falls through the rest if one has no valid window. */
export function generateInfiniteRound(
  dataset: Dataset,
  rawConfig: InfiniteModeConfig,
  rng: Rng,
): RoundResult {
  const config = sanitizeInfiniteConfig(rawConfig)
  let lastFailure = 'No categories selected.'

  for (const categoryKey of shuffle(rng, config.categoryKeyPool)) {
    const result = generateRound(
      dataset,
      {
        categoryKey,
        scope: config.scope,
        middlePlayerCount: config.middlePlayerCount,
        eligibility: {
          seasonEligibilityCutoff: config.seasonEligibilityCutoff,
          careerEligibilityCutoff: config.careerEligibilityCutoff,
        },
        rangeSize: config.rangeSizeOverrides?.[categoryKey],
        maxAttempts: 150,
      },
      rng,
    )
    if (result.ok) return result
    lastFailure = result.reason
  }

  return {
    ok: false,
    reason: `Couldn't generate a puzzle with this configuration - try adjusting it. (${lastFailure})`,
  }
}
