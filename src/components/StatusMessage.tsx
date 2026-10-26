import type { ReactNode } from 'react'
import styles from './StatusMessage.module.css'

interface StatusMessageProps {
  kind: 'loading' | 'error' | 'empty'
  title: string
  children?: ReactNode
}

export function StatusMessage({ kind, title, children }: StatusMessageProps) {
  return (
    <div className={`${styles.box} ${styles[kind]}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'loading' && <span className={styles.spinner} aria-hidden="true" />}
      <p className={styles.title}>{title}</p>
      {children && <div className={styles.body}>{children}</div>}
    </div>
  )
}
