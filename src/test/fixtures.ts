import { CATEGORY_KEYS, SCOPES, type CategoryKey, type Dataset, type Player, type PlayerStatValue } from '../types/index.ts'

interface FixtureOptions {
  playerCount?: number
  /** Value of the first (lowest) player; players climb by `step` each. */
  startValue?: number
  step?: number
  categoryKeys?: readonly CategoryKey[]
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
}: FixtureOptions = {}): Dataset {
  const players: Record<string, Player> = {}
  for (let i = 0; i < playerCount; i++) {
    players[String(i)] = {
      id: String(i),
      fullName: `Player ${i}`,
      photoUrl: null,
      photoAttribution: null,
      position: 'G',
      teams: i % 2 === 0 ? ['LAL'] : ['BOS'],
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
          season: scope === 'career' ? null : '2023-24',
          value: Math.round((startValue + i * step) * 10) / 10,
          leaderboardRank: playerCount - i,
        })
      }
    }
    stats[categoryKey] = rows
  }
  return { players, stats }
}
