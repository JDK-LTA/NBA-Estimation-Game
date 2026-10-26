import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { HistoryMap } from '../logic/history.ts'
import type { InfiniteRoundResult, UserDailyHistoryEntry } from '../types/index.ts'
import { StatsView } from './StatsView.tsx'

const entry = (date: string, dailyScore: number, bonusRounds = 0): UserDailyHistoryEntry => ({
  date,
  dailyScore,
  bonusScore: bonusRounds * 100,
  maxScore: 1500,
  completedAt: `${date}T12:00:00.000Z`,
  roundResults: [0, 1, 2].map((roundIndex) => ({
    date,
    roundIndex,
    categoryKey: 'ppg' as const,
    score: dailyScore / 3,
    bonus: roundIndex < bonusRounds ? 100 : 0,
    hintsUsedByPlayer: { a: 1 },
    guesses: {},
  })),
})

const infinite = (id: string, categoryKey: InfiniteRoundResult['categoryKey'], score: number): InfiniteRoundResult => ({
  id,
  completedAt: '2026-10-23T12:00:00.000Z',
  categoryKey,
  scope: 'season',
  middlePlayerCount: 5,
  score,
  bonus: 0,
  maxScore: 500,
  hintsUsed: 1,
})

const history: HistoryMap = { '2026-10-23': entry('2026-10-23', 1200) }
const practice: HistoryMap = {
  '2026-10-20': entry('2026-10-20', 900, 2),
  '2026-10-21': entry('2026-10-21', 600, 1),
}

function renderStats(overrides: Partial<Parameters<typeof StatsView>[0]> = {}) {
  const onNavigate = vi.fn()
  render(
    <StatsView
      history={history}
      practice={practice}
      infiniteResults={[infinite('a', 'ppg', 400), infinite('b', 'apg', 250)]}
      today="2026-10-23"
      onNavigate={onNavigate}
      {...overrides}
    />,
  )
  return onNavigate
}

describe('StatsView sections', () => {
  it('opens on the official daily stats', () => {
    renderStats()
    expect(screen.getByRole('tab', { name: 'Daily' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Days played')).toBeInTheDocument()
    expect(screen.getByText('Current streak')).toBeInTheDocument()
  })

  it('shows archive replays separately, without streaks', () => {
    renderStats()
    fireEvent.click(screen.getByRole('tab', { name: 'Archive' }))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('Days replayed')).toBeInTheDocument()
    expect(within(panel).getByText('Order bonuses').previousSibling).toHaveTextContent('3')
    expect(within(panel).queryByText('Current streak')).not.toBeInTheDocument()
  })

  it('shows Infinite accuracy by stat and scope', () => {
    renderStats()
    fireEvent.click(screen.getByRole('tab', { name: 'Infinite' }))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('Rounds played').previousSibling).toHaveTextContent('2')
    expect(within(panel).getByText('Points Per Game')).toBeInTheDocument()
    expect(within(panel).getByText('Assists Per Game')).toBeInTheDocument()
    expect(within(panel).getByText('Single Season')).toBeInTheDocument()
  })

  it('offers a way in from each empty section', () => {
    const onNavigate = renderStats({ history: {}, practice: {}, infiniteResults: [] })
    fireEvent.click(screen.getByRole('button', { name: "Play today's puzzle" }))
    fireEvent.click(screen.getByRole('tab', { name: 'Archive' }))
    fireEvent.click(screen.getByRole('button', { name: 'Browse the archive' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Infinite' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play Infinite Mode' }))
    expect(onNavigate.mock.calls.map((call) => call[0])).toEqual(['daily', 'archive', 'infinite'])
  })
})
