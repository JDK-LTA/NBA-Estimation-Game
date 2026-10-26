import type { HistoryMap } from '../logic/history.ts'
import { DEFAULT_INFINITE_CONFIG, sanitizeInfiniteConfig } from '../logic/infiniteMode.ts'
import type { InfiniteModeConfig, InfiniteRoundResult, UserDailyHistoryEntry } from '../types/index.ts'

// localStorage wrappers that never throw (private mode, quota, corrupted JSON).

const PREFIX = 'range.v1.'

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage unavailable or full: the game still works, it just won't persist.
  }
}

export function clearStored(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

export function isHistoryEntry(value: unknown): value is UserDailyHistoryEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<UserDailyHistoryEntry>
  return (
    typeof entry.date === 'string' &&
    typeof entry.dailyScore === 'number' &&
    typeof entry.maxScore === 'number' &&
    Array.isArray(entry.roundResults)
  )
}

export function readHistory(): HistoryMap {
  const raw = readStored<Record<string, unknown>>('history', {})
  const history: HistoryMap = {}
  for (const [date, entry] of Object.entries(raw)) {
    if (isHistoryEntry(entry)) history[date] = entry
  }
  return history
}

export const writeHistory = (history: HistoryMap) => writeStored('history', history)

export const progressKey = (date: string) => `progress.${date}`

export const practiceProgressKey = (date: string) => `practice.${date}`

export const readProgress = (key: string): unknown => readStored<unknown>(key, null)

export const writeProgress = (key: string, state: object) => writeStored(key, state)

/** Practice results are kept apart from `history`, which drives streaks and stats. */
export function readPracticeHistory(): HistoryMap {
  const raw = readStored<Record<string, unknown>>('practice-history', {})
  const history: HistoryMap = {}
  for (const [date, entry] of Object.entries(raw)) {
    if (isHistoryEntry(entry)) history[date] = entry
  }
  return history
}

export const writePracticeHistory = (history: HistoryMap) => writeStored('practice-history', history)

/** Newest results kept; older ones are dropped to stay well inside localStorage limits. */
export const MAX_INFINITE_RESULTS = 500

function isInfiniteResult(value: unknown): value is InfiniteRoundResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Partial<InfiniteRoundResult>
  return (
    typeof result.id === 'string' &&
    typeof result.completedAt === 'string' &&
    typeof result.categoryKey === 'string' &&
    typeof result.scope === 'string' &&
    typeof result.score === 'number' &&
    typeof result.bonus === 'number' &&
    typeof result.maxScore === 'number' &&
    typeof result.hintsUsed === 'number' &&
    typeof result.middlePlayerCount === 'number'
  )
}

export function readInfiniteResults(): InfiniteRoundResult[] {
  const raw = readStored<unknown>('infinite-results', [])
  return Array.isArray(raw) ? raw.filter(isInfiniteResult) : []
}

export const writeInfiniteResults = (results: InfiniteRoundResult[]) =>
  writeStored('infinite-results', results.slice(-MAX_INFINITE_RESULTS))

export function readInfiniteConfig(): InfiniteModeConfig {
  const stored = readStored<InfiniteModeConfig | null>('infinite-config', null)
  return stored ? sanitizeInfiniteConfig({ ...DEFAULT_INFINITE_CONFIG, ...stored }) : DEFAULT_INFINITE_CONFIG
}

export const writeInfiniteConfig = (config: InfiniteModeConfig) => writeStored('infinite-config', config)

export const hasSeenHowToPlay = (): boolean => readStored<boolean>('seen-how-to-play', false)

export const markHowToPlaySeen = () => writeStored('seen-how-to-play', true)
