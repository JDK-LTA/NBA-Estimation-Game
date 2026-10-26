// Pure scoring functions (TDD.md 2.5 / 2.6).

export const MAX_PLAYER_SCORE = 100
export const MIN_PENALTY_MULTIPLIER = 0.1
/** Extra points per round for the exact left-to-right order; never part of the shown maximum. */
export const ORDER_BONUS = 100

/** Escalating cost for stacking hints on one player; starting constants per TDD 2.5. */
export function penaltyMultiplier(hintsOnThisPlayer: number): number {
  const h = Math.max(0, hintsOnThisPlayer)
  return Math.max(MIN_PENALTY_MULTIPLIER, 1 - (0.15 * h + 0.1 * h * h))
}

/** Where a real value sits on the slider, 0 (low anchor) to 1 (high anchor). */
export function actualPercent(actualValue: number, lowAnchorValue: number, rangeSize: number): number {
  if (!(rangeSize > 0)) throw new RangeError('rangeSize must be greater than 0')
  return (actualValue - lowAnchorValue) / rangeSize
}

export function baseScore(actualPct: number, userPct: number): number {
  const error = Math.abs(actualPct - userPct)
  return Math.min(MAX_PLAYER_SCORE, Math.max(0, Math.round(MAX_PLAYER_SCORE * (1 - error))))
}

export interface PlayerScoreInput {
  actualValue: number
  userPercent: number
  lowAnchorValue: number
  rangeSize: number
  hintsOnThisPlayer: number
}

export function playerScore(input: PlayerScoreInput): number {
  const actualPct = actualPercent(input.actualValue, input.lowAnchorValue, input.rangeSize)
  const base = baseScore(actualPct, input.userPercent)
  return Math.round(base * penaltyMultiplier(input.hintsOnThisPlayer))
}

export function sumScores(scores: readonly number[]): number {
  return scores.reduce((total, score) => total + score, 0)
}

export function maxRoundScore(middlePlayerCount: number): number {
  return middlePlayerCount * MAX_PLAYER_SCORE
}
