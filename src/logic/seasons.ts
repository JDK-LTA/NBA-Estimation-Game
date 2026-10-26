import type { Dataset, Player, PlayerStatValue } from '../types/index.ts'

// Coverage of the season/playoff data; keep in sync with data-pipeline/config.py.
export const FIRST_SEASON_YEAR = 1996
export const LAST_SEASON_YEAR = 2025

/** Inclusive range of season start years (2025 means 2025-26). */
export interface SeasonRange {
  from: number
  to: number
}

export const FULL_SEASON_RANGE: SeasonRange = { from: FIRST_SEASON_YEAR, to: LAST_SEASON_YEAR }

/** "2025-26" -> 2025 */
export function seasonStartYear(season: string): number {
  return Number.parseInt(season.slice(0, 4), 10)
}

/** 2025 -> "2025-26" */
export function seasonLabel(startYear: number): string {
  return `${startYear}-${String(startYear + 1).slice(-2)}`
}

/** True when the range keeps everything the dataset covers (so no filtering is needed). */
export function isFullSeasonRange(range: SeasonRange | undefined): boolean {
  return !range || (range.from <= FIRST_SEASON_YEAR && range.to >= LAST_SEASON_YEAR)
}

/**
 * Season rows must start inside the range; career rows keep players whose
 * careers overlap it (players with unknown years are kept).
 */
export function inSeasonRange(row: PlayerStatValue, player: Player | undefined, range: SeasonRange): boolean {
  if (row.scope === 'career') {
    const first = player?.firstYear
    const last = player?.lastYear
    if (first == null || last == null) return true
    return last >= range.from && first <= range.to
  }
  if (!row.season) return true
  const year = seasonStartYear(row.season)
  return year >= range.from && year <= range.to
}

/** Most recent season start year present in the dataset's season/playoff rows. */
export function inferLatestSeasonYear(dataset: Dataset): number {
  let latest = FIRST_SEASON_YEAR
  for (const rows of Object.values(dataset.stats)) {
    for (const row of rows ?? []) {
      if (row.season) latest = Math.max(latest, seasonStartYear(row.season))
    }
  }
  return latest
}

export type RowWeight = (row: PlayerStatValue, player: Player | undefined) => number

/**
 * Leans toward recent eras without excluding old ones: rows from the last
 * `recentYears` seasons (or careers still active in that window) count
 * `recentWeight` times as much as older rows.
 */
export function recencyWeight(latestYear: number, recentYears: number, recentWeight: number): RowWeight {
  const cutoff = latestYear - recentYears + 1
  return (row, player) => {
    const year = row.season ? seasonStartYear(row.season) : (player?.lastYear ?? null)
    if (year === null) return 1
    return year >= cutoff ? recentWeight : 1
  }
}
