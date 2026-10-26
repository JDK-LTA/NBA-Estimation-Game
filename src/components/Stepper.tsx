import styles from './Stepper.module.css'

interface StepperProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  decimals?: number
  /** Shown instead of the number (e.g. "Default"). */
  display?: string
  onChange: (value: number) => void
}

export function Stepper({ label, value, min, max, step = 1, decimals = 0, display, onChange }: StepperProps) {
  const apply = (delta: number) => {
    const next = Math.round((value + delta) / step) * step
    onChange(Math.min(max, Math.max(min, Number(next.toFixed(decimals)))))
  }

  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button type="button" className={styles.button} onClick={() => apply(-step)} disabled={value <= min} aria-label={`Decrease ${label}`}>
        −
      </button>
      <output className={styles.value} aria-live="polite">
        {display ?? value.toFixed(decimals)}
      </output>
      <button type="button" className={styles.button} onClick={() => apply(step)} disabled={value >= max} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  )
}
