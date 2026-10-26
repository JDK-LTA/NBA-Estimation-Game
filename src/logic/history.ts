import { shiftDate } from './dates.ts'
import type { UserDailyHistoryEntry } from '../types/index.ts'

export type HistoryMap = Record<string, UserDailyHistoryEntry>

export interface Streaks {
  current: number
  longest: number
}

/** A streak survives until the end of the day after the last completed day. */
export function computeStreaks(completedDates: readonly string[], today: string): Streaks {
  const dates = [...new Set(completedDates)].sort()
  if (dates.length === 0) return { current: 0, longest: 0 }

  let longest = 1
  let run = 1
  for (let i = 1; i < dates.length; i++) {
    run = dates[i] === shiftDate(dates[i - 1], 1) ? run + 1 : 1
    longest = Math.max(longest, run)
  }

  const set = new Set(dates)
  let cursor = set.has(today) ? today : shiftDate(today, -1)
  let current = 0
  while (set.has(cursor)) {
    current++
    cursor = shiftDate(cursor, -1)
  }
  return { current, longest }
}

export interface HistorySummary {
  gamesPlayed: number
  averageScore: number
  bestScore: number
  averagePercent: number
  streaks: Streaks
  hintsUsed: number
  /** Rounds in which the exact-order bonus was earned. */
  bonusRounds: number
}

/** A day's score including any order bonuses. */
export function totalScoreOf(entry: UserDailyHistoryEntry): number {
  return entry.dailyScore + (entry.bonusScore ?? 0)
}

export function summarizeHistory(history: HistoryMap, today: string): HistorySummary {
  const entries = Object.values(history)
  const scores = entries.map(totalScoreOf)
  const percents = entries.map((entry) => (entry.maxScore > 0 ? entry.dailyScore / entry.maxScore : 0))
  const average = (values: number[]) =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

  return {
    gamesPlayed: entries.length,
    averageScore: Math.round(average(scores)),
    bestScore: scores.length === 0 ? 0 : Math.max(...scores),
    averagePercent: average(percents),
    streaks: computeStreaks(Object.keys(history), today),
    bonusRounds: entries.reduce(
      (sum, entry) => sum + entry.roundResults.filter((round) => (round.bonus ?? 0) > 0).length,
      0,
    ),
    hintsUsed: entries.reduce(
      (sum, entry) =>
        sum +
        entry.roundResults.reduce(
          (roundSum, round) => roundSum + Object.values(round.hintsUsedByPlayer).reduce((a, b) => a + b, 0),
          0,
        ),
      0,
    ),
  }
}

/** Score tier (0-4) used for heatmap colors and share squares. */
export function scoreTier(fraction: number): 0 | 1 | 2 | 3 | 4 {
  if (fraction >= 0.9) return 4
  if (fraction >= 0.8) return 3
  if (fraction >= 0.65) return 2
  if (fraction >= 0.4) return 1
  return 0
}
