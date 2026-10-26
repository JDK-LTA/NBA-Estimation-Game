import { useCallback, useEffect, useState } from 'react'
import { readStored, writeStored } from '../data/storage.ts'

export type Theme = 'light' | 'dark'

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

function systemTheme(): Theme {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

/** The saved choice if there is one, otherwise the OS preference. */
function initialTheme(): Theme {
  const saved = readStored<unknown>('theme', null)
  return isTheme(saved) ? saved : systemTheme()
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((previous) => {
      const next = previous === 'dark' ? 'light' : 'dark'
      writeStored('theme', next)
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
