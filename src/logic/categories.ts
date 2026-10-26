import type { CategoryKey, Scope, StatCategory } from '../types/index.ts'

// Keep in sync with data-pipeline/config.py (TDD.md 2.2).
export const STAT_CATEGORIES: Record<CategoryKey, StatCategory> = {
  ppg: { key: 'ppg', label: 'Points Per Game', unit: 'PPG', decimals: 1, rangeSize: 10 },
  apg: { key: 'apg', label: 'Assists Per Game', unit: 'APG', decimals: 1, rangeSize: 4 },
  spg: { key: 'spg', label: 'Steals Per Game', unit: 'SPG', decimals: 1, rangeSize: 1 },
  bpg: { key: 'bpg', label: 'Blocks Per Game', unit: 'BPG', decimals: 1, rangeSize: 1.5 },
  rpg: { key: 'rpg', label: 'Rebounds Per Game', unit: 'RPG', decimals: 1, rangeSize: 6 },
  '3ptpg': {
    key: '3ptpg',
    label: '3-Pointers Made Per Game',
    unit: '3PM/G',
    decimals: 1,
    rangeSize: 2,
  },
  fgpct: { key: 'fgpct', label: 'Field Goal %', unit: 'FG%', decimals: 1, rangeSize: 8 },
  '3ppct': { key: '3ppct', label: '3-Point %', unit: '3P%', decimals: 1, rangeSize: 6 },
  ftpct: { key: 'ftpct', label: 'Free Throw %', unit: 'FT%', decimals: 1, rangeSize: 10 },
  tovpg: { key: 'tovpg', label: 'Turnovers Per Game', unit: 'TOV', decimals: 1, rangeSize: 2 },
}

export const SCOPE_LABELS = {
  career: 'Career',
  season: 'Single Season',
  playoffs: 'Playoff Run',
} as const

/** One-line explanation shown with every round so the type of numbers is never ambiguous. */
export const SCOPE_DESCRIPTIONS = {
  career: 'Career averages: every player is rated over their whole career.',
  season: 'Regular-season averages: each player can be from a different season.',
  playoffs: 'Playoff averages: each player can be from a different postseason run.',
} as const

/** What a player's number refers to, e.g. "Career", "2016-17" or "2016-17 playoffs". */
export function entryLabel(scope: Scope, season: string | null): string {
  if (scope === 'career' || !season) return 'Career'
  return scope === 'playoffs' ? `${season} playoffs` : season
}

export function formatStatValue(value: number, categoryKey: CategoryKey): string {
  return value.toFixed(STAT_CATEGORIES[categoryKey].decimals)
}
