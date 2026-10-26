import { useCountUp, useMotionAllowed } from '../hooks/useCountUp.ts'
import styles from './ScoreReveal.module.css'

const COUNT_MS = 1000
const BONUS_DELAY_MS = 1250

interface ScoreRevealProps {
  /** Points from the placements. */
  base: number
  /** Order bonus, counted up after the base score has landed. */
  bonus: number
  max: number
  animate: boolean
  format?: (value: number) => string
}

/** The big "score / max" figure; counts up when `animate` is set. */
export function ScoreReveal({ base, bonus, max, animate, format = String }: ScoreRevealProps) {
  const playing = useMotionAllowed() && animate
  const baseShown = useCountUp(base, { animate, durationMs: COUNT_MS, delayMs: 150 })
  const bonusShown = useCountUp(bonus, { animate, durationMs: 450, delayMs: BONUS_DELAY_MS })
  const final = format(base + bonus)

  return (
    <>
      {playing ? (
        <>
          <span aria-hidden="true">{format(baseShown + bonusShown)}</span>
          <span className="visually-hidden">{final}</span>
        </>
      ) : (
        final
      )}
      <small> / {format(max)}</small>
    </>
  )
}

interface BonusPillProps {
  earned: boolean
  bonus: number
  animate: boolean
  label?: string
}

/** Gold "exact order" badge, or a muted note when the order bonus was missed. */
export function BonusPill({ earned, bonus, animate, label = 'exact order' }: BonusPillProps) {
  const playing = useMotionAllowed() && animate
  if (earned) {
    return (
      <span className={`${styles.earned} ${playing ? styles.earnedPlay : ''}`}>
        <span aria-hidden="true">★</span> +{bonus} {label}
      </span>
    )
  }
  return (
    <span className={`${styles.missed} ${playing ? styles.missedPlay : ''}`}>
      <s>+{bonus}</s> Order bonus missed
    </span>
  )
}

/** Gold chip for a round or day finished without any hint. */
export function NoHintsChip({ children, animate }: { children: string; animate?: boolean }) {
  const playing = useMotionAllowed() && Boolean(animate)
  return (
    <span className={`${styles.noHints} ${playing ? styles.noHintsPlay : ''}`}>
      <span aria-hidden="true">✦</span> {children}
    </span>
  )
}
