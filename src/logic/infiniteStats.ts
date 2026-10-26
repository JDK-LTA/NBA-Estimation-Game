import type { CategoryKey, InfiniteRoundResult, Scope } from '../types/index.ts'

export interface InfiniteBreakdownRow<K extends string> {
  key: K
  rounds: number
  averagePercent: number
}

export interface InfiniteSummary {
  rounds: number
  averagePercent: number
  bestPercent: number
  bonusRounds: number
  hintsUsed: number
  byCategory: InfiniteBreakdownRow<CategoryKey>[]
  byScope: InfiniteBreakdownRow<Scope>[]
}

const percentOf = (result: InfiniteRoundResult) => (result.maxScore > 0 ? result.score / result.maxScore : 0)
const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

function breakdown<K extends string>(
  results: InfiniteRoundResult[],
  keyOf: (result: InfiniteRoundResult) => K,
): InfiniteBreakdownRow<K>[] {
  const groups = new Map<K, number[]>()
  for (const result of results) {
    const key = keyOf(result)
    groups.set(key, [...(groups.get(key) ?? []), percentOf(result)])
  }
  return [...groups.entries()]
    .map(([key, percents]) => ({ key, rounds: percents.length, averagePercent: average(percents) }))
    .sort((a, b) => b.rounds - a.rounds || a.key.localeCompare(b.key))
}

/** Percentages use placement points only; the order bonus is counted separately. */
export function summarizeInfinite(results: readonly InfiniteRoundResult[]): InfiniteSummary {
  const list = [...results]
  const percents = list.map(percentOf)
  return {
    rounds: list.length,
    averagePercent: average(percents),
    bestPercent: percents.length === 0 ? 0 : Math.max(...percents),
    bonusRounds: list.filter((result) => result.bonus > 0).length,
    hintsUsed: list.reduce((sum, result) => sum + result.hintsUsed, 0),
    byCategory: breakdown(list, (result) => result.categoryKey),
    byScope: breakdown(list, (result) => result.scope),
  }
}
