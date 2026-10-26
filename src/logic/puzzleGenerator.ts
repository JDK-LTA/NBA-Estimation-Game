import { STAT_CATEGORIES } from './categories.ts'
import { getEligiblePool, type EligibilityOptions } from './eligibility.ts'
import { pickWeighted, shuffle, shuffleWeighted, type Rng } from './rng.ts'
import type { RowWeight } from './seasons.ts'
import type {
  CategoryKey,
  Dataset,
  Player,
  PlayerStatValue,
  PuzzleRound,
  RoundPlayerSelection,
  Scope,
} from '../types/index.ts'

export const DEFAULT_MIDDLE_PLAYER_COUNT = 5
export const DEFAULT_MAX_ATTEMPTS = 400
/** Each puzzle's slider may be this fraction wider or narrower than the nominal width (10 -> 9.5 to 10.5). */
export const DEFAULT_RANGE_LEEWAY = 0.05
const MAX_RANGE_LEEWAY = 0.25

export interface RoundGenerationOptions {
  categoryKey: CategoryKey
  scope: Scope
  middlePlayerCount: number
  eligibility: EligibilityOptions
  /** Overrides the category's default slider width (stat units). */
  rangeSize?: number
  /** Allowed deviation from the nominal width, as a fraction of it (0 = exact). */
  rangeLeeway?: number
  /** Relative likelihood of each stat row being picked (e.g. favouring recent seasons); default 1. */
  weightOf?: RowWeight
  excludedPlayerIds?: ReadonlySet<string>
  /** Anchor pairs (see `anchorPairKey`) that must not be reused. */
  excludedAnchorPairs?: ReadonlySet<string>
  /** Hard cap on window searches so impossible configs fail instead of hanging. */
  maxAttempts?: number
}

export type RoundResult = { ok: true; round: PuzzleRound } | { ok: false; reason: string }

export function anchorPairKey(playerIdA: string, playerIdB: string): string {
  return playerIdA < playerIdB ? `${playerIdA}|${playerIdB}` : `${playerIdB}|${playerIdA}`
}

interface Candidate {
  row: PlayerStatValue
  units: number
  weight: number
}

/** Values are compared in whole display units (e.g. tenths) to avoid float drift. */
function toCandidates(
  pool: PlayerStatValue[],
  scale: number,
  players: Record<string, Player>,
  weightOf: RowWeight | undefined,
): Candidate[] {
  return pool.map((row) => ({
    row,
    units: Math.round(row.value * scale),
    weight: weightOf ? weightOf(row, players[row.playerId]) : 1,
  }))
}

/** First index whose units >= target (list is sorted ascending by units). */
function lowerBound(sorted: Candidate[], target: number): number {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid].units < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** One random candidate per player, so a player never appears twice in a round. */
function onePerPlayer(rng: Rng, candidates: Candidate[]): Candidate[] {
  const byPlayer = new Map<string, Candidate[]>()
  for (const candidate of candidates) {
    const list = byPlayer.get(candidate.row.playerId)
    if (list) list.push(candidate)
    else byPlayer.set(candidate.row.playerId, [candidate])
  }
  return [...byPlayer.values()].map((list) => pickWeighted(rng, list, (candidate) => candidate.weight))
}

/**
 * Picks middle players spread across the window: the interior is split into
 * `count` bins and each bin contributes one player where possible. Candidates
 * must sit at least `minSeparation` units apart so displayed values are all
 * distinct.
 */
function selectMiddlePlayers(
  rng: Rng,
  candidates: Candidate[],
  count: number,
  windowLow: number,
  windowSize: number,
  minSeparation: number,
): Candidate[] | null {
  const chosen: Candidate[] = []
  const fits = (candidate: Candidate) =>
    chosen.every((other) => Math.abs(other.units - candidate.units) >= minSeparation)

  const bins: Candidate[][] = Array.from({ length: count }, () => [])
  for (const candidate of candidates) {
    const fraction = (candidate.units - windowLow) / windowSize
    bins[Math.min(count - 1, Math.floor(fraction * count))].push(candidate)
  }

  for (const bin of bins) {
    for (const candidate of shuffleWeighted(rng, bin, (item) => item.weight)) {
      if (fits(candidate)) {
        chosen.push(candidate)
        break
      }
    }
  }

  if (chosen.length < count) {
    for (const candidate of shuffleWeighted(rng, candidates, (item) => item.weight)) {
      if (chosen.length === count) break
      if (!chosen.includes(candidate) && fits(candidate)) chosen.push(candidate)
    }
  }

  return chosen.length === count ? chosen : null
}

function toSelection(
  candidate: Candidate,
  anchorPosition: 'low' | 'high' | null,
): RoundPlayerSelection {
  return {
    playerId: candidate.row.playerId,
    season: candidate.row.season,
    value: candidate.row.value,
    isAnchor: anchorPosition !== null,
    anchorPosition,
  }
}

/**
 * TDD.md 2.2: choose a window [low, low + rangeSize] whose two ends are real
 * players' values (the anchors), then fill it with middle players.
 */
export function generateRound(
  dataset: Dataset,
  options: RoundGenerationOptions,
  rng: Rng,
): RoundResult {
  const { categoryKey, scope, middlePlayerCount } = options
  const category = STAT_CATEGORIES[categoryKey]
  const scale = 10 ** category.decimals
  const rangeSize = options.rangeSize ?? category.rangeSize
  const rangeUnits = Math.round(rangeSize * scale)
  const leewayFraction = Math.min(MAX_RANGE_LEEWAY, Math.max(0, options.rangeLeeway ?? DEFAULT_RANGE_LEEWAY))
  // At least one display unit whenever leeway is on, so tiny ranges still vary.
  const leewayUnits = leewayFraction > 0 ? Math.max(1, Math.round(rangeUnits * leewayFraction)) : 0

  if (!Number.isInteger(middlePlayerCount) || middlePlayerCount < 1) {
    return { ok: false, reason: 'middlePlayerCount must be a positive integer.' }
  }
  if (rangeUnits < middlePlayerCount + 1) {
    return { ok: false, reason: 'rangeSize is too small to fit that many distinct players.' }
  }

  const pool = toCandidates(
    getEligiblePool(dataset, categoryKey, scope, options.eligibility, options.excludedPlayerIds),
    scale,
    dataset.players,
    options.weightOf,
  )
  if (pool.length < middlePlayerCount + 2) {
    return { ok: false, reason: `Only ${pool.length} eligible players for ${categoryKey} / ${scope}.` }
  }

  const minSeparation = Math.max(1, Math.floor(rangeUnits / (4 * (middlePlayerCount + 1))))
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const low = pickWeighted(rng, pool, (candidate) => candidate.weight)

    const highStart = lowerBound(pool, low.units + rangeUnits - leewayUnits)
    const highEnd = lowerBound(pool, low.units + rangeUnits + leewayUnits + 1)
    const highCandidates: Candidate[] = []
    for (let i = highStart; i < highEnd; i++) {
      if (pool[i].row.playerId !== low.row.playerId) highCandidates.push(pool[i])
    }
    if (highCandidates.length === 0) continue

    const high = pickWeighted(rng, highCandidates, (candidate) => candidate.weight)
    const highUnits = high.units
    const windowUnits = highUnits - low.units
    const pairKey = anchorPairKey(low.row.playerId, high.row.playerId)
    if (options.excludedAnchorPairs?.has(pairKey)) continue

    const interiorStart = lowerBound(pool, low.units + minSeparation)
    const interiorEnd = lowerBound(pool, highUnits - minSeparation + 1)
    const interior = pool
      .slice(interiorStart, interiorEnd)
      .filter(
        (candidate) =>
          candidate.row.playerId !== low.row.playerId &&
          candidate.row.playerId !== high.row.playerId,
      )
    const distinctInterior = onePerPlayer(rng, interior)
    if (distinctInterior.length < middlePlayerCount) continue

    const middles = selectMiddlePlayers(
      rng,
      distinctInterior,
      middlePlayerCount,
      low.units,
      windowUnits,
      minSeparation,
    )
    if (!middles) continue

    return {
      ok: true,
      round: {
        categoryKey,
        scope,
        rangeSize: windowUnits / scale,
        nominalRangeSize: rangeUnits / scale,
        lowAnchorValue: low.units / scale,
        middlePlayerCount,
        players: [
          toSelection(low, 'low'),
          toSelection(high, 'high'),
          ...shuffle(rng, middles).map((middle) => toSelection(middle, null)),
        ],
      },
    }
  }

  return {
    ok: false,
    reason: `No valid window found for ${categoryKey} / ${scope} after ${maxAttempts} attempts. Try relaxing the configuration.`,
  }
}
