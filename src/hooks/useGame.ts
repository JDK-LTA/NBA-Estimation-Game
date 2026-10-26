import { useCallback, useEffect, useState } from 'react'
import { readProgress, writeProgress } from '../data/storage.ts'
import {
  initialGameState,
  placePlayer,
  puzzleSignature,
  restoreGameState,
  spendHint,
  submitRound,
  type GameState,
} from '../logic/gameState.ts'
import type { PuzzleRound } from '../types/index.ts'

export interface GameApi {
  state: GameState
  place: (roundIndex: number, playerId: string, position: number) => void
  hint: (roundIndex: number, playerId: string) => void
  submit: (roundIndex: number) => void
}

function hasActivity(state: GameState): boolean {
  return state.rounds.some(
    (round) => round.submitted || Object.keys(round.positions).length > 0 || Object.keys(round.hints).length > 0,
  )
}

/**
 * Game state for a set of rounds. When `persistKey` is given (a storage key for
 * today's puzzle or a practice replay) progress survives refreshes; Infinite Mode
 * passes null. Remount with a new `key` to start a different puzzle.
 */
export function useGame(rounds: PuzzleRound[], hintsPerRound: number, persistKey: string | null): GameApi {
  const signature = puzzleSignature(rounds)
  const [state, setState] = useState<GameState>(() => {
    if (!persistKey) return initialGameState(rounds.length)
    const saved = readProgress(persistKey) as { signature?: string } | null
    // Progress saved for a different (e.g. regenerated) puzzle must not carry over.
    return restoreGameState(saved?.signature === signature ? saved : null, rounds)
  })

  useEffect(() => {
    if (persistKey && hasActivity(state)) writeProgress(persistKey, { ...state, signature })
  }, [state, persistKey, signature])

  const place = useCallback(
    (roundIndex: number, playerId: string, position: number) =>
      setState((previous) => placePlayer(previous, rounds, roundIndex, playerId, position)),
    [rounds],
  )
  const hint = useCallback(
    (roundIndex: number, playerId: string) =>
      setState((previous) => spendHint(previous, rounds, roundIndex, playerId, hintsPerRound)),
    [rounds, hintsPerRound],
  )
  const submit = useCallback(
    (roundIndex: number) => setState((previous) => submitRound(previous, rounds, roundIndex)),
    [rounds],
  )

  return { state, place, hint, submit }
}
