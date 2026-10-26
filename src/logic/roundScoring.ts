import { STAT_CATEGORIES } from './categories.ts'
import { hintBand, type Band } from './hints.ts'
import { actualPercent, baseScore, maxRoundScore, penaltyMultiplier, ORDER_BONUS } from './scoring.ts'
import type { PuzzleRound, RoundPlayerSelection } from '../types/index.ts'

/** What the player did in one round: slider positions (0-1) and hints per player. */
export interface RoundAnswers {
  positions: Record<string, number>
  hints: Record<string, number>
}

export interface ScoredRound {
  /** Final score per middle player, after any hint penalty. */
  playerScores: Record<string, number>
  /** What each player would have scored without hints. */
  playerBaseScores: Record<string, number>
  /** Points from the placements alone; the bonus is reported separately. */
  total: number
  /** Points the hints cost this round (sum of base minus final scores). */
  hintPenalty: number
  max: number
  orderCorrect: boolean
  /** ORDER_BONUS when every marker is in the true left-to-right order, else 0. */
  bonus: number
}

export function anchorsOf(round: PuzzleRound): { low: RoundPlayerSelection; high: RoundPlayerSelection } {
  return { low: round.players[0], high: round.players[1] }
}

export function middlePlayersOf(round: PuzzleRound): RoundPlayerSelection[] {
  return round.players.slice(2)
}

export function truePercent(round: PuzzleRound, player: RoundPlayerSelection): number {
  return actualPercent(player.value, round.lowAnchorValue, round.rangeSize)
}

/** Stat value a slider position represents. */
export function valueAtPercent(round: PuzzleRound, percent: number): number {
  return round.lowAnchorValue + percent * round.rangeSize
}

/** Values are scored in whole display units (tenths), so 2.04 and 2.0 are the same guess. */
function unitScale(round: PuzzleRound): number {
  return 10 ** STAT_CATEGORIES[round.categoryKey].decimals
}

function windowUnits(round: PuzzleRound): number {
  return Math.round(round.rangeSize * unitScale(round))
}

/** The display-unit value a slider position stands for (e.g. 224 for 22.4). */
export function guessUnits(round: PuzzleRound, position: number): number {
  return Math.round(valueAtPercent(round, position) * unitScale(round))
}

/** Moves a position to the nearest displayable value, inside the slider. */
export function snapPosition(round: PuzzleRound, position: number): number {
  const lowUnits = Math.round(round.lowAnchorValue * unitScale(round))
  const width = windowUnits(round)
  const units = Math.min(lowUnits + width, Math.max(lowUnits, guessUnits(round, position)))
  return (units - lowUnits) / width
}

export function hintBandFor(round: PuzzleRound, player: RoundPlayerSelection, hintCount: number): Band {
  const seed = [round.categoryKey, round.scope, round.lowAnchorValue, player.playerId, player.season].join('|')
  return hintBand(truePercent(round, player), hintCount, seed)
}

export function totalHintsUsed(hints: Record<string, number>): number {
  return Object.values(hints).reduce((sum, count) => sum + count, 0)
}

/** True when guessed values rise strictly in the same order as the real values. */
export function isOrderCorrect(round: PuzzleRound, positions: Record<string, number>): boolean {
  const byValue = middlePlayersOf(round).sort((a, b) => a.value - b.value)
  return byValue.every((player, index) => {
    const position = positions[player.playerId]
    if (position === undefined) return false
    return index === 0 || guessUnits(round, position) > guessUnits(round, positions[byValue[index - 1].playerId])
  })
}

export function scoreRound(round: PuzzleRound, answers: RoundAnswers): ScoredRound {
  const scale = unitScale(round)
  const lowUnits = Math.round(round.lowAnchorValue * scale)
  const width = windowUnits(round)

  const playerScores: Record<string, number> = {}
  const playerBaseScores: Record<string, number> = {}
  let total = 0
  let baseTotal = 0
  for (const player of middlePlayersOf(round)) {
    const actualPct = (Math.round(player.value * scale) - lowUnits) / width
    const guessPct = (guessUnits(round, answers.positions[player.playerId] ?? 0.5) - lowUnits) / width
    const base = baseScore(actualPct, guessPct)
    const score = Math.round(base * penaltyMultiplier(answers.hints[player.playerId] ?? 0))
    playerBaseScores[player.playerId] = base
    playerScores[player.playerId] = score
    baseTotal += base
    total += score
  }
  const orderCorrect = isOrderCorrect(round, answers.positions)
  return {
    playerScores,
    playerBaseScores,
    total,
    hintPenalty: baseTotal - total,
    max: maxRoundScore(round.middlePlayerCount),
    orderCorrect,
    bonus: orderCorrect ? ORDER_BONUS : 0,
  }
}
