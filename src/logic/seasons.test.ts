import { describe, expect, it } from 'vitest'
import { makeDataset } from '../test/fixtures.ts'
import { DEFAULT_DIFFICULTY, getEligiblePool } from './eligibility.ts'
import { generateRound } from './puzzleGenerator.ts'
import { createRng } from './rng.ts'
import {
  FULL_SEASON_RANGE,
  inSeasonRange,
  inferLatestSeasonYear,
  isFullSeasonRange,
  recencyWeight,
  seasonLabel,
  seasonStartYear,
} from './seasons.ts'
import type { Player, PlayerStatValue } from '../types/index.ts'

const row = (season: string | null, scope: PlayerStatValue['scope'] = 'season'): PlayerStatValue => ({
  playerId: 'p',
  categoryKey: 'ppg',
  scope,
  season,
  value: 20,
  leaderboardRank: 1,
})
const player = (firstYear: number | null, lastYear: number | null): Player => ({
  id: 'p',
  fullName: 'P',
  photoUrl: null,
  photoAttribution: null,
  position: null,
  teams: [],
  firstYear,
  lastYear,
})

describe('season helpers', () => {
  it('converts between season labels and start years', () => {
    expect(seasonStartYear('2025-26')).toBe(2025)
    expect(seasonStartYear('1999-00')).toBe(1999)
    expect(seasonLabel(2025)).toBe('2025-26')
    expect(seasonLabel(1999)).toBe('1999-00')
  })

  it('treats a range covering the data (or none) as unfiltered', () => {
    expect(isFullSeasonRange(undefined)).toBe(true)
    expect(isFullSeasonRange(FULL_SEASON_RANGE)).toBe(true)
    expect(isFullSeasonRange({ from: 2005, to: 2025 })).toBe(false)
  })

  it('filters season rows by start year, inclusive', () => {
    const range = { from: 2010, to: 2015 }
    expect(inSeasonRange(row('2010-11'), undefined, range)).toBe(true)
    expect(inSeasonRange(row('2015-16'), undefined, range)).toBe(true)
    expect(inSeasonRange(row('2009-10', 'playoffs'), undefined, range)).toBe(false)
    expect(inSeasonRange(row('2016-17'), undefined, range)).toBe(false)
  })

  it('keeps career players whose careers overlap the range, and those with unknown years', () => {
    const range = { from: 2010, to: 2015 }
    expect(inSeasonRange(row(null, 'career'), player(2003, 2011), range)).toBe(true)
    expect(inSeasonRange(row(null, 'career'), player(2015, 2024), range)).toBe(true)
    expect(inSeasonRange(row(null, 'career'), player(1996, 2009), range)).toBe(false)
    expect(inSeasonRange(row(null, 'career'), player(2016, 2024), range)).toBe(false)
    expect(inSeasonRange(row(null, 'career'), player(null, null), range)).toBe(true)
  })

  it('infers the latest season in a dataset', () => {
    const dataset = makeDataset({ playerCount: 6, seasons: ['2018-19', '2022-23', '2020-21'] })
    expect(inferLatestSeasonYear(dataset)).toBe(2022)
  })

  it('weights the last N seasons (and recently active careers) higher', () => {
    const weight = recencyWeight(2025, 20, 2)
    expect(weight(row('2025-26'), undefined)).toBe(2)
    expect(weight(row('2006-07'), undefined)).toBe(2)
    expect(weight(row('2005-06'), undefined)).toBe(1)
    expect(weight(row(null, 'career'), player(1990, 2010))).toBe(2)
    expect(weight(row(null, 'career'), player(1990, 2003))).toBe(1)
    expect(weight(row(null, 'career'), undefined)).toBe(1)
  })
})

describe('season range in the eligible pool and generator', () => {
  const seasons = Array.from({ length: 25 }, (_, i) => `${2000 + i}-${String(i + 1).padStart(2, '0')}`)
  const dataset = makeDataset({ playerCount: 250, step: 0.1, startValue: 1, seasons })
  const eligibility = { seasonEligibilityCutoff: 250, careerEligibilityCutoff: 250 }

  it('restricts season rows to the chosen seasons', () => {
    const pool = getEligiblePool(dataset, 'ppg', 'season', { ...eligibility, seasonRange: { from: 2015, to: 2019 } })
    expect(pool.length).toBeGreaterThan(0)
    expect(pool.every((r) => seasonStartYear(r.season!) >= 2015 && seasonStartYear(r.season!) <= 2019)).toBe(true)
  })

  it('does not filter anything for the full range', () => {
    const all = getEligiblePool(dataset, 'ppg', 'career', eligibility)
    const full = getEligiblePool(dataset, 'ppg', 'career', { ...eligibility, seasonRange: FULL_SEASON_RANGE })
    expect(full).toHaveLength(all.length)
  })

  it('generates rounds only from players in the range', () => {
    for (let i = 0; i < 20; i++) {
      const result = generateRound(
        dataset,
        {
          categoryKey: 'ppg',
          scope: 'playoffs',
          middlePlayerCount: 5,
          eligibility: { ...DEFAULT_DIFFICULTY, ...eligibility, seasonRange: { from: 2008, to: 2020 } },
        },
        createRng(`range-${i}`),
      )
      if (!result.ok) throw new Error(result.reason)
      for (const selection of result.round.players) {
        const year = seasonStartYear(selection.season!)
        expect(year).toBeGreaterThanOrEqual(2008)
        expect(year).toBeLessThanOrEqual(2020)
      }
    }
  })

  it('favours heavier-weighted rows without excluding the others', () => {
    const weightOf = recencyWeight(2024, 5, 12)
    let recent = 0
    let older = 0
    for (let i = 0; i < 150; i++) {
      const result = generateRound(
        dataset,
        { categoryKey: 'ppg', scope: 'season', middlePlayerCount: 5, eligibility, weightOf },
        createRng(`weighted-${i}`),
      )
      if (!result.ok) throw new Error(result.reason)
      for (const selection of result.round.players) {
        if (seasonStartYear(selection.season!) >= 2020) recent++
        else older++
      }
    }
    const share = recent / (recent + older)
    // 5 of 25 seasons are "recent"; uniform would give 20%.
    expect(share).toBeGreaterThan(0.4)
    expect(older).toBeGreaterThan(0)
  })
})
