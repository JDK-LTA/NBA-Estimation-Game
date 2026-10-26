import { useState } from 'react'
import { loadArchiveIndex, loadMeta, loadPlayers, loadPuzzle } from './data/loaders.ts'
import { hasSeenHowToPlay, markHowToPlaySeen } from './data/storage.ts'
import { computeStreaks } from './logic/history.ts'
import { formatLongDate } from './logic/dates.ts'
import { useAsync } from './hooks/useAsync.ts'
import { useInfiniteResults } from './hooks/useInfiniteResults.ts'
import { usePersonalHistory } from './hooks/usePersonalHistory.ts'
import { useToday } from './hooks/useToday.ts'
import { useTheme } from './hooks/useTheme.ts'
import type { Player, UserDailyHistoryEntry } from './types/index.ts'
import { ArchiveCalendar } from './components/ArchiveCalendar.tsx'
import { DayView } from './components/DayView.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { HowToPlay } from './components/HowToPlay.tsx'
import { InfiniteMode } from './components/InfiniteMode.tsx'
import { StatsView } from './components/StatsView.tsx'
import { StatusMessage } from './components/StatusMessage.tsx'
import styles from './App.module.css'

type View =
  | { name: 'daily' }
  | { name: 'archive' }
  | { name: 'stats' }
  | { name: 'infinite' }
  | { name: 'practice'; date: string }

const NAV: { view: View; label: string }[] = [
  { view: { name: 'daily' }, label: 'Daily' },
  { view: { name: 'archive' }, label: 'Archive' },
  { view: { name: 'stats' }, label: 'Stats' },
  { view: { name: 'infinite' }, label: 'Infinite' },
]

interface PuzzleScreenProps {
  date: string
  official: boolean
  players: Record<string, Player>
  streak?: number
  onComplete?: (entry: UserDailyHistoryEntry) => void
  onNavigate: (view: View) => void
}

function PuzzleScreen({ date, official, players, streak, onComplete, onNavigate }: PuzzleScreenProps) {
  const [attempt, setAttempt] = useState(0)
  const [run, setRun] = useState(0)
  const puzzle = useAsync(() => loadPuzzle(date), [date, attempt])

  if (puzzle.status === 'loading') return <StatusMessage kind="loading" title="Loading the puzzle…" />
  if (puzzle.status === 'error') {
    return (
      <StatusMessage kind="error" title="Couldn't load the puzzle">
        <p>{puzzle.error.message}</p>
        <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </StatusMessage>
    )
  }
  if (!puzzle.data) {
    return (
      <StatusMessage kind="empty" title={`No puzzle for ${formatLongDate(date)}`}>
        <p>The generated archive doesn&apos;t cover this date yet.</p>
        <button type="button" className="btn btn-primary" onClick={() => onNavigate({ name: 'archive' })}>
          Browse the archive
        </button>
        <button type="button" className="btn" onClick={() => onNavigate({ name: 'infinite' })}>
          Try Infinite Mode
        </button>
      </StatusMessage>
    )
  }

  return (
    <DayView
      key={`${puzzle.data.date}-${run}`}
      puzzle={puzzle.data}
      players={players}
      official={official}
      streak={streak}
      onComplete={onComplete}
      onPlayAgain={official ? undefined : () => setRun((n) => n + 1)}
    />
  )
}

export default function App() {
  const today = useToday()
  const { theme, toggleTheme } = useTheme()
  const [view, setView] = useState<View>({ name: 'daily' })
  const [helpOpen, setHelpOpen] = useState(() => !hasSeenHowToPlay())
  const [attempt, setAttempt] = useState(0)
  const players = useAsync(loadPlayers, [attempt])
  const meta = useAsync(loadMeta, [])
  const archive = useAsync(loadArchiveIndex, [])
  const { history, record, practice, recordPractice } = usePersonalHistory()
  const { results: infiniteResults, recordResult: recordInfiniteResult } = useInfiniteResults()

  const closeHelp = () => {
    markHowToPlaySeen()
    setHelpOpen(false)
  }

  const activeNav = view.name === 'practice' ? 'archive' : view.name

  const renderBody = () => {
    if (players.status === 'loading') return <StatusMessage kind="loading" title="Loading players…" />
    if (players.status === 'error') {
      return (
        <StatusMessage kind="error" title="Couldn't load the player data">
          <p>{players.error.message}</p>
          <button type="button" className="btn" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </StatusMessage>
      )
    }

    switch (view.name) {
      case 'daily':
        return (
          <PuzzleScreen
            key={today}
            date={today}
            official
            players={players.data}
            streak={computeStreaks(Object.keys(history), today).current}
            onComplete={record}
            onNavigate={setView}
          />
        )
      case 'practice':
        return (
          <>
            <div className={styles.practiceBar}>
              <button type="button" className="btn btn-ghost" onClick={() => setView({ name: 'archive' })}>
                ← Archive
              </button>
              <span className={styles.practiceBadge}>Practice · saved, but not counted in your stats</span>
            </div>
            <PuzzleScreen
              key={view.date}
              date={view.date}
              official={false}
              players={players.data}
              onComplete={recordPractice}
              onNavigate={setView}
            />
          </>
        )
      case 'archive':
        if (archive.status === 'loading') return <StatusMessage kind="loading" title="Loading the archive…" />
        if (archive.status === 'error') {
          return (
            <StatusMessage kind="error" title="Couldn't load the archive">
              <p>{archive.error.message}</p>
            </StatusMessage>
          )
        }
        return (
          <ArchiveCalendar
            index={archive.data}
            history={history}
            practice={practice}
            today={today}
            onPractice={(date) => setView({ name: 'practice', date })}
            onPlayToday={() => setView({ name: 'daily' })}
          />
        )
      case 'stats':
        return (
          <StatsView
            history={history}
            practice={practice}
            infiniteResults={infiniteResults}
            today={today}
            onNavigate={(target) =>
              setView(target === 'archive' ? { name: 'archive' } : target === 'infinite' ? { name: 'infinite' } : { name: 'daily' })
            }
          />
        )
      case 'infinite':
        return <InfiniteMode players={players.data} onRoundComplete={recordInfiniteResult} />
    }
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.brand}>
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="30" height="30" />
            The Range
          </h1>
          <nav className={styles.nav} aria-label="Main">
            {NAV.map((item) => (
              <button
                key={item.view.name}
                type="button"
                className={`${styles.navButton} ${activeNav === item.view.name ? styles.navActive : ''}`}
                aria-current={activeNav === item.view.name ? 'page' : undefined}
                onClick={() => setView(item.view)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            className={styles.help}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {theme === 'dark' ? (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </>
              ) : (
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              )}
            </svg>
          </button>
          <button type="button" className={styles.help} onClick={() => setHelpOpen(true)} aria-label="How to play">
            ?
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <ErrorBoundary>{renderBody()}</ErrorBoundary>
      </main>

      <footer className={styles.footer}>
        <p>
          Stats from NBA.com via the open-source <code>nba_api</code>
          {meta.status === 'ready' && (
            <>
              {' '}
              · snapshot {meta.data.generatedAt} · season &amp; playoff data {meta.data.firstSeason} to{' '}
              {meta.data.lastSeason}
            </>
          )}
          . Player photos courtesy of NBA.com. Not affiliated with the NBA.
        </p>
      </footer>

      <HowToPlay open={helpOpen} onClose={closeHelp} />
    </div>
  )
}
