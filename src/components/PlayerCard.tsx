import type { CSSProperties } from 'react'
import { entryLabel } from '../logic/categories.ts'
import { penaltyMultiplier } from '../logic/scoring.ts'
import { scoreTier } from '../logic/history.ts'
import type { Player, RoundPlayerSelection, Scope } from '../types/index.ts'
import { PlayerAvatar } from './PlayerAvatar.tsx'
import styles from './PlayerCard.module.css'

interface PlayerCardProps {
  player: Player | undefined
  selection: RoundPlayerSelection
  scope: Scope
  color: string
  selected: boolean
  /** Formatted current guess, e.g. "17.4"; undefined until placed. */
  guessLabel?: string
  hintCount: number
  canHint: boolean
  revealed: boolean
  score?: number
  /** What the guess would have scored without hints. */
  baseScore?: number
  /** Practice (archive) replays use muted colours. */
  muted?: boolean
  actualLabel?: string
  unit: string
  onSelect: () => void
  onHint: () => void
}

export function PlayerCard({
  player,
  selection,
  scope,
  color,
  selected,
  guessLabel,
  hintCount,
  canHint,
  revealed,
  score,
  baseScore,
  muted = false,
  actualLabel,
  unit,
  onSelect,
  onHint,
}: PlayerCardProps) {
  const name = player?.fullName ?? 'Unknown player'
  const nextCap = Math.round(penaltyMultiplier(hintCount + 1) * 100)
  const tier = score === undefined ? 0 : scoreTier(score / 100)
  const hintCost = baseScore !== undefined && score !== undefined ? baseScore - score : 0

  return (
    <li
      className={`${styles.card} ${selected && !revealed ? styles.selected : ''}`}
      style={{ '--c': color } as CSSProperties}
      data-testid={`card-${selection.playerId}`}
    >
      <button
        type="button"
        className={styles.main}
        onClick={onSelect}
        aria-pressed={selected}
        disabled={revealed}
      >
        <PlayerAvatar player={player} size={46} ringColor={color} />
        <span className={styles.text}>
          <span className={styles.name}>{name}</span>
          <span className={styles.meta}>
            {entryLabel(scope, selection.season)}
            {player?.position ? ` · ${player.position}` : ''}
          </span>
        </span>
        <span className={styles.status}>
          {revealed ? (
            <>
              {hintCost > 0 && (
                <s className={styles.was} aria-label={`Without hints ${baseScore}`}>
                  {baseScore}
                </s>
              )}
              <span
                className={`${styles.score} ${styles[`tier${tier}`]} ${muted ? styles.mutedScore : ''}`}
                aria-label={`Score ${score}`}
              >
                {score}
              </span>
            </>
          ) : guessLabel !== undefined ? (
            <span className={styles.guess}>
              {guessLabel}
              <small>{unit}</small>
            </span>
          ) : (
            <span className={styles.unplaced}>Not placed</span>
          )}
        </span>
      </button>

      {revealed ? (
        <p className={styles.result}>
          Actual <strong>{actualLabel}</strong> {unit}
          {guessLabel !== undefined && (
            <>
              {' '}
              · you said <strong>{guessLabel}</strong>
            </>
          )}
          {hintCount > 0 && ` · ${hintCount} hint${hintCount === 1 ? '' : 's'}${hintCost > 0 ? ` cost ${hintCost} pt${hintCost === 1 ? '' : 's'}` : ''}`}
        </p>
      ) : (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.hintButton}
            onClick={onHint}
            disabled={!canHint}
            aria-label={`Use a hint on ${name}. Halves their range; their maximum score becomes ${nextCap}%.`}
            title={`Halve the range for ${name} (max score drops to ${nextCap}%)`}
          >
            <span aria-hidden="true">💡</span> Hint
          </button>
          {hintCount > 0 && (
            <span className={styles.pips} aria-label={`${hintCount} hint${hintCount === 1 ? '' : 's'} used`}>
              {Array.from({ length: hintCount }, (_, i) => (
                <i key={i} />
              ))}
            </span>
          )}
        </div>
      )}
    </li>
  )
}
