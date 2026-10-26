import { hintBand, type Band } from './hints.ts'
import { actualPercent, maxRoundScore, playerScore, ORDER_BONUS } from './scoring.ts'
import type { PuzzleRound, RoundPlayerSelection } from '../types/index.ts'

/** What the player did in one round: slider positions (0-1) and hints per player. */
export interface RoundAnswers {
  positions: Record<string, number>
  hints: Record<string, number>
}

export interface ScoredRound {
  playerScores: Record<string, number>
  /** Points from the placements alone; the bonus is reported separately. */
  total: number
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

export function hintBandFor(round: PuzzleRound, player: RoundPlayerSelection, hintCount: number): Band {
  const seed = [round.categoryKey, round.scope, round.lowAnchorValue, player.playerId, player.season].join('|')
  return hintBand(truePercent(round, player), hintCount, seed)
}

export function totalHintsUsed(hints: Record<string, number>): number {
  return Object.values(hints).reduce((sum, count) => sum + count, 0)
}

/** True when guessed positions rise strictly in the same order as the real values. */
export function isOrderCorrect(round: PuzzleRound, positions: Record<string, number>): boolean {
  const byValue = middlePlayersOf(round).sort((a, b) => a.value - b.value)
  return byValue.every((player, index) => {
    const position = positions[player.playerId]
    if (position === undefined) return false
    return index === 0 || position > positions[byValue[index - 1].playerId]
  })
}

export function scoreRound(round: PuzzleRound, answers: RoundAnswers): ScoredRound {
  const playerScores: Record<string, number> = {}
  let total = 0
  for (const player of middlePlayersOf(round)) {
    const score = playerScore({
      actualValue: player.value,
      userPercent: answers.positions[player.playerId] ?? 0.5,
      lowAnchorValue: round.lowAnchorValue,
      rangeSize: round.rangeSize,
      hintsOnThisPlayer: answers.hints[player.playerId] ?? 0,
    })
    playerScores[player.playerId] = score
    total += score
  }
  const orderCorrect = isOrderCorrect(round, answers.positions)
  return {
    playerScores,
    total,
    max: maxRoundScore(round.middlePlayerCount),
    orderCorrect,
    bonus: orderCorrect ? ORDER_BONUS : 0,
  }
}
