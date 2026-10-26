import {
  CATEGORY_KEYS,
  SCOPES,
  type CategoryKey,
  type DailyPuzzle,
  type PuzzleRound,
  type RoundPlayerSelection,
  type Scope,
} from '../types/index.ts'
import { ROUNDS_PER_DAY } from './dailyGenerator.ts'

export class PuzzleValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PuzzleValidationError'
  }
}

const EPSILON = 1e-6
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function fail(message: string): never {
  throw new PuzzleValidationError(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validatePlayer(raw: unknown, scope: Scope, where: string): RoundPlayerSelection {
  if (!isRecord(raw)) return fail(`${where}: player must be an object`)
  const { playerId, season, value, isAnchor, anchorPosition } = raw
  if (typeof playerId !== 'string' || playerId === '') fail(`${where}: missing playerId`)
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${where}: invalid value`)
  if (typeof isAnchor !== 'boolean') fail(`${where}: invalid isAnchor`)
  if (anchorPosition !== null && anchorPosition !== 'low' && anchorPosition !== 'high') {
    fail(`${where}: invalid anchorPosition`)
  }
  if (scope === 'career' ? season !== null : typeof season !== 'string') {
    fail(`${where}: season must be ${scope === 'career' ? 'null' : 'a string'} for scope ${scope}`)
  }
  return { playerId, season, value, isAnchor, anchorPosition } as RoundPlayerSelection
}

export function validateRound(raw: unknown, where = 'round'): PuzzleRound {
  if (!isRecord(raw)) return fail(`${where}: must be an object`)
  const { categoryKey, scope, rangeSize, lowAnchorValue, middlePlayerCount, players } = raw

  if (!CATEGORY_KEYS.includes(categoryKey as CategoryKey)) fail(`${where}: unknown categoryKey`)
  if (!SCOPES.includes(scope as Scope)) fail(`${where}: unknown scope`)
  if (typeof rangeSize !== 'number' || !(rangeSize > 0)) fail(`${where}: rangeSize must be > 0`)
  const nominalRangeSize = raw.nominalRangeSize
  if (nominalRangeSize !== undefined) {
    if (typeof nominalRangeSize !== 'number' || !(nominalRangeSize > 0)) fail(`${where}: invalid nominalRangeSize`)
    if (Math.abs(rangeSize - nominalRangeSize) > nominalRangeSize * 0.3) {
      fail(`${where}: rangeSize strays too far from nominalRangeSize`)
    }
  }
  if (typeof lowAnchorValue !== 'number' || !Number.isFinite(lowAnchorValue)) {
    fail(`${where}: invalid lowAnchorValue`)
  }
  if (!Number.isInteger(middlePlayerCount) || (middlePlayerCount as number) < 1) {
    fail(`${where}: invalid middlePlayerCount`)
  }
  if (!Array.isArray(players) || players.length !== (middlePlayerCount as number) + 2) {
    fail(`${where}: expected ${(middlePlayerCount as number) + 2} players`)
  }

  const parsed = (players as unknown[]).map((player, index) =>
    validatePlayer(player, scope as Scope, `${where}.players[${index}]`),
  )
  const [low, high, ...middles] = parsed
  if (low.anchorPosition !== 'low' || !low.isAnchor) fail(`${where}: players[0] must be the low anchor`)
  if (high.anchorPosition !== 'high' || !high.isAnchor) fail(`${where}: players[1] must be the high anchor`)
  if (middles.some((player) => player.isAnchor)) fail(`${where}: middle players cannot be anchors`)
  if (new Set(parsed.map((player) => player.playerId)).size !== parsed.length) {
    fail(`${where}: a player appears more than once`)
  }

  const windowEnd = lowAnchorValue + rangeSize
  if (Math.abs(low.value - lowAnchorValue) > EPSILON) fail(`${where}: low anchor must sit at the window start`)
  if (Math.abs(high.value - windowEnd) > EPSILON) fail(`${where}: high anchor must sit at the window end`)
  for (const player of middles) {
    if (player.value <= lowAnchorValue + EPSILON || player.value >= windowEnd - EPSILON) {
      fail(`${where}: middle player ${player.playerId} falls outside the window`)
    }
  }

  return raw as unknown as PuzzleRound
}

export function validateDailyPuzzle(raw: unknown): DailyPuzzle {
  if (!isRecord(raw)) return fail('puzzle must be an object')
  const { date, rounds, seed } = raw
  if (typeof date !== 'string' || !DATE_PATTERN.test(date)) fail('puzzle has an invalid date')
  if (typeof seed !== 'string') fail('puzzle has an invalid seed')
  if (!Array.isArray(rounds) || rounds.length !== ROUNDS_PER_DAY) {
    fail(`puzzle must have exactly ${ROUNDS_PER_DAY} rounds`)
  }

  const validRounds = (rounds as unknown[]).map((round, index) => validateRound(round, `rounds[${index}]`))
  if (new Set(validRounds.map((round) => round.categoryKey)).size !== validRounds.length) {
    fail('rounds must use distinct stat categories')
  }
  return { date, rounds: validRounds, seed }
}
