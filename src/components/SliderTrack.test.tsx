import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fixturePlayers, makeRound } from '../test/roundFixture.ts'
import { SliderTrack } from './SliderTrack.tsx'

const colors = { a: '#e8590c', b: '#1c7ed6', c: '#2f9e44' }

function renderTrack(overrides: Partial<Parameters<typeof SliderTrack>[0]> = {}) {
  const props = {
    round: makeRound(),
    players: fixturePlayers,
    colors,
    positions: {},
    bands: {},
    selectedId: 'a',
    revealed: false,
    disabled: false,
    onSelect: vi.fn(),
    onPlace: vi.fn(),
    ...overrides,
  }
  render(<SliderTrack {...props} />)
  return { ...props, onPlace: props.onPlace as ReturnType<typeof vi.fn> }
}

describe('SliderTrack', () => {
  it('shows the window edges and one slider per placed player', () => {
    renderTrack({ positions: { a: 0.25, b: 0.5 } })
    const track = screen.getByRole('group', { name: /Estimate track from 20\.0 to 30\.0 PPG/ })
    expect(within(track).getByText('20.0')).toBeInTheDocument()
    expect(within(track).getByText('30.0')).toBeInTheDocument()

    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(2)
    expect(screen.getByRole('slider', { name: /Alpha Player/ })).toHaveAttribute('aria-valuetext', '22.5 PPG')
    expect(screen.getByRole('slider', { name: /Bravo Player/ })).toHaveAttribute('aria-valuenow', '50')
  })

  it('places the selected player where the track is clicked', () => {
    const props = renderTrack()
    fireEvent.click(screen.getByRole('group'), { clientX: 10 })
    // jsdom has no layout, so the click maps to the track center fallback.
    expect(props.onPlace).toHaveBeenCalledWith('a', 0.5)
  })

  it('does nothing on click when nothing is selected or the track is disabled', () => {
    const none = renderTrack({ selectedId: null })
    fireEvent.click(screen.getAllByRole('group')[0])
    expect(none.onPlace).not.toHaveBeenCalled()
  })

  it('moves a marker with the arrow keys, faster with Shift, and jumps with Home/End', () => {
    const props = renderTrack({ positions: { a: 0.5 } })
    const marker = screen.getByRole('slider', { name: /Alpha Player/ })
    fireEvent.keyDown(marker, { key: 'ArrowRight' })
    fireEvent.keyDown(marker, { key: 'ArrowLeft', shiftKey: true })
    fireEvent.keyDown(marker, { key: 'Home' })
    fireEvent.keyDown(marker, { key: 'End' })
    expect(props.onPlace.mock.calls.map((call: unknown[]) => Number((call[1] as number).toFixed(2)))).toEqual([0.51, 0.45, 0, 1])
  })

  it('ignores keyboard input and clicks while disabled', () => {
    const props = renderTrack({ positions: { a: 0.5 }, disabled: true })
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
    fireEvent.click(screen.getByRole('group'))
    expect(props.onPlace).not.toHaveBeenCalled()
  })

  it('draws a hint band for players who used hints', () => {
    renderTrack({ positions: { a: 0.5 }, bands: { a: { start: 0.1, end: 0.6 } } })
    expect(screen.getByTestId('band-a')).toBeInTheDocument()
    expect(screen.queryByTestId('band-b')).not.toBeInTheDocument()
  })

  it('reveals the real values without leaking them beforehand', () => {
    const { unmount } = render(
      <SliderTrack
        round={makeRound()}
        players={fixturePlayers}
        colors={colors}
        positions={{ a: 0.5, b: 0.5, c: 0.5 }}
        bands={{}}
        selectedId={null}
        revealed={false}
        disabled={false}
        onSelect={() => {}}
        onPlace={() => {}}
      />,
    )
    expect(screen.queryByTestId('truth-a')).not.toBeInTheDocument()
    unmount()

    renderTrack({ positions: { a: 0.5, b: 0.5, c: 0.5 }, revealed: true, disabled: true, selectedId: null })
    expect(within(screen.getByTestId('truth-a')).getByText('22.5')).toBeInTheDocument()
    expect(within(screen.getByTestId('truth-b')).getByText('25.0')).toBeInTheDocument()
    expect(within(screen.getByTestId('truth-c')).getByText('28.0')).toBeInTheDocument()
  })
})
