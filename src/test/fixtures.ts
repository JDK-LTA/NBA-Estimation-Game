import { CATEGORY_KEYS, SCOPES, type CategoryKey, type Dataset, type Player, type PlayerStatValue } from '../types/index.ts'

interface FixtureOptions {
  playerCount?: number
  /** Value of the first (lowest) player; players climb by `step` each. */
  startValue?: number
  step?: number
  categoryKeys?: readonly CategoryKey[]
  /** Seasons assigned to players in rotation (player i gets seasons[i % length]). */
  seasons?: readonly string[]
}

/**
 * Deterministic synthetic dataset: every player has a stat row in every scope
 * and category, values climbing evenly, rank 1 = highest value.
 */
export function makeDataset({
  playerCount = 90,
  startValue = 2,
  step = 0.2,
  categoryKeys = CATEGORY_KEYS,
  seasons = ['2023-24'],
}: FixtureOptions = {}): Dataset {
  const players: Record<string, Player> = {}
  for (let i = 0; i < playerCount; i++) {
    const firstYear = 2000 + (i % 20)
    players[String(i)] = {
      id: String(i),
      fullName: `Player ${i}`,
      photoUrl: null,
      photoAttribution: null,
      position: 'G',
      teams: i % 2 === 0 ? ['LAL'] : ['BOS'],
      firstYear,
      lastYear: firstYear + 5 + (i % 5),
    }
  }

  const stats: Dataset['stats'] = {}
  for (const categoryKey of categoryKeys) {
    const rows: PlayerStatValue[] = []
    for (const scope of SCOPES) {
      for (let i = 0; i < playerCount; i++) {
        rows.push({
          playerId: String(i),
          categoryKey,
          scope,
          season: scope === 'career' ? null : seasons[i % seasons.length],
          value: Math.round((startValue + i * step) * 10) / 10,
          leaderboardRank: playerCount - i,
        })
      }
    }
    stats[categoryKey] = rows
  }
  return { players, stats }
}
