import type {
  CategoryKey,
  Dataset,
  DifficultyConfig,
  PlayerStatValue,
  Scope,
} from '../types/index.ts'
import { inSeasonRange, isFullSeasonRange, type SeasonRange } from './seasons.ts'

// TDD.md 2.4 - difficulty knobs. Lower cutoffs = more famous players = easier.
export const DEFAULT_DIFFICULTY: DifficultyConfig = {
  seasonEligibilityCutoff: 100,
  careerEligibilityCutoff: 500,
}

export interface EligibilityOptions extends DifficultyConfig {
  /**
   * Optional pool restriction to one franchise's players (TDD.md 3.3). Same
   * mechanism could back decade/position/draft-class pools later.
   */
  teamAbbreviation?: string
  /** Optional limit on which seasons (or careers overlapping them) are eligible. */
  seasonRange?: SeasonRange
}

export function cutoffForScope(scope: Scope, options: DifficultyConfig): number {
  return scope === 'career' ? options.careerEligibilityCutoff : options.seasonEligibilityCutoff
}

/** Eligible stat rows for one category + scope, sorted by value ascending. */
export function getEligiblePool(
  dataset: Dataset,
  categoryKey: CategoryKey,
  scope: Scope,
  options: EligibilityOptions,
  excludedPlayerIds?: ReadonlySet<string>,
): PlayerStatValue[] {
  const cutoff = cutoffForScope(scope, options)
  const rows = dataset.stats[categoryKey] ?? []
  const range = isFullSeasonRange(options.seasonRange) ? undefined : options.seasonRange

  return rows
    .filter((row) => {
      if (row.scope !== scope || row.leaderboardRank > cutoff || row.value <= 0) return false
      if (excludedPlayerIds?.has(row.playerId)) return false
      const player = dataset.players[row.playerId]
      if (!player) return false
      if (range && !inSeasonRange(row, player, range)) return false
      return !options.teamAbbreviation || player.teams.includes(options.teamAbbreviation)
    })
    .sort((a, b) => a.value - b.value)
}
