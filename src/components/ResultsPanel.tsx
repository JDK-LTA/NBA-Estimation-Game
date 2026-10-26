import { useState } from 'react'
import { copyText } from '../data/clipboard.ts'
import { STAT_CATEGORIES, SCOPE_LABELS } from '../logic/categories.ts'
import { gameTotal } from '../logic/gameState.ts'
import type { GameState } from '../logic/gameState.ts'
import { scoreTier } from '../logic/history.ts'
import { middlePlayersOf, scoreRound, totalHintsUsed } from '../logic/roundScoring.ts'
import { buildShareText, squareFor, type ShareRound } from '../logic/share.ts'
import type { PuzzleRound } from '../types/index.ts'
import styles from './ResultsPanel.module.css'

const VERDICTS = ['Back to the film room', 'Room to grow', 'Solid showing', 'Sharp eye', 'Dead-eye shooter'] as const

interface ResultsPanelProps {
  heading: string
  rounds: PuzzleRound[]
  state: GameState
  /** Shown only for official daily results. */
  streak?: number
}

export function ResultsPanel({ heading, rounds, state, streak }: ResultsPanelProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const { score, max, bonus } = gameTotal(state, rounds)
  const fraction = max > 0 ? score / max : 0
  const format = (value: number) => value.toLocaleString('en-US')

  const shareRounds: ShareRound[] = rounds.map((round, index) => {
    const scored = scoreRound(round, state.rounds[index])
    return {
      categoryKey: round.categoryKey,
      scope: round.scope,
      playerScores: middlePlayersOf(round).map((player) => scored.playerScores[player.playerId]),
      bonus: scored.bonus,
      hintsUsed: totalHintsUsed(state.rounds[index].hints),
    }
  })

  const copyShareText = async () => {
    const copied = await copyText(buildShareText(heading, shareRounds))
    setCopyState(copied ? 'copied' : 'failed')
    window.setTimeout(() => setCopyState('idle'), 2400)
  }

  return (
    <section className={styles.panel} aria-label="Results">
      <div className={styles.top}>
        <p className={styles.kicker}>{heading}</p>
        <p className={styles.total} data-testid="daily-total">
          {format(score + bonus)}
          <small> / {format(max)}</small>
        </p>
        <p className={styles.base} data-testid="daily-base">
          {bonus > 0
            ? `${format(score)} without bonus · +${format(bonus)} order bonus`
            : 'No order bonus (+100 a round for the exact order)'}
        </p>
        <p className={styles.verdict}>
          {VERDICTS[scoreTier(fraction)]} · {Math.round(fraction * 100)}%
        </p>
        {streak !== undefined && streak > 0 && (
          <p className={styles.streak}>
            <span aria-hidden="true">🔥</span> {streak}-day streak
          </p>
        )}
      </div>

      <ul className={styles.rounds}>
        {shareRounds.map((round, index) => (
          <li key={index} className={styles.round}>
            <span className={styles.roundName}>
              {STAT_CATEGORIES[round.categoryKey].unit}
              <small>{SCOPE_LABELS[round.scope]}</small>
            </span>
            <span className={styles.squares} aria-hidden="true">
              {round.playerScores.map((playerScore) => squareFor(playerScore)).join('')}
            </span>
            <span className={styles.roundScore}>
              {state.rounds[index].submitted ? scoreRound(rounds[index], state.rounds[index]).total : '-'}
              {round.bonus > 0 && <em className={styles.bonusChip}>+{round.bonus}</em>}
            </span>
          </li>
        ))}
      </ul>

      <div className={styles.actions}>
        <button type="button" className="btn btn-primary" onClick={copyShareText}>
          {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Copy failed' : 'Copy results'}
        </button>
      </div>
    </section>
  )
}
