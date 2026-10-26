import { entryLabel, formatStatValue } from '../logic/categories.ts'
import type { Player, PuzzleRound, RoundPlayerSelection } from '../types/index.ts'
import { PlayerAvatar } from './PlayerAvatar.tsx'
import styles from './AnchorCard.module.css'

interface AnchorCardProps {
  anchor: RoundPlayerSelection
  player: Player | undefined
  round: PuzzleRound
  side: 'low' | 'high'
}

/** One of the two fixed reference players; its real value is always visible. */
export function AnchorCard({ anchor, player, round, side }: AnchorCardProps) {
  return (
    <div className={`${styles.card} ${side === 'high' ? styles.high : ''}`} data-testid={`anchor-${side}`}>
      <PlayerAvatar player={player} size={48} />
      <div className={styles.text}>
        <span className={styles.tag}>{side === 'low' ? 'Low anchor' : 'High anchor'}</span>
        <span className={styles.name}>{player?.fullName ?? 'Unknown player'}</span>
        <span className={styles.meta}>
          {entryLabel(round.scope, anchor.season)}
          {player?.position ? ` · ${player.position}` : ''}
        </span>
      </div>
      <div className={styles.value}>{formatStatValue(anchor.value, round.categoryKey)}</div>
    </div>
  )
}
