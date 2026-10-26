import { useCallback, useEffect, useState } from 'react'
import { readHistory, readPracticeHistory, writeHistory, writePracticeHistory } from '../data/storage.ts'
import { totalScoreOf, type HistoryMap } from '../logic/history.ts'
import type { UserDailyHistoryEntry } from '../types/index.ts'

export interface PersonalHistory {
  /** Official daily results: the only thing streaks and stats are computed from. */
  history: HistoryMap
  /** Saves an official daily result; an existing entry for that date is never overwritten. */
  record: (entry: UserDailyHistoryEntry) => void
  /** Archive replays: saved for the calendar, never counted in stats. */
  practice: HistoryMap
  /** Saves a practice result; a newer replay replaces the previous one. */
  recordPractice: (entry: UserDailyHistoryEntry) => void
}

export function usePersonalHistory(): PersonalHistory {
  const [history, setHistory] = useState<HistoryMap>(readHistory)
  const [practice, setPractice] = useState<HistoryMap>(readPracticeHistory)

  useEffect(() => {
    writeHistory(history)
  }, [history])

  useEffect(() => {
    writePracticeHistory(practice)
  }, [practice])

  const record = useCallback((entry: UserDailyHistoryEntry) => {
    setHistory((previous) => (previous[entry.date] ? previous : { ...previous, [entry.date]: entry }))
  }, [])

  const recordPractice = useCallback((entry: UserDailyHistoryEntry) => {
    setPractice((previous) =>
      previous[entry.date] && totalScoreOf(previous[entry.date]) === totalScoreOf(entry)
        ? previous
        : { ...previous, [entry.date]: entry },
    )
  }, [])

  return { history, record, practice, recordPractice }
}
