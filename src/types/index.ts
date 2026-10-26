// Data model from TDD.md section 6.

export const CATEGORY_KEYS = [
  'ppg',
  'apg',
  'spg',
  'bpg',
  'rpg',
  '3ptpg',
  'fgpct',
  '3ppct',
  'ftpct',
  'tovpg',
] as const
export type CategoryKey = (typeof CATEGORY_KEYS)[number]

export const SCOPES = ['career', 'season', 'playoffs'] as const
export type Scope = (typeof SCOPES)[number]

export interface Player {
  id: string
  fullName: string
  photoUrl: string | null
  photoAttribution: string | null
  position: string | null
  teams: string[]
  /** Start year of the first and last NBA season played (2002 means 2002-03). */
  firstYear?: number | null
  lastYear?: number | null
}

export interface StatCategory {
  key: CategoryKey
  label: string
  unit: string
  decimals: number
  rangeSize: number
}

export interface PlayerStatValue {
  playerId: string
  categoryKey: CategoryKey
  scope: Scope
  /** Null only when scope is "career". */
  season: string | null
  value: number
  leaderboardRank: number
}

export interface DifficultyConfig {
  seasonEligibilityCutoff: number
  careerEligibilityCutoff: number
}

export interface RoundPlayerSelection {
  playerId: string
  season: string | null
  /** Real stat value; revealed only after the round is submitted. */
  value: number
  isAnchor: boolean
  anchorPosition: 'low' | 'high' | null
}

export interface PuzzleRound {
  categoryKey: CategoryKey
  scope: Scope
  rangeSize: number
  /** The category's target width; `rangeSize` may deviate slightly from it (absent in older puzzles). */
  nominalRangeSize?: number
  /** Window is [lowAnchorValue, lowAnchorValue + rangeSize]. */
  lowAnchorValue: number
  /** Two anchors first, then the middle players in display order. */
  players: RoundPlayerSelection[]
  middlePlayerCount: number
}

export interface DailyPuzzle {
  date: string
  rounds: PuzzleRound[]
  seed: string
}

export interface PuzzleArchiveIndexEntry {
  date: string
  categoryKeys: CategoryKey[]
  scopes: Scope[]
}

export interface UserRoundResult {
  date: string
  roundIndex: number
  categoryKey: CategoryKey
  /** Points from the five placements, before any order bonus. */
  score: number
  /** Extra points for getting the exact left-to-right order (absent in older saves). */
  bonus?: number
  hintsUsedByPlayer: Record<string, number>
  /** Slider position (0-1) the player submitted for each middle player. */
  guesses: Record<string, number>
}

export interface UserDailyHistoryEntry {
  date: string
  roundResults: UserRoundResult[]
  dailyScore: number
  /** Sum of order bonuses; not part of `maxScore` (absent in older saves). */
  bonusScore?: number
  /** Highest score possible that day (rounds x middle players x 100). */
  maxScore: number
  completedAt: string
}

export interface InfiniteRoundResult {
  /** Unique per generated puzzle, so a round is only ever recorded once. */
  id: string
  completedAt: string
  categoryKey: CategoryKey
  scope: Scope
  middlePlayerCount: number
  /** Placement points before the order bonus. */
  score: number
  bonus: number
  /** Highest placement score possible for this round's size. */
  maxScore: number
  hintsUsed: number
}

export interface InfiniteModeConfig {
  categoryKeyPool: CategoryKey[]
  scope: Scope
  middlePlayerCount: number
  hintsPerRound: number
  seasonEligibilityCutoff: number
  careerEligibilityCutoff: number
  /** Season start years (inclusive) that rows or careers must overlap. */
  seasonFrom: number
  seasonTo: number
  rangeSizeOverrides: Partial<Record<CategoryKey, number>> | null
}

/** Everything the generator needs; produced by the ingestion pipeline. */
export interface Dataset {
  players: Record<string, Player>
  stats: Partial<Record<CategoryKey, PlayerStatValue[]>>
}
