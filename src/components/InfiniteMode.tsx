import { useEffect, useState } from 'react'
import { loadDataset } from '../data/loaders.ts'
import { readInfiniteConfig, writeInfiniteConfig } from '../data/storage.ts'
import { SCOPE_LABELS, STAT_CATEGORIES } from '../logic/categories.ts'
import {
  DEFAULT_INFINITE_CONFIG,
  INFINITE_LIMITS,
  generateInfiniteRound,
  sanitizeInfiniteConfig,
} from '../logic/infiniteMode.ts'
import { createRng, randomSeed } from '../logic/rng.ts'
import { scoreRound, totalHintsUsed } from '../logic/roundScoring.ts'
import { FIRST_SEASON_YEAR, LAST_SEASON_YEAR, seasonLabel } from '../logic/seasons.ts'
import { useGame } from '../hooks/useGame.ts'
import {
  CATEGORY_KEYS,
  SCOPES,
  type CategoryKey,
  type InfiniteModeConfig,
  type InfiniteRoundResult,
  type Player,
  type PuzzleRound,
} from '../types/index.ts'
import { RoundBoard } from './RoundBoard.tsx'
import { StatusMessage } from './StatusMessage.tsx'
import { Stepper } from './Stepper.tsx'
import styles from './InfiniteMode.module.css'

const SEASON_YEARS = Array.from({ length: LAST_SEASON_YEAR - FIRST_SEASON_YEAR + 1 }, (_, i) => FIRST_SEASON_YEAR + i)

const SEASON_PRESETS = [
  { label: 'All seasons', from: FIRST_SEASON_YEAR },
  { label: 'Last 20', from: LAST_SEASON_YEAR - 19 },
  { label: 'Last 10', from: LAST_SEASON_YEAR - 9 },
]

interface Session {
  id: number
  /** Globally unique, used to record each finished round exactly once. */
  uid: string
  rounds: PuzzleRound[]
  hintsPerRound: number
}

interface InfiniteRoundProps {
  session: Session
  players: Record<string, Player>
  onReroll: () => void
  onComplete: (result: InfiniteRoundResult) => void
  busy: boolean
}

function InfiniteRound({ session, players, onReroll, onComplete, busy }: InfiniteRoundProps) {
  const { state, place, hint, submit } = useGame(session.rounds, session.hintsPerRound, null)
  const submitted = state.rounds[0].submitted

  useEffect(() => {
    if (!submitted) return
    const round = session.rounds[0]
    const scored = scoreRound(round, state.rounds[0])
    onComplete({
      id: session.uid,
      completedAt: new Date().toISOString(),
      categoryKey: round.categoryKey,
      scope: round.scope,
      middlePlayerCount: round.middlePlayerCount,
      score: scored.total,
      bonus: scored.bonus,
      maxScore: scored.max,
      hintsUsed: totalHintsUsed(state.rounds[0].hints),
    })
  }, [submitted, session, state, onComplete])

  return (
    <RoundBoard
      round={session.rounds[0]}
      players={players}
      state={state.rounds[0]}
      hintsPerRound={session.hintsPerRound}
      onPlace={(playerId, position) => place(0, playerId, position)}
      onHint={(playerId) => hint(0, playerId)}
      onSubmit={() => submit(0)}
      afterSubmit={
        <div className={styles.afterRow}>
          <button type="button" className="btn btn-primary" onClick={onReroll} disabled={busy}>
            Reroll
          </button>
        </div>
      }
    />
  )
}

interface InfiniteModeProps {
  players: Record<string, Player>
  onRoundComplete: (result: InfiniteRoundResult) => void
}

export function InfiniteMode({ players, onRoundComplete }: InfiniteModeProps) {
  const [config, setConfig] = useState<InfiniteModeConfig>(readInfiniteConfig)
  const [session, setSession] = useState<Session | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [counter, setCounter] = useState(0)

  useEffect(() => {
    writeInfiniteConfig(config)
  }, [config])

  const update = (patch: Partial<InfiniteModeConfig>) => setConfig((previous) => ({ ...previous, ...patch }))
  const setSeasonFrom = (year: number) =>
    setConfig((previous) => ({ ...previous, seasonFrom: year, seasonTo: Math.max(year, previous.seasonTo) }))
  const setSeasonTo = (year: number) =>
    setConfig((previous) => ({ ...previous, seasonTo: year, seasonFrom: Math.min(year, previous.seasonFrom) }))

  const toggleCategory = (key: CategoryKey) => {
    const selected = config.categoryKeyPool.includes(key)
    if (selected && config.categoryKeyPool.length === 1) return
    update({
      categoryKeyPool: selected ? config.categoryKeyPool.filter((k) => k !== key) : [...config.categoryKeyPool, key],
    })
  }

  const setRangeOverride = (key: CategoryKey, value: number | null) => {
    const next = { ...(config.rangeSizeOverrides ?? {}) }
    if (value === null) delete next[key]
    else next[key] = value
    update({ rangeSizeOverrides: Object.keys(next).length > 0 ? next : null })
  }

  const generate = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const safe = sanitizeInfiniteConfig(config)
      const dataset = await loadDataset(safe.categoryKeyPool)
      const result = generateInfiniteRound(dataset, safe, createRng(randomSeed()))
      if (result.ok) {
        setCounter((previous) => previous + 1)
        setSession({
          id: counter + 1,
          uid: randomSeed(),
          rounds: [result.round],
          hintsPerRound: safe.hintsPerRound,
        })
      } else {
        setError(result.reason)
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong while loading stats.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.infinite}>
      <details className={styles.settings} open={!session}>
        <summary className={styles.summary}>Round settings</summary>

        <div className={styles.grid}>
          <fieldset className={styles.field}>
            <legend>Stats in the pool</legend>
            <div className={styles.chips}>
              {CATEGORY_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.chip} ${config.categoryKeyPool.includes(key) ? styles.chipOn : ''}`}
                  aria-pressed={config.categoryKeyPool.includes(key)}
                  onClick={() => toggleCategory(key)}
                >
                  {STAT_CATEGORIES[key].unit}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.field}>
            <legend>Scope</legend>
            <div className={styles.chips}>
              {SCOPES.map((scope) => (
                <label key={scope} className={`${styles.chip} ${config.scope === scope ? styles.chipOn : ''}`}>
                  <input
                    type="radio"
                    name="scope"
                    className="visually-hidden"
                    checked={config.scope === scope}
                    onChange={() => update({ scope })}
                  />
                  {SCOPE_LABELS[scope]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.field}>
            <span className={styles.label}>Players to place</span>
            <Stepper
              label="players to place"
              value={config.middlePlayerCount}
              min={INFINITE_LIMITS.middlePlayerCount.min}
              max={INFINITE_LIMITS.middlePlayerCount.max}
              onChange={(middlePlayerCount) => update({ middlePlayerCount })}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Hints per round</span>
            <Stepper
              label="hints per round"
              value={config.hintsPerRound}
              min={INFINITE_LIMITS.hintsPerRound.min}
              max={INFINITE_LIMITS.hintsPerRound.max}
              onChange={(hintsPerRound) => update({ hintsPerRound })}
            />
          </div>

          {config.scope === 'career' ? (
            <label className={`${styles.field} ${styles.wide}`}>
              <span className={styles.label}>
                Career pool: top <strong>{config.careerEligibilityCutoff}</strong> all-time
              </span>
              <input
                type="range"
                min={INFINITE_LIMITS.careerEligibilityCutoff.min}
                max={INFINITE_LIMITS.careerEligibilityCutoff.max}
                step={25}
                value={config.careerEligibilityCutoff}
                onChange={(event) => update({ careerEligibilityCutoff: Number(event.target.value) })}
              />
              <span className={styles.helper}>Lower means more famous names (easier). Higher pulls in deep cuts (harder).</span>
            </label>
          ) : (
            <label className={`${styles.field} ${styles.wide}`}>
              <span className={styles.label}>
                Season pool: top <strong>{config.seasonEligibilityCutoff}</strong> per season
              </span>
              <input
                type="range"
                min={INFINITE_LIMITS.seasonEligibilityCutoff.min}
                max={INFINITE_LIMITS.seasonEligibilityCutoff.max}
                step={5}
                value={config.seasonEligibilityCutoff}
                onChange={(event) => update({ seasonEligibilityCutoff: Number(event.target.value) })}
              />
              <span className={styles.helper}>Lower means more famous names (easier). Higher pulls in deep cuts (harder).</span>
            </label>
          )}

          <fieldset className={`${styles.field} ${styles.wide}`}>
            <legend>Seasons in the pool</legend>
            <div className={styles.seasonRow}>
              <label className={styles.seasonSelect}>
                <span>From</span>
                <select value={config.seasonFrom} onChange={(event) => setSeasonFrom(Number(event.target.value))}>
                  {SEASON_YEARS.map((year) => (
                    <option key={year} value={year}>
                      {seasonLabel(year)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.seasonSelect}>
                <span>To</span>
                <select value={config.seasonTo} onChange={(event) => setSeasonTo(Number(event.target.value))}>
                  {SEASON_YEARS.map((year) => (
                    <option key={year} value={year}>
                      {seasonLabel(year)}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.chips}>
                {SEASON_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`${styles.chip} ${config.seasonFrom === preset.from && config.seasonTo === LAST_SEASON_YEAR ? styles.chipOn : ''}`}
                    onClick={() => update({ seasonFrom: preset.from, seasonTo: LAST_SEASON_YEAR })}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <span className={styles.helper}>
              Single-season and playoff rounds only use seasons in this range. Career rounds keep players whose
              careers overlap it.
            </span>
          </fieldset>
        </div>

        <details className={styles.advanced}>
          <summary>Advanced: slider width per stat</summary>
          <div className={styles.rangeGrid}>
            {CATEGORY_KEYS.map((key) => {
              const base = STAT_CATEGORIES[key].rangeSize
              const override = config.rangeSizeOverrides?.[key]
              return (
                <div key={key} className={styles.rangeRow}>
                  <span className={styles.label}>{STAT_CATEGORIES[key].unit}</span>
                  <Stepper
                    label={`${STAT_CATEGORIES[key].unit} slider width`}
                    value={override ?? base}
                    min={Math.round(base * 25) / 100}
                    max={base * 3}
                    step={base >= 4 ? 0.5 : 0.1}
                    decimals={1}
                    display={override === undefined ? `${base.toFixed(1)} (default)` : override.toFixed(1)}
                    onChange={(value) => setRangeOverride(key, value)}
                  />
                  {override !== undefined && (
                    <button type="button" className={styles.reset} onClick={() => setRangeOverride(key, null)}>
                      Reset
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </details>

        <div className={styles.actions}>
          <button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>
            {busy ? 'Generating…' : session ? 'New puzzle with these settings' : 'Generate puzzle'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setConfig(DEFAULT_INFINITE_CONFIG)}>
            Reset settings
          </button>
        </div>
      </details>

      {error && (
        <StatusMessage kind="error" title="Couldn't build a puzzle">
          <p>{error}</p>
        </StatusMessage>
      )}

      {busy && !session && <StatusMessage kind="loading" title="Warming up the stats…" />}

      {session && (
        <InfiniteRound
          key={session.id}
          session={session}
          players={players}
          onReroll={generate}
          onComplete={onRoundComplete}
          busy={busy}
        />
      )}
    </div>
  )
}
