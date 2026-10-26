import { useEffect, useState } from 'react'
import { clearStored, practiceProgressKey, progressKey } from '../data/storage.ts'
import { STAT_CATEGORIES } from '../logic/categories.ts'
import { buildHistoryEntry, isGameComplete } from '../logic/gameState.ts'
import { scoreRound, totalHintsUsed } from '../logic/roundScoring.ts'
import { formatLongDate } from '../logic/dates.ts'
import { useGame } from '../hooks/useGame.ts'
import type { DailyPuzzle, Player, UserDailyHistoryEntry } from '../types/index.ts'
import { ResultsPanel } from './ResultsPanel.tsx'
import { RoundBoard } from './RoundBoard.tsx'
import { ScopeBadge } from './ScopeBadge.tsx'
import styles from './DayView.module.css'

export const DAILY_HINTS_PER_ROUND = 3

interface DayViewProps {
  puzzle: DailyPuzzle
  players: Record<string, Player>
  /** Official daily play counts toward streaks; practice (archive) replays are saved but never counted. */
  official: boolean
  streak?: number
  /** Called with the finished day; the parent decides whether it is official or practice. */
  onComplete?: (entry: UserDailyHistoryEntry) => void
  /** Practice only: called after the saved replay is cleared so the parent can restart it. */
  onPlayAgain?: () => void
}

export function DayView({ puzzle, players, official, streak, onComplete, onPlayAgain }: DayViewProps) {
  const storageKey = official ? progressKey(puzzle.date) : practiceProgressKey(puzzle.date)
  const { state, place, hint, submit } = useGame(puzzle.rounds, DAILY_HINTS_PER_ROUND, storageKey)
  const [activeRound, setActiveRound] = useState(() => {
    const firstOpen = state.rounds.findIndex((round) => !round.submitted)
    return firstOpen === -1 ? 0 : firstOpen
  })

  const complete = isGameComplete(state)
  // Count the final score up only when the day is finished while on screen, not when reopened.
  const [completeOnMount] = useState(complete)

  useEffect(() => {
    if (complete) onComplete?.(buildHistoryEntry(puzzle.date, puzzle.rounds, state, new Date()))
  }, [complete, onComplete, puzzle, state])

  const playAgain = () => {
    clearStored(storageKey)
    onPlayAgain?.()
  }

  const nextOpenRound = state.rounds.findIndex((round, index) => index !== activeRound && !round.submitted)
  const heading = official ? formatLongDate(puzzle.date) : `${formatLongDate(puzzle.date)} · Practice`

  return (
    <div className={styles.day}>
      {complete && (
        <ResultsPanel
          heading={heading}
          rounds={puzzle.rounds}
          state={state}
          streak={official ? streak : undefined}
          rewardNoHints={official}
          muted={!official}
          animate={!completeOnMount}
        />
      )}
      {complete && !official && onPlayAgain && (
        <div className={styles.next}>
          <button type="button" className="btn" onClick={playAgain}>
            Play this day again
          </button>
        </div>
      )}

      <div className={styles.tabs} role="tablist" aria-label="Rounds">
        {puzzle.rounds.map((round, index) => {
          const roundState = state.rounds[index]
          const category = STAT_CATEGORIES[round.categoryKey]
          const scored = roundState.submitted ? scoreRound(round, roundState) : null
          const hintFree = official && scored !== null && totalHintsUsed(roundState.hints) === 0
          return (
            <button
              key={round.categoryKey}
              type="button"
              role="tab"
              id={`round-tab-${index}`}
              aria-selected={activeRound === index}
              aria-controls="round-panel"
              className={`${styles.tab} ${activeRound === index ? styles.tabActive : ''}`}
              onClick={() => setActiveRound(index)}
            >
              <span className={styles.tabIndex}>Round {index + 1}</span>
              <span className={styles.tabName}>{category.unit}</span>
              <ScopeBadge scope={round.scope} />
              {scored && <span className={styles.tabMeta}>{scored.total + scored.bonus} pts</span>}
              {scored && (
                <span
                  className={`${styles.check} ${hintFree ? styles.checkGold : ''} ${official ? '' : styles.checkMuted}`}
                  aria-label={hintFree ? 'Completed without hints' : 'Completed'}
                >
                  {hintFree ? '★' : '✓'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div id="round-panel" role="tabpanel" aria-labelledby={`round-tab-${activeRound}`}>
        <RoundBoard
          key={`${puzzle.date}-${activeRound}`}
          round={puzzle.rounds[activeRound]}
          players={players}
          state={state.rounds[activeRound]}
          hintsPerRound={DAILY_HINTS_PER_ROUND}
          onPlace={(playerId, position) => place(activeRound, playerId, position)}
          onHint={(playerId) => hint(activeRound, playerId)}
          onSubmit={() => submit(activeRound)}
          rewardNoHints={official}
          muted={!official}
          afterSubmit={
            nextOpenRound !== -1 && (
              <div className={styles.next}>
                <button type="button" className="btn btn-primary" onClick={() => setActiveRound(nextOpenRound)}>
                  Next round: {STAT_CATEGORIES[puzzle.rounds[nextOpenRound].categoryKey].unit} →
                </button>
              </div>
            )
          }
        />
      </div>
    </div>
  )
}
