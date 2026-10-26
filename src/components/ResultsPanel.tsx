import { useState } from 'react'
import { copyText } from '../data/clipboard.ts'
import { STAT_CATEGORIES, SCOPE_LABELS } from '../logic/categories.ts'
import { gameTotal } from '../logic/gameState.ts'
import type { GameState } from '../logic/gameState.ts'
import { scoreTier } from '../logic/history.ts'
import { middlePlayersOf, scoreRound, totalHintsUsed } from '../logic/roundScoring.ts'
import { buildShareText, squareFor, type ShareRound } from '../logic/share.ts'
import { ORDER_BONUS } from '../logic/scoring.ts'
import type { PuzzleRound } from '../types/index.ts'
import { BonusPill, NoHintsChip, ScoreReveal } from './ScoreReveal.tsx'
import styles from './ResultsPanel.module.css'

const VERDICTS = ['Back to the film room', 'Room to grow', 'Solid showing', 'Sharp eye', 'Dead-eye shooter'] as const

interface ResultsPanelProps {
  heading: string
  rounds: PuzzleRound[]
  state: GameState
  /** Shown only for official daily results. */
  streak?: number
  /** Official daily play: a hint-free day gets a gold banner. */
  rewardNoHints?: boolean
  /** Practice (archive) replays use muted colours. */
  muted?: boolean
  /** Count the score up (only when the day was just finished on screen). */
  animate?: boolean
}

export function ResultsPanel({ heading, rounds, state, streak, rewardNoHints = false, muted = false, animate = false }: ResultsPanelProps) {
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

  const scoredRounds = rounds.map((round, index) => scoreRound(round, state.rounds[index]))
  const hintPenalty = scoredRounds.reduce((sum, scored) => sum + scored.hintPenalty, 0)
  const hintFree = shareRounds.every((round) => round.hintsUsed === 0)
  const showHintFree = rewardNoHints && hintFree
  const bonusRounds = scoredRounds.filter((scored) => scored.bonus > 0).length

  return (
    <section
      className={`${styles.panel} ${muted ? styles.muted : ''} ${showHintFree ? styles.gold : ''}`}
      aria-label="Results"
    >
      <div className={styles.top}>
        <p className={styles.kicker}>{heading}</p>
        <p className={styles.total} data-testid="daily-total">
          <ScoreReveal base={score} bonus={bonus} max={max} animate={animate} format={format} />
        </p>
        <p className={styles.base} data-testid="daily-base">
          {format(score)} from placements
          {hintPenalty > 0 && ` · hints cost ${format(hintPenalty)} pts (${format(score + hintPenalty)} without hints)`}
        </p>
        <div className={styles.badges}>
          {bonusRounds > 0 ? (
            <BonusPill earned bonus={bonus} animate={animate} label={`order bonus (${bonusRounds}/${rounds.length} rounds)`} />
          ) : (
            <BonusPill earned={false} bonus={ORDER_BONUS} animate={animate} />
          )}
          {showHintFree && <NoHintsChip animate={animate}>Hint-free day</NoHintsChip>}
        </div>
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
              <small>
                {SCOPE_LABELS[round.scope]}
                {rewardNoHints && round.hintsUsed === 0 && state.rounds[index].submitted && (
                  <span className={styles.noHint}> · ✦ no hints</span>
                )}
              </small>
            </span>
            <span className={styles.squares} aria-hidden="true">
              {round.playerScores.map((playerScore) => squareFor(playerScore)).join('')}
            </span>
            <span className={styles.roundScore}>
              {state.rounds[index].submitted ? scoredRounds[index].total : '-'}
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
