import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makePuzzle, fixturePlayers } from '../test/roundFixture.ts'
import type { UserDailyHistoryEntry } from '../types/index.ts'
import { DayView } from './DayView.tsx'

const puzzle = makePuzzle()

/** Every jsdom click lands at 0.5, so each round scores 75 + 100 + 70 = 245. */
function playRound(index: number) {
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(`Round ${index + 1}`) }))
  const track = screen.getByRole('group', { name: /Estimate track/ })
  fireEvent.click(track)
  fireEvent.click(track)
  fireEvent.click(track)
  fireEvent.click(screen.getByRole('button', { name: 'Lock in round' }))
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('DayView', () => {
  it('shows all 3 rounds up front, each with its own category', () => {
    render(<DayView puzzle={puzzle} players={fixturePlayers} official />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      expect.stringContaining('PPG'),
      expect.stringContaining('APG'),
      expect.stringContaining('RPG'),
    ])
  })

  it('lets rounds be played in any order and totals the daily score', () => {
    const onComplete = vi.fn()
    render(<DayView puzzle={puzzle} players={fixturePlayers} official onComplete={onComplete} />)

    playRound(2)
    playRound(0)
    expect(screen.queryByTestId('daily-total')).not.toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()

    playRound(1)
    expect(screen.getByTestId('daily-total')).toHaveTextContent('735 / 900')
    expect(onComplete).toHaveBeenCalledTimes(1)
    const entry = onComplete.mock.calls[0][0] as UserDailyHistoryEntry
    expect(entry).toMatchObject({ date: '2026-10-23', dailyScore: 735, maxScore: 900 })
    expect(entry.roundResults.map((result) => result.categoryKey)).toEqual(['ppg', 'apg', 'rpg'])
  })

  it('saves progress so a refresh keeps submitted rounds', () => {
    const first = render(<DayView puzzle={puzzle} players={fixturePlayers} official />)
    playRound(0)
    expect(window.localStorage.getItem('range.v1.progress.2026-10-23')).toContain('"submitted":true')
    first.unmount()

    render(<DayView puzzle={puzzle} players={fixturePlayers} official />)
    const firstTab = screen.getByRole('tab', { name: /Round 1/ })
    expect(within(firstTab).getByText('245 pts')).toBeInTheDocument()
  })

  it('restores a fully completed day, including the results panel', () => {
    const first = render(<DayView puzzle={puzzle} players={fixturePlayers} official />)
    playRound(0)
    playRound(1)
    playRound(2)
    first.unmount()

    render(<DayView puzzle={puzzle} players={fixturePlayers} official />)
    expect(screen.getByTestId('daily-total')).toHaveTextContent('735 / 900')
  })

  it('saves practice replays separately from official progress and lets them be replayed', () => {
    const onComplete = vi.fn()
    const onPlayAgain = vi.fn()
    const first = render(
      <DayView puzzle={puzzle} players={fixturePlayers} official={false} onComplete={onComplete} onPlayAgain={onPlayAgain} />,
    )
    playRound(0)
    playRound(1)
    playRound(2)

    expect(screen.getByTestId('daily-total')).toHaveTextContent('735 / 900')
    expect(onComplete).toHaveBeenCalled()
    expect(window.localStorage.getItem('range.v1.practice.2026-10-23')).toContain('"submitted":true')
    expect(window.localStorage.getItem('range.v1.progress.2026-10-23')).toBeNull()
    expect(screen.getByText(/Practice/)).toBeInTheDocument()
    first.unmount()

    render(<DayView puzzle={puzzle} players={fixturePlayers} official={false} onPlayAgain={onPlayAgain} />)
    expect(screen.getByTestId('daily-total')).toHaveTextContent('735 / 900')

    fireEvent.click(screen.getByRole('button', { name: 'Play this day again' }))
    expect(onPlayAgain).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem('range.v1.practice.2026-10-23')).toBeNull()
  })

  it('celebrates a hint-free official day but not a hint-free practice replay', () => {
    const official = render(<DayView puzzle={puzzle} players={fixturePlayers} official />)
    playRound(0)
    expect(within(screen.getByRole('tab', { name: /Round 1/ })).getByLabelText('Completed without hints')).toBeInTheDocument()
    playRound(1)
    playRound(2)
    expect(screen.getByText('Hint-free day')).toBeInTheDocument()
    official.unmount()
    window.localStorage.clear()

    render(<DayView puzzle={puzzle} players={fixturePlayers} official={false} />)
    playRound(0)
    playRound(1)
    playRound(2)
    expect(screen.getByTestId('daily-total')).toBeInTheDocument()
    expect(screen.queryByText('Hint-free day')).not.toBeInTheDocument()
  })

  it('offers a shortcut to the next unfinished round', () => {
    render(<DayView puzzle={puzzle} players={fixturePlayers} official />)
    playRound(0)
    fireEvent.click(screen.getByRole('button', { name: /Next round: APG/ }))
    expect(screen.getByRole('tab', { name: /Round 2/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('copies a spoiler-free share text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    render(<DayView puzzle={puzzle} players={fixturePlayers} official />)
    playRound(0)
    playRound(1)
    playRound(2)
    fireEvent.click(screen.getByRole('button', { name: 'Copy results' }))

    await screen.findByRole('button', { name: 'Copied!' })
    const text = writeText.mock.calls[0][0] as string
    expect(text).toContain('Total: 735 / 900 - no hints')
    expect(text).not.toContain('Alpha Player')
  })
})
