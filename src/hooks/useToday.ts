import { useEffect, useState } from 'react'
import { todayString } from '../logic/dates.ts'

/** Today's local date; re-checked every 30s so the puzzle rolls over at midnight. */
export function useToday(): string {
  const [today, setToday] = useState(() => todayString())

  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayString()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  return today
}
