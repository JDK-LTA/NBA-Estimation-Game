import { useEffect, useRef } from 'react'
import styles from './HowToPlay.module.css'

interface HowToPlayProps {
  open: boolean
  onClose: () => void
}

export function HowToPlay({ open, onClose }: HowToPlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || typeof dialog.showModal !== 'function') return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose} aria-labelledby="howto-title">
      <h2 id="howto-title" className={styles.title}>
        How to play
      </h2>
      <ol className={styles.steps}>
        <li>
          <strong>Two anchors</strong> sit at the ends of the slider with their real stat shown. Everyone else falls
          somewhere between them. The slider&apos;s width is approximate (shown with a ~) and varies slightly from
          puzzle to puzzle.
        </li>
        <li>
          <strong>Place every player</strong>: select one, then tap the track where you think their number lands. Drag
          markers or use the arrow keys to fine-tune.
        </li>
        <li>
          <strong>Use hints wisely.</strong> Each hint halves the range for one player, but cuts the most they can
          score (75%, then 30%, then 10% when stacked).
        </li>
        <li>
          <strong>Lock in each round.</strong> Closer guesses score up to 100 per player. Three rounds a day, a new
          puzzle at midnight.
        </li>
      </ol>
      <p className={styles.note}>Rounds can be single seasons, playoff runs, or full careers, and every player can come from a different year.</p>
      <form method="dialog">
        <button className="btn btn-primary" autoFocus>
          Let&apos;s play
        </button>
      </form>
    </dialog>
  )
}
