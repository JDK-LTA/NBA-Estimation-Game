import type { CSSProperties } from 'react'
import { SCOPE_LABELS } from '../logic/categories.ts'
import type { Scope } from '../types/index.ts'
import styles from './ScopeBadge.module.css'

interface ScopeBadgeProps {
  scope: Scope
  size?: 'sm' | 'lg'
}

/** Colour-coded pill for the round type (career / single season / playoff run). */
export function ScopeBadge({ scope, size = 'sm' }: ScopeBadgeProps) {
  return (
    <span
      className={`${styles.badge} ${size === 'lg' ? styles.large : ''}`}
      style={{ '--scope-color': `var(--scope-${scope})` } as CSSProperties}
      data-scope={scope}
    >
      {SCOPE_LABELS[scope]}
    </span>
  )
}
