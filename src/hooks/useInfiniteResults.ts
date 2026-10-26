import { useCallback, useEffect, useState } from 'react'
import { MAX_INFINITE_RESULTS, readInfiniteResults, writeInfiniteResults } from '../data/storage.ts'
import type { InfiniteRoundResult } from '../types/index.ts'

export interface InfiniteResults {
  results: InfiniteRoundResult[]
  /** Saves a finished Infinite Mode round; the same round id is only stored once. */
  recordResult: (result: InfiniteRoundResult) => void
}

export function useInfiniteResults(): InfiniteResults {
  const [results, setResults] = useState<InfiniteRoundResult[]>(readInfiniteResults)

  useEffect(() => {
    writeInfiniteResults(results)
  }, [results])

  const recordResult = useCallback((result: InfiniteRoundResult) => {
    setResults((previous) =>
      previous.some((existing) => existing.id === result.id)
        ? previous
        : [...previous, result].slice(-MAX_INFINITE_RESULTS),
    )
  }, [])

  return { results, recordResult }
}
