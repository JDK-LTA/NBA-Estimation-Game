import type { DailyPuzzle, Player, PuzzleRound } from '../types/index.ts'

/** Three middle players at 25%, 50% and 80% of a 10.0-wide PPG window starting at 20. */
export function makeRound(categoryKey: PuzzleRound['categoryKey'] = 'ppg'): PuzzleRound {
  return {
    categoryKey,
    scope: 'season',
    rangeSize: 10,
    lowAnchorValue: 20,
    middlePlayerCount: 3,
    players: [
      { playerId: 'low', season: '2020-21', value: 20, isAnchor: true, anchorPosition: 'low' },
      { playerId: 'high', season: '2021-22', value: 30, isAnchor: true, anchorPosition: 'high' },
      { playerId: 'a', season: '2019-20', value: 22.5, isAnchor: false, anchorPosition: null },
      { playerId: 'b', season: '2018-19', value: 25, isAnchor: false, anchorPosition: null },
      { playerId: 'c', season: '2017-18', value: 28, isAnchor: false, anchorPosition: null },
    ],
  }
}

export const fixturePlayers: Record<string, Player> = Object.fromEntries(
  [
    ['low', 'Lowe Anchor'],
    ['high', 'Hy Anchor'],
    ['a', 'Alpha Player'],
    ['b', 'Bravo Player'],
    ['c', 'Charlie Player'],
  ].map(([id, fullName]) => [
    id,
    { id, fullName, photoUrl: null, photoAttribution: null, position: 'G', teams: [] } satisfies Player,
  ]),
)

export function makePuzzle(date = '2026-10-23'): DailyPuzzle {
  return {
    date,
    seed: 'test',
    rounds: [makeRound('ppg'), makeRound('apg'), makeRound('rpg')],
  }
}
