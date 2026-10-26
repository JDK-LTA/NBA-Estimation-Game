import { useState } from 'react'
import { SCOPE_LABELS, STAT_CATEGORIES } from '../logic/categories.ts'
import { formatLongDate, formatShortDate, shiftDate, weekdayOf } from '../logic/dates.ts'
import { scoreTier, summarizeHistory, totalScoreOf, type HistoryMap } from '../logic/history.ts'
import { summarizeInfinite, type InfiniteBreakdownRow } from '../logic/infiniteStats.ts'
import type { InfiniteRoundResult } from '../types/index.ts'
import styles from './StatsView.module.css'

const HEATMAP_WEEKS = 12
const RECENT_BARS = 14

type Section = 'daily' | 'archive' | 'infinite'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'archive', label: 'Archive' },
  { key: 'infinite', label: 'Infinite' },
]

interface StatsViewProps {
  /** Official daily results: the only source of streaks. */
  history: HistoryMap
  /** Saved archive replays. */
  practice: HistoryMap
  infiniteResults: InfiniteRoundResult[]
  today: string
  onNavigate: (target: Section) => void
}

interface Tile {
  label: string
  value: string | number
}

function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <ul className={styles.tiles}>
      {tiles.map((tile) => (
        <li key={tile.label} className={styles.tile}>
          <span className={styles.value}>{tile.value}</span>
          <span className={styles.label}>{tile.label}</span>
        </li>
      ))}
    </ul>
  )
}

interface Bar {
  key: string
  fraction: number
  label: string
  title: string
}

function RecentBars({ title, bars }: { title: string; bars: Bar[] }) {
  return (
    <section className={styles.card} aria-label={title}>
      <h2 className={styles.heading}>{title}</h2>
      <ol className={styles.bars}>
        {bars.map((bar) => (
          <li key={bar.key} className={styles.barItem} title={bar.title}>
            <span className={styles.barValue}>{Math.round(bar.fraction * 100)}</span>
            <span
              className={`${styles.bar} ${styles[`tier${scoreTier(bar.fraction)}`]}`}
              style={{ height: Math.max(6, Math.round(bar.fraction * 110)) }}
            />
            <span className={styles.barLabel}>{bar.label}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Breakdown<K extends string>({
  title,
  rows,
  labelOf,
}: {
  title: string
  rows: InfiniteBreakdownRow<K>[]
  labelOf: (key: K) => string
}) {
  return (
    <section className={styles.card} aria-label={title}>
      <h2 className={styles.heading}>{title}</h2>
      <ul className={styles.breakdown}>
        {rows.map((row) => (
          <li key={row.key} className={styles.breakdownRow}>
            <span className={styles.breakdownLabel}>{labelOf(row.key)}</span>
            <span className={styles.meter} aria-hidden="true">
              <span
                className={`${styles.meterFill} ${styles[`tier${scoreTier(row.averagePercent)}`]}`}
                style={{ width: `${Math.round(row.averagePercent * 100)}%` }}
              />
            </span>
            <span className={styles.breakdownValue}>
              {Math.round(row.averagePercent * 100)}%<small>{row.rounds} {row.rounds === 1 ? 'round' : 'rounds'}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return (
    <div className={styles.empty}>
      <h2>{title}</h2>
      <p>{text}</p>
      <button type="button" className="btn btn-primary" onClick={onAction}>
        {action}
      </button>
    </div>
  )
}

function dayBars(history: HistoryMap): Bar[] {
  return Object.values(history)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
    .slice(-RECENT_BARS)
    .map((entry) => ({
      key: entry.date,
      fraction: entry.maxScore > 0 ? entry.dailyScore / entry.maxScore : 0,
      label: formatShortDate(entry.date),
      title: `${formatLongDate(entry.date)}: ${totalScoreOf(entry)} / ${entry.maxScore}`,
    }))
}

function DailyStats({ history, today, onNavigate }: Pick<StatsViewProps, 'history' | 'today' | 'onNavigate'>) {
  const summary = summarizeHistory(history, today)
  if (summary.gamesPlayed === 0) {
    return (
      <EmptyState
        title="No games yet"
        text="Finish today's three rounds and your streak, averages and history will show up here."
        action="Play today's puzzle"
        onAction={() => onNavigate('daily')}
      />
    )
  }

  // Heatmap runs Sunday-first, ending with the week that contains today.
  const lastWeekStart = shiftDate(today, -weekdayOf(today))
  const firstDay = shiftDate(lastWeekStart, -(HEATMAP_WEEKS - 1) * 7)
  const cells = Array.from({ length: HEATMAP_WEEKS * 7 }, (_, i) => shiftDate(firstDay, i))

  return (
    <>
      <Tiles
        tiles={[
          { label: 'Days played', value: summary.gamesPlayed },
          { label: 'Current streak', value: summary.streaks.current },
          { label: 'Longest streak', value: summary.streaks.longest },
          { label: 'Average', value: `${Math.round(summary.averagePercent * 100)}%` },
          { label: 'Best day', value: summary.bestScore.toLocaleString('en-US') },
          { label: 'Hints used', value: summary.hintsUsed },
        ]}
      />
      <RecentBars title="Recent scores" bars={dayBars(history)} />

      <section className={styles.card} aria-label="Play calendar">
        <h2 className={styles.heading}>Last {HEATMAP_WEEKS} weeks</h2>
        <div className={styles.heatmap}>
          {cells.map((date) => {
            const entry = history[date]
            const tier = entry ? scoreTier(entry.maxScore > 0 ? entry.dailyScore / entry.maxScore : 0) : null
            return (
              <span
                key={date}
                className={`${styles.cell} ${date > today ? styles.future : ''} ${tier !== null ? styles[`tier${tier}`] : ''}`}
                title={entry ? `${formatLongDate(date)}: ${totalScoreOf(entry)} / ${entry.maxScore}` : formatLongDate(date)}
              />
            )
          })}
        </div>
      </section>
    </>
  )
}

function ArchiveStats({ practice, today, onNavigate }: Pick<StatsViewProps, 'practice' | 'today' | 'onNavigate'>) {
  const summary = summarizeHistory(practice, today)
  if (summary.gamesPlayed === 0) {
    return (
      <EmptyState
        title="No archive replays yet"
        text="Replay any past day from the archive. Results are saved here but never count toward your streak."
        action="Browse the archive"
        onAction={() => onNavigate('archive')}
      />
    )
  }

  return (
    <>
      <Tiles
        tiles={[
          { label: 'Days replayed', value: summary.gamesPlayed },
          { label: 'Average', value: `${Math.round(summary.averagePercent * 100)}%` },
          { label: 'Best day', value: summary.bestScore.toLocaleString('en-US') },
          { label: 'Order bonuses', value: summary.bonusRounds },
          { label: 'Hints used', value: summary.hintsUsed },
          { label: 'Average score', value: summary.averageScore.toLocaleString('en-US') },
        ]}
      />
      <RecentBars title="Recent replays" bars={dayBars(practice)} />
    </>
  )
}

function InfiniteStats({ results, onNavigate }: { results: InfiniteRoundResult[]; onNavigate: StatsViewProps['onNavigate'] }) {
  const summary = summarizeInfinite(results)
  if (summary.rounds === 0) {
    return (
      <EmptyState
        title="No Infinite rounds yet"
        text="Finish a round in Infinite Mode and your accuracy by stat and scope will show up here."
        action="Play Infinite Mode"
        onAction={() => onNavigate('infinite')}
      />
    )
  }

  const bars: Bar[] = results.slice(-RECENT_BARS).map((result) => {
    const fraction = result.maxScore > 0 ? result.score / result.maxScore : 0
    const unit = STAT_CATEGORIES[result.categoryKey]?.unit ?? result.categoryKey
    return {
      key: result.id,
      fraction,
      label: unit,
      title: `${unit} (${SCOPE_LABELS[result.scope]}): ${result.score} / ${result.maxScore}${result.bonus > 0 ? ` + ${result.bonus} order bonus` : ''}`,
    }
  })

  return (
    <>
      <Tiles
        tiles={[
          { label: 'Rounds played', value: summary.rounds },
          { label: 'Average', value: `${Math.round(summary.averagePercent * 100)}%` },
          { label: 'Best round', value: `${Math.round(summary.bestPercent * 100)}%` },
          { label: 'Order bonuses', value: summary.bonusRounds },
          { label: 'Hints used', value: summary.hintsUsed },
          { label: 'Bonus rate', value: `${Math.round((summary.bonusRounds / summary.rounds) * 100)}%` },
        ]}
      />
      <RecentBars title="Recent rounds" bars={bars} />
      <Breakdown
        title="By stat"
        rows={summary.byCategory.filter((row) => row.key in STAT_CATEGORIES)}
        labelOf={(key) => STAT_CATEGORIES[key].label}
      />
      <Breakdown title="By scope" rows={summary.byScope} labelOf={(key) => SCOPE_LABELS[key]} />
    </>
  )
}

export function StatsView({ history, practice, infiniteResults, today, onNavigate }: StatsViewProps) {
  const [section, setSection] = useState<Section>('daily')

  return (
    <div className={styles.stats}>
      <div className={styles.tabs} role="tablist" aria-label="Stats section">
        {SECTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`stats-tab-${key}`}
            aria-selected={section === key}
            aria-controls="stats-panel"
            className={`${styles.tab} ${section === key ? styles.tabActive : ''}`}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div id="stats-panel" role="tabpanel" aria-labelledby={`stats-tab-${section}`} className={styles.panel}>
        {section === 'daily' && <DailyStats history={history} today={today} onNavigate={onNavigate} />}
        {section === 'archive' && <ArchiveStats practice={practice} today={today} onNavigate={onNavigate} />}
        {section === 'infinite' && <InfiniteStats results={infiniteResults} onNavigate={onNavigate} />}
      </div>
    </div>
  )
}
