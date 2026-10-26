import { useMemo, useState } from 'react'
import { STAT_CATEGORIES, SCOPE_LABELS } from '../logic/categories.ts'
import { daysInMonth, formatLongDate, formatMonth, makeDate, weekdayOf } from '../logic/dates.ts'
import { describeDay, scoreTier, totalScoreOf, type HistoryMap } from '../logic/history.ts'
import type { PuzzleArchiveIndexEntry, UserDailyHistoryEntry } from '../types/index.ts'
import styles from './ArchiveCalendar.module.css'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function tierOf(entry: UserDailyHistoryEntry): number {
  return scoreTier(entry.maxScore > 0 ? entry.dailyScore / entry.maxScore : 0)
}

/** One finished result (official or practice) with its short read on how it went. */
function ResultLine({ label, entry, muted }: { label: string; entry: UserDailyHistoryEntry; muted?: boolean }) {
  const day = describeDay(entry)
  return (
    <div className={`${styles.result} ${muted ? styles.resultMuted : ''}`}>
      <p className={styles.resultHead}>
        <span className={styles.resultLabel}>{label}</span>
        <strong>
          {totalScoreOf(entry).toLocaleString('en-US')}
          <small> / {entry.maxScore.toLocaleString('en-US')}</small>
        </strong>
        <span className={styles.resultVerdict}>{day.verdict}</span>
      </p>
      <ul className={styles.tidbits}>
        {day.tidbits.map((tidbit) => (
          <li key={tidbit} className={!muted && day.hintFree && tidbit === 'No hints' ? styles.gold : ''}>
            {tidbit}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface ArchiveCalendarProps {
  index: PuzzleArchiveIndexEntry[]
  history: HistoryMap
  /** Saved archive replays; marked on the calendar but separate from official results. */
  practice: HistoryMap
  today: string
  onPractice: (date: string) => void
  onPlayToday: () => void
}

function monthOf(date: string): { year: number; month: number } {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) - 1 }
}

export function ArchiveCalendar({ index, history, practice, today, onPractice, onPlayToday }: ArchiveCalendarProps) {
  const entries = useMemo(() => new Map(index.map((entry) => [entry.date, entry])), [index])
  const dates = useMemo(() => index.map((entry) => entry.date).sort(), [index])
  const first = monthOf(dates[0] ?? today)
  const last = monthOf(dates[dates.length - 1] ?? today)

  const startDate = entries.has(today) ? today : (dates.filter((date) => date < today).pop() ?? dates[0] ?? today)
  const [view, setView] = useState(() => monthOf(startDate))
  const [selected, setSelected] = useState<string | null>(null)

  const monthKey = view.year * 12 + view.month
  const canGoBack = monthKey > first.year * 12 + first.month
  const canGoForward = monthKey < last.year * 12 + last.month
  const move = (delta: number) => {
    const next = monthKey + delta
    setView({ year: Math.floor(next / 12), month: next % 12 })
    setSelected(null)
  }

  const leadingBlanks = weekdayOf(makeDate(view.year, view.month, 1))
  const dayCount = daysInMonth(view.year, view.month)
  const selectedEntry = selected ? entries.get(selected) : undefined

  return (
    <section className={styles.wrapper} aria-label="Puzzle archive">
      <div className={styles.monthBar}>
        <button type="button" className="btn btn-ghost" onClick={() => move(-1)} disabled={!canGoBack} aria-label="Previous month">
          ←
        </button>
        <h2 className={styles.month}>{formatMonth(view.year, view.month)}</h2>
        <button type="button" className="btn btn-ghost" onClick={() => move(1)} disabled={!canGoForward} aria-label="Next month">
          →
        </button>
      </div>

      <div className={styles.grid} role="grid" aria-label={formatMonth(view.year, view.month)}>
        {WEEKDAYS.map((day) => (
          <span key={day} className={styles.weekday} role="columnheader">
            {day}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} role="gridcell" />
        ))}
        {Array.from({ length: dayCount }, (_, i) => {
          const date = makeDate(view.year, view.month, i + 1)
          const available = entries.has(date)
          const isToday = date === today
          const isFuture = date > today
          const played = history[date]
          const practiced = practice[date]
          const tier = played ? tierOf(played) : practiced ? tierOf(practiced) : null
          const practiceOnly = practiced && !played
          const shown = played ?? practiced
          const playable = available && !isFuture
          const tooltip = shown ? `${describeDay(shown).verdict} · ${describeDay(shown).tidbits.join(' · ')}${practiceOnly ? ' (practice)' : ''}` : undefined

          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              className={[
                styles.day,
                playable ? styles.available : '',
                isToday ? styles.today : '',
                selected === date ? styles.selected : '',
                practiceOnly ? styles.practiced : '',
                tier !== null ? styles[`tier${tier}`] : '',
                practiceOnly ? styles.practiceOnly : '',
                played && describeDay(played).hintFree ? styles.hintFree : '',
              ].join(' ')}
              disabled={!playable}
              title={tooltip}
              aria-label={`${formatLongDate(date)}${isToday ? ', today' : ''}${played ? `, scored ${totalScoreOf(played)}` : ''}${practiced ? `, practiced, scored ${totalScoreOf(practiced)}` : ''}${available && isFuture ? ', not yet available' : ''}`}
              aria-selected={selected === date}
              onClick={() => (isToday ? onPlayToday() : setSelected(date))}
            >
              <span className={styles.dayNumber}>{i + 1}</span>
              {shown && (
                <small className={styles.dayScore} aria-hidden="true">
                  {totalScoreOf(shown)}
                </small>
              )}
            </button>
          )
        })}
      </div>

      <p className={styles.legend}>
        Colored days were played on the day (color reflects your score; a gold corner means no hints). Muted days with
        a dotted outline are practice replays, which never count toward your streak or stats.
      </p>

      {selectedEntry && (
        <div className={styles.detail}>
          <div className={styles.detailBody}>
            <h3 className={styles.detailDate}>{formatLongDate(selectedEntry.date)}</h3>
            <ul className={styles.chips}>
              {selectedEntry.categoryKeys.map((key, i) => (
                <li key={key}>
                  {STAT_CATEGORIES[key].unit} <small>{SCOPE_LABELS[selectedEntry.scopes[i]]}</small>
                </li>
              ))}
            </ul>
            {history[selectedEntry.date] && <ResultLine label="Played on the day" entry={history[selectedEntry.date]} />}
            {practice[selectedEntry.date] && <ResultLine label="Practice" entry={practice[selectedEntry.date]} muted />}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => onPractice(selectedEntry.date)}>
            {practice[selectedEntry.date] ? 'Open practice' : 'Play practice'}
          </button>
        </div>
      )}
    </section>
  )
}
