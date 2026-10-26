import { clampToBand } from './hints.ts'
import { hashString } from './rng.ts'
import {
  hintBandFor,
  middlePlayersOf,
  scoreRound,
  totalHintsUsed,
  type RoundAnswers,
} from './roundScoring.ts'
import type { PuzzleRound, UserDailyHistoryEntry } from '../types/index.ts'

export interface RoundState extends RoundAnswers {
  submitted: boolean
}

export interface GameState {
  rounds: RoundState[]
}

export function initialGameState(roundCount: number): GameState {
  return {
    rounds: Array.from({ length: roundCount }, () => ({ positions: {}, hints: {}, submitted: false })),
  }
}

/** Identifies the exact puzzle content, so saved progress can't be applied to a different one. */
export function puzzleSignature(rounds: PuzzleRound[]): string {
  const text = rounds
    .map((round) => `${round.categoryKey}:${round.players.map((p) => `${p.playerId}@${p.season}`).join(',')}`)
    .join('|')
  return hashString(text).toString(36)
}

function updateRound(state: GameState, index: number, next: RoundState): GameState {
  return { rounds: state.rounds.map((round, i) => (i === index ? next : round)) }
}

export function isMiddlePlayer(round: PuzzleRound, playerId: string): boolean {
  return middlePlayersOf(round).some((player) => player.playerId === playerId)
}

export function isRoundFullyPlaced(round: PuzzleRound, state: RoundState): boolean {
  return middlePlayersOf(round).every((player) => state.positions[player.playerId] !== undefined)
}

/** Places (or moves) a marker, keeping it inside any hint band for that player. */
export function placePlayer(
  state: GameState,
  rounds: PuzzleRound[],
  roundIndex: number,
  playerId: string,
  position: number,
): GameState {
  const round = rounds[roundIndex]
  const current = state.rounds[roundIndex]
  if (!round || !current || current.submitted || !isMiddlePlayer(round, playerId) || !Number.isFinite(position)) {
    return state
  }

  const player = middlePlayersOf(round).find((p) => p.playerId === playerId)!
  const band = hintBandFor(round, player, current.hints[playerId] ?? 0)
  const clamped = clampToBand(Math.min(1, Math.max(0, position)), band)
  return updateRound(state, roundIndex, {
    ...current,
    positions: { ...current.positions, [playerId]: clamped },
  })
}

export function canUseHint(
  state: GameState,
  roundIndex: number,
  playerId: string,
  hintsPerRound: number,
  round?: PuzzleRound,
): boolean {
  const current = state.rounds[roundIndex]
  if (!current || current.submitted) return false
  if (round && !isMiddlePlayer(round, playerId)) return false
  return totalHintsUsed(current.hints) < hintsPerRound
}

/** Spends one hint on a player, narrowing their band and nudging a placed marker inside it. */
export function spendHint(
  state: GameState,
  rounds: PuzzleRound[],
  roundIndex: number,
  playerId: string,
  hintsPerRound: number,
): GameState {
  const round = rounds[roundIndex]
  if (!round || !canUseHint(state, roundIndex, playerId, hintsPerRound, round)) return state

  const current = state.rounds[roundIndex]
  const hintCount = (current.hints[playerId] ?? 0) + 1
  const player = middlePlayersOf(round).find((p) => p.playerId === playerId)!
  const band = hintBandFor(round, player, hintCount)

  const positions = { ...current.positions }
  if (positions[playerId] !== undefined) positions[playerId] = clampToBand(positions[playerId], band)

  return updateRound(state, roundIndex, {
    ...current,
    positions,
    hints: { ...current.hints, [playerId]: hintCount },
  })
}

export function submitRound(state: GameState, rounds: PuzzleRound[], roundIndex: number): GameState {
  const round = rounds[roundIndex]
  const current = state.rounds[roundIndex]
  if (!round || !current || current.submitted || !isRoundFullyPlaced(round, current)) return state
  return updateRound(state, roundIndex, { ...current, submitted: true })
}

export function isGameComplete(state: GameState): boolean {
  return state.rounds.length > 0 && state.rounds.every((round) => round.submitted)
}

export function gameTotal(
  state: GameState,
  rounds: PuzzleRound[],
): { score: number; max: number; bonus: number } {
  let score = 0
  let max = 0
  let bonus = 0
  rounds.forEach((round, index) => {
    const scored = scoreRound(round, state.rounds[index])
    max += scored.max
    if (state.rounds[index].submitted) {
      score += scored.total
      bonus += scored.bonus
    }
  })
  return { score, max, bonus }
}

export function buildHistoryEntry(
  date: string,
  rounds: PuzzleRound[],
  state: GameState,
  completedAt: Date,
): UserDailyHistoryEntry {
  const { score, max, bonus } = gameTotal(state, rounds)
  return {
    date,
    dailyScore: score,
    bonusScore: bonus,
    maxScore: max,
    completedAt: completedAt.toISOString(),
    roundResults: rounds.map((round, roundIndex) => {
      const scored = scoreRound(round, state.rounds[roundIndex])
      return {
        date,
        roundIndex,
        categoryKey: round.categoryKey,
        score: scored.total,
        bonus: scored.bonus,
        hintsUsedByPlayer: { ...state.rounds[roundIndex].hints },
        guesses: { ...state.rounds[roundIndex].positions },
      }
    }),
  }
}

/**
 * Rebuilds saved progress, dropping anything that doesn't fit the puzzle so
 * corrupted or stale storage can never crash the UI.
 */
export function restoreGameState(raw: unknown, rounds: PuzzleRound[]): GameState {
  const fresh = initialGameState(rounds.length)
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as GameState).rounds)) return fresh
  const saved = (raw as GameState).rounds
  if (saved.length !== rounds.length) return fresh

  return {
    rounds: rounds.map((round, index) => {
      const entry = saved[index] as Partial<RoundState> | null
      if (typeof entry !== 'object' || entry === null) return fresh.rounds[index]

      const positions: Record<string, number> = {}
      const hints: Record<string, number> = {}
      for (const player of middlePlayersOf(round)) {
        const position = entry.positions?.[player.playerId]
        if (typeof position === 'number' && Number.isFinite(position)) {
          positions[player.playerId] = Math.min(1, Math.max(0, position))
        }
        const hintCount = entry.hints?.[player.playerId]
        if (typeof hintCount === 'number' && Number.isInteger(hintCount) && hintCount > 0) {
          hints[player.playerId] = hintCount
        }
      }
      const restored: RoundState = { positions, hints, submitted: false }
      restored.submitted = entry.submitted === true && isRoundFullyPlaced(round, restored)
      return restored
    }),
  }
}
