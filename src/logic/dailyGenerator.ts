import { DEFAULT_DIFFICULTY, type EligibilityOptions } from './eligibility.ts'
import {
  anchorPairKey,
  DEFAULT_MIDDLE_PLAYER_COUNT,
  generateRound,
  type RoundResult,
} from './puzzleGenerator.ts'
import { createRng, shuffle, shuffleWeighted, type Rng } from './rng.ts'
import { inferLatestSeasonYear, recencyWeight } from './seasons.ts'
import {
  CATEGORY_KEYS,
  SCOPES,
  type CategoryKey,
  type Dataset,
  type DailyPuzzle,
  type PuzzleArchiveIndexEntry,
  type PuzzleRound,
  type Scope,
} from '../types/index.ts'

export const ROUNDS_PER_DAY = 3

/** Bookkeeping passed in/out explicitly (TDD.md 3.3): who/what was used when. */
export interface RecentHistory {
  categoryLastDay: Partial<Record<CategoryKey, number>>
  playerLastDay: Record<string, number>
  anchorPairLastDay: Record<string, number>
}

export interface DailyGenerationConfig {
  middlePlayerCount: number
  eligibility: EligibilityOptions
  categoryKeys: readonly CategoryKey[]
  /** Relative likelihood of each category appearing; missing keys count as 1. */
  categoryWeights: Partial<Record<CategoryKey, number>>
  scopes: readonly Scope[]
  /** Relative likelihood of each scope for a round; missing keys count as 1. */
  scopeWeights: Partial<Record<Scope, number>>
  /** Rows from the latest `recentSeasonYears` seasons count `recentSeasonWeight` times as much as older ones. */
  recentSeasonYears: number
  recentSeasonWeight: number
  /** Days before the same player can appear again. */
  playerCooldownDays: number
  /** Days before the same two players can anchor a round together again. */
  anchorPairCooldownDays: number
  maxAttemptsPerRound?: number
}

/**
 * The classic box-score stats dominate (most days have a round or two of them);
 * the rest show up now and then as a change of pace.
 */
export const DEFAULT_CATEGORY_WEIGHTS: Partial<Record<CategoryKey, number>> = {
  ppg: 5,
  apg: 5,
  rpg: 5,
  spg: 2,
  bpg: 2,
  '3ptpg': 2,
  fgpct: 1,
  '3ppct': 1,
  ftpct: 1,
  tovpg: 1,
}

export const DEFAULT_SCOPE_WEIGHTS: Partial<Record<Scope, number>> = {
  career: 4,
  season: 4,
  playoffs: 2,
}

export const DEFAULT_DAILY_CONFIG: DailyGenerationConfig = {
  middlePlayerCount: DEFAULT_MIDDLE_PLAYER_COUNT,
  eligibility: DEFAULT_DIFFICULTY,
  categoryKeys: CATEGORY_KEYS,
  categoryWeights: DEFAULT_CATEGORY_WEIGHTS,
  scopes: SCOPES,
  scopeWeights: DEFAULT_SCOPE_WEIGHTS,
  recentSeasonYears: 20,
  recentSeasonWeight: 2,
  playerCooldownDays: 14,
  anchorPairCooldownDays: 730,
}

export function emptyHistory(): RecentHistory {
  return { categoryLastDay: {}, playerLastDay: {}, anchorPairLastDay: {} }
}

const MS_PER_DAY = 86_400_000

/** Whole days since 1970-01-01 for a YYYY-MM-DD date (UTC, so no DST surprises). */
export function dayIndexOf(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / MS_PER_DAY)
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10)
}

/** Recently used categories are damped (back to full weight after 4 days). */
function recencyFactor(lastDay: number | undefined, dayIndex: number): number {
  if (lastDay === undefined) return 1
  return 0.25 + (0.75 * Math.min(3, Math.max(0, dayIndex - lastDay - 1))) / 3
}

/** Weighted draw without replacement: configured weight x how long since last use. */
function pickCategories(
  rng: Rng,
  config: DailyGenerationConfig,
  history: RecentHistory,
  dayIndex: number,
): CategoryKey[] {
  const remaining = [...config.categoryKeys]
  const picked: CategoryKey[] = []
  while (picked.length < ROUNDS_PER_DAY && remaining.length > 0) {
    const weights = remaining.map(
      (key) => (config.categoryWeights[key] ?? 1) * recencyFactor(history.categoryLastDay[key], dayIndex),
    )
    let roll = rng() * weights.reduce((sum, weight) => sum + weight, 0)
    let index = 0
    while (index < weights.length - 1 && roll >= weights[index]) {
      roll -= weights[index]
      index++
    }
    picked.push(remaining.splice(index, 1)[0])
  }
  return picked
}

function playersInCooldown(history: RecentHistory, dayIndex: number, cooldown: number): Set<string> {
  const blocked = new Set<string>()
  for (const [playerId, lastDay] of Object.entries(history.playerLastDay)) {
    if (dayIndex - lastDay < cooldown) blocked.add(playerId)
  }
  return blocked
}

function pairsInCooldown(history: RecentHistory, dayIndex: number, cooldown: number): Set<string> {
  const blocked = new Set<string>()
  for (const [pair, lastDay] of Object.entries(history.anchorPairLastDay)) {
    if (dayIndex - lastDay < cooldown) blocked.add(pair)
  }
  return blocked
}

export interface DailyGenerationResult {
  puzzle: DailyPuzzle
  history: RecentHistory
}

/**
 * Generates one day's 3 rounds (distinct categories, free scope choice) and
 * returns the updated history. Cooldowns are best-effort: if a round can't be
 * built under them, they're relaxed before giving up on a category.
 */
export function generateDailyPuzzle(
  dataset: Dataset,
  date: string,
  baseSeed: string,
  history: RecentHistory,
  config: DailyGenerationConfig = DEFAULT_DAILY_CONFIG,
): DailyGenerationResult {
  const seed = `${baseSeed}|${date}`
  const rng = createRng(seed)
  const dayIndex = dayIndexOf(date)

  const cooldownPlayers = playersInCooldown(history, dayIndex, config.playerCooldownDays)
  const cooldownPairs = pairsInCooldown(history, dayIndex, config.anchorPairCooldownDays)
  const usedToday = new Set<string>()
  const rounds: PuzzleRound[] = []
  const weightOf = recencyWeight(
    inferLatestSeasonYear(dataset),
    config.recentSeasonYears,
    config.recentSeasonWeight,
  )

  const tryCategory = (categoryKey: CategoryKey): PuzzleRound | null => {
    const scopes = shuffleWeighted(rng, config.scopes, (scope) => config.scopeWeights[scope] ?? 1)
    // Relax gradually: full cooldowns in any scope first, then only the anchor-pair one, then none.
    for (const level of ['full', 'pairs', 'none'] as const) {
      for (const scope of scopes) {
        const excluded = new Set(usedToday)
        if (level === 'full') cooldownPlayers.forEach((id) => excluded.add(id))
        const result: RoundResult = generateRound(
          dataset,
          {
            categoryKey,
            scope,
            middlePlayerCount: config.middlePlayerCount,
            eligibility: config.eligibility,
            excludedPlayerIds: excluded,
            excludedAnchorPairs: level === 'none' ? undefined : cooldownPairs,
            maxAttempts: config.maxAttemptsPerRound,
            weightOf,
          },
          rng,
        )
        if (result.ok) return result.round
      }
    }
    return null
  }

  const preferred = pickCategories(rng, config, history, dayIndex)
  const fallbacks = shuffle(
    rng,
    config.categoryKeys.filter((key) => !preferred.includes(key)),
  )
  const queue = [...preferred, ...fallbacks]

  for (const categoryKey of queue) {
    if (rounds.length === ROUNDS_PER_DAY) break
    const round = tryCategory(categoryKey)
    if (!round) continue
    rounds.push(round)
    round.players.forEach((player) => usedToday.add(player.playerId))
  }

  if (rounds.length < ROUNDS_PER_DAY) {
    throw new Error(`Could not generate ${ROUNDS_PER_DAY} valid rounds for ${date}.`)
  }

  return { puzzle: { date, rounds, seed }, history: recordPuzzle(history, rounds, dayIndex) }
}

export function recordPuzzle(
  history: RecentHistory,
  rounds: PuzzleRound[],
  dayIndex: number,
): RecentHistory {
  const next: RecentHistory = {
    categoryLastDay: { ...history.categoryLastDay },
    playerLastDay: { ...history.playerLastDay },
    anchorPairLastDay: { ...history.anchorPairLastDay },
  }
  for (const round of rounds) {
    next.categoryLastDay[round.categoryKey] = dayIndex
    for (const player of round.players) next.playerLastDay[player.playerId] = dayIndex
    const [low, high] = round.players
    next.anchorPairLastDay[anchorPairKey(low.playerId, high.playerId)] = dayIndex
  }
  return next
}

/** Generates `days` consecutive puzzles starting at `startDate`. */
export function generateBatch(
  dataset: Dataset,
  startDate: string,
  days: number,
  baseSeed: string,
  config: DailyGenerationConfig = DEFAULT_DAILY_CONFIG,
): DailyPuzzle[] {
  let history = emptyHistory()
  const puzzles: DailyPuzzle[] = []
  for (let offset = 0; offset < days; offset++) {
    const result = generateDailyPuzzle(dataset, addDays(startDate, offset), baseSeed, history, config)
    history = result.history
    puzzles.push(result.puzzle)
  }
  return puzzles
}

export function toIndexEntry(puzzle: DailyPuzzle): PuzzleArchiveIndexEntry {
  return {
    date: puzzle.date,
    categoryKeys: puzzle.rounds.map((round) => round.categoryKey),
    scopes: puzzle.rounds.map((round) => round.scope),
  }
}
