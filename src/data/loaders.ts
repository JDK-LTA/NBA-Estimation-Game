import { validateDailyPuzzle } from '../logic/puzzleValidation.ts'
import {
  type CategoryKey,
  type DailyPuzzle,
  type Dataset,
  type Player,
  type PlayerStatValue,
  type PuzzleArchiveIndexEntry,
} from '../types/index.ts'

export class DataNotFoundError extends Error {
  constructor(path: string) {
    super(`Data file not found: ${path}`)
    this.name = 'DataNotFoundError'
  }
}

export interface DataMeta {
  generatedAt: string
  firstSeason: string
  lastSeason: string
  playerCount: number
}

/** Resolves a path in /public (data files, player photos) against the app's base URL. */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
}

// One in-flight/finished request per file; failures are evicted so a retry can succeed.
const cache = new Map<string, Promise<unknown>>()

function fetchJson<T>(path: string): Promise<T> {
  const existing = cache.get(path)
  if (existing) return existing as Promise<T>

  const request = (async () => {
    const response = await fetch(assetUrl(path))
    const type = response.headers.get('content-type') ?? ''
    // Dev servers answer unknown paths with index.html, so check the type too.
    if (response.status === 404 || (response.ok && !type.includes('json'))) throw new DataNotFoundError(path)
    if (!response.ok) throw new Error(`Failed to load ${path} (${response.status})`)
    return (await response.json()) as T
  })()

  cache.set(path, request)
  request.catch(() => cache.delete(path))
  return request
}

export async function loadPlayers(): Promise<Record<string, Player>> {
  const list = await fetchJson<Player[]>('data/players.json')
  return Object.fromEntries(list.map((player) => [player.id, player]))
}

export function loadMeta(): Promise<DataMeta> {
  return fetchJson<DataMeta>('data/meta.json')
}

export function loadStatChunk(categoryKey: CategoryKey): Promise<PlayerStatValue[]> {
  return fetchJson<PlayerStatValue[]>(`data/stats/${categoryKey}.json`)
}

/** Lazily loads only the stat chunks Infinite Mode needs (TDD.md 4.3). */
export async function loadDataset(categoryKeys: readonly CategoryKey[]): Promise<Dataset> {
  const [players, ...chunks] = await Promise.all([loadPlayers(), ...categoryKeys.map(loadStatChunk)])
  const stats: Dataset['stats'] = {}
  categoryKeys.forEach((key, index) => {
    stats[key] = chunks[index] as PlayerStatValue[]
  })
  return { players, stats }
}

export function loadArchiveIndex(): Promise<PuzzleArchiveIndexEntry[]> {
  return fetchJson<PuzzleArchiveIndexEntry[]>('data/puzzles/index.json')
}

/** Returns null when no puzzle exists for that date (before/after the generated range). */
export async function loadPuzzle(date: string): Promise<DailyPuzzle | null> {
  let yearFile: unknown[]
  try {
    yearFile = await fetchJson<unknown[]>(`data/puzzles/${date.slice(0, 4)}.json`)
  } catch (error) {
    if (error instanceof DataNotFoundError) return null
    throw error
  }
  const raw = yearFile.find((puzzle) => (puzzle as { date?: string }).date === date)
  return raw ? validateDailyPuzzle(raw) : null
}
