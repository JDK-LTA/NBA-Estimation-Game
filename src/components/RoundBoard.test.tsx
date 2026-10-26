import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useGame } from '../hooks/useGame.ts'
import { fixturePlayers, makeRound } from '../test/roundFixture.ts'
import type { PuzzleRound } from '../types/index.ts'
import { RoundBoard } from './RoundBoard.tsx'

const rounds: PuzzleRound[] = [makeRound()]

function Harness({ hintsPerRound = 3 }: { hintsPerRound?: number }) {
  const { state, place, hint, submit } = useGame(rounds, hintsPerRound, null)
  return (
    <RoundBoard
      round={rounds[0]}
      players={fixturePlayers}
      state={state.rounds[0]}
      hintsPerRound={hintsPerRound}
      onPlace={(id, position) => place(0, id, position)}
      onHint={(id) => hint(0, id)}
      onSubmit={() => submit(0)}
      afterSubmit={<p>All done</p>}
    />
  )
}

const track = () => screen.getByRole('group', { name: /Estimate track/ })

describe('RoundBoard (full round)', () => {
  it('shows both anchors with their real values and every middle player unplaced', () => {
    render(<Harness />)
    expect(within(screen.getByTestId('anchor-low')).getByText('20.0')).toBeInTheDocument()
    expect(within(screen.getByTestId('anchor-high')).getByText('30.0')).toBeInTheDocument()
    expect(screen.getAllByText('Not placed')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Lock in round' })).toBeDisabled()
    expect(screen.getByText('0 of 3 placed')).toBeInTheDocument()
  })

  it('auto-advances the selection and only unlocks submit once everyone is placed', () => {
    render(<Harness />)
    expect(screen.getByText(/Tap the track to place Alpha Player/)).toBeInTheDocument()

    fireEvent.click(track())
    expect(screen.getByText(/Tap the track to place Bravo Player/)).toBeInTheDocument()
    fireEvent.click(track())
    fireEvent.click(track())

    expect(screen.queryByText('Not placed')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lock in round' })).toBeEnabled()
  })

  it('lets the player pick which player to place next', () => {
    render(<Harness />)
    fireEvent.click(within(screen.getByTestId('card-c')).getByRole('button', { name: /2017-18/ }))
    expect(screen.getByText(/Tap the track to place Charlie Player/)).toBeInTheDocument()
    fireEvent.click(track())
    expect(within(screen.getByTestId('card-c')).getByText('25.0')).toBeInTheDocument()
  })

  it('scores a submitted round and reveals the actual values', () => {
    render(<Harness />)
    // jsdom clicks land at 0.5 for every player: errors .25, 0, .30 -> 75 + 100 + 70.
    fireEvent.click(track())
    fireEvent.click(track())
    fireEvent.click(track())
    fireEvent.click(screen.getByRole('button', { name: 'Lock in round' }))

    expect(screen.getByRole('status')).toHaveTextContent('245')
    expect(screen.getByRole('status')).toHaveTextContent('/ 300')
    expect(within(screen.getByTestId('card-a')).getByLabelText('Score 75')).toBeInTheDocument()
    expect(within(screen.getByTestId('card-b')).getByLabelText('Score 100')).toBeInTheDocument()
    expect(within(screen.getByTestId('card-c')).getByLabelText('Score 70')).toBeInTheDocument()
    expect(screen.getByText('All done')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lock in round' })).not.toBeInTheDocument()
  })

  it('narrows the range with a hint, tracks usage, and applies the penalty', () => {
    render(<Harness />)
    expect(screen.getByText('3 hints left')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Use a hint on Bravo Player/ }))
    expect(screen.getByText('2 hints left')).toBeInTheDocument()
    expect(screen.getByTestId('band-b')).toBeInTheDocument()
    expect(screen.getByLabelText('1 hint used')).toBeInTheDocument()

    // The penalty message for the next hint on the same player is steeper (30%).
    expect(screen.getByRole('button', { name: /Use a hint on Bravo Player.*30%/ })).toBeInTheDocument()

    fireEvent.click(within(screen.getByTestId('card-b')).getByRole('button', { name: /2018-19/ }))
    fireEvent.click(track())
    fireEvent.click(track())
    fireEvent.click(track())
    fireEvent.click(screen.getByRole('button', { name: 'Lock in round' }))

    // Bravo: the guess is clamped inside the hint band around the true 50%, then x0.75.
    const bravoScore = Number(within(screen.getByTestId('card-b')).getByLabelText(/Score/).textContent)
    expect(bravoScore).toBeLessThanOrEqual(75)
    expect(bravoScore).toBeGreaterThan(55)
    expect(within(screen.getByTestId('card-b')).getByText(/1 hint/)).toBeInTheDocument()
  })

  it('adds an order bonus on top of the shown maximum when the order is exactly right', () => {
    render(<Harness />)
    fireEvent.click(track())
    fireEvent.click(track())
    fireEvent.click(track())
    fireEvent.keyDown(screen.getByRole('slider', { name: /Alpha Player/ }), { key: 'Home' })
    fireEvent.keyDown(screen.getByRole('slider', { name: /Charlie Player/ }), { key: 'End' })
    fireEvent.click(screen.getByRole('button', { name: 'Lock in round' }))

    // a: 0 vs .25 -> 75, b: 100, c: 1 vs .8 -> 80 = 255, plus 100 for the order; max stays 300.
    const summary = screen.getByRole('status')
    expect(summary).toHaveTextContent('355')
    expect(summary).toHaveTextContent('/ 300')
    expect(summary).toHaveTextContent('255 without bonus')
  })

  it('reports a missed order bonus without changing the base score', () => {
    render(<Harness />)
    fireEvent.click(track())
    fireEvent.click(track())
    fireEvent.click(track())
    fireEvent.click(screen.getByRole('button', { name: 'Lock in round' }))
    expect(screen.getByRole('status')).toHaveTextContent('Order bonus missed')
  })

  it('disables every hint button once the round budget is spent', () => {
    render(<Harness hintsPerRound={1} />)
    fireEvent.click(screen.getByRole('button', { name: /Use a hint on Alpha Player/ }))
    expect(screen.getByText('0 hints left')).toBeInTheDocument()
    for (const button of screen.getAllByRole('button', { name: /Use a hint on/ })) {
      expect(button).toBeDisabled()
    }
  })

  it('supports zero hints per round', () => {
    render(<Harness hintsPerRound={0} />)
    expect(screen.getByText('0 hints left')).toBeInTheDocument()
    for (const button of screen.getAllByRole('button', { name: /Use a hint on/ })) {
      expect(button).toBeDisabled()
    }
  })
})
