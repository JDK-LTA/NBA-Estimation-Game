import { useRef, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { STAT_CATEGORIES, formatStatValue } from '../logic/categories.ts'
import type { Band } from '../logic/hints.ts'
import { assignLanes, laneCount } from '../logic/lanes.ts'
import { middlePlayersOf, truePercent, valueAtPercent } from '../logic/roundScoring.ts'
import { useElementWidth } from '../hooks/useElementWidth.ts'
import type { Player, PuzzleRound } from '../types/index.ts'
import { PlayerAvatar } from './PlayerAvatar.tsx'
import styles from './SliderTrack.module.css'

const BAR_HEIGHT = 14
const LABEL_HEIGHT = 22

interface SliderTrackProps {
  round: PuzzleRound
  players: Record<string, Player>
  colors: Record<string, string>
  /** Slider positions (0-1) of the markers placed so far. */
  positions: Record<string, number>
  /** Allowed band per player who has used hints. */
  bands: Record<string, Band>
  selectedId: string | null
  revealed: boolean
  disabled: boolean
  onSelect: (playerId: string) => void
  onPlace: (playerId: string, position: number) => void
}

export function SliderTrack({
  round,
  players,
  colors,
  positions,
  bands,
  selectedId,
  revealed,
  disabled,
  onSelect,
  onPlace,
}: SliderTrackProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingId = useRef<string | null>(null)
  const width = useElementWidth(trackRef)

  const unit = STAT_CATEGORIES[round.categoryKey].unit
  const markerSize = width < 440 ? 34 : 42
  const laneHeight = markerSize + 8
  const minGap = (markerSize + 4) / width

  const middles = middlePlayersOf(round)
  const placed = middles.filter((player) => positions[player.playerId] !== undefined)
  const guessLanes = assignLanes(
    placed.map((player) => ({ id: player.playerId, position: positions[player.playerId] })),
    minGap,
  )
  const truthLanes = revealed
    ? assignLanes(
        middles.map((player) => ({ id: player.playerId, position: truePercent(round, player) })),
        minGap,
      )
    : {}

  const barTop = Math.max(1, laneCount(guessLanes)) * laneHeight + 32
  const barBottom = barTop + BAR_HEIGHT
  const truthTop = barBottom + LABEL_HEIGHT + 6
  const stageHeight = revealed ? truthTop + laneCount(truthLanes) * laneHeight + 34 : barBottom + LABEL_HEIGHT + 4

  const positionFromPointer = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    return rect && rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5
  }

  const handleStageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (disabled || !selectedId) return
    onPlace(selectedId, positionFromPointer(event.clientX))
  }

  const handleMarkerPointerDown = (event: PointerEvent<HTMLDivElement>, playerId: string) => {
    if (disabled) return
    event.stopPropagation()
    draggingId.current = playerId
    onSelect(playerId)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleMarkerPointerMove = (event: PointerEvent<HTMLDivElement>, playerId: string) => {
    if (draggingId.current === playerId) onPlace(playerId, positionFromPointer(event.clientX))
  }

  const handleMarkerKeyDown = (event: KeyboardEvent<HTMLDivElement>, playerId: string) => {
    if (disabled) return
    const current = positions[playerId] ?? 0.5
    const step = event.shiftKey ? 0.05 : 0.01
    const next: Record<string, number> = {
      ArrowLeft: current - step,
      ArrowDown: current - step,
      ArrowRight: current + step,
      ArrowUp: current + step,
      PageDown: current - 0.1,
      PageUp: current + 0.1,
      Home: 0,
      End: 1,
    }
    if (event.key in next) {
      event.preventDefault()
      onPlace(playerId, next[event.key])
    }
  }

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.stage}
        style={{ height: stageHeight, '--marker': `${markerSize}px` } as CSSProperties}
        onClick={handleStageClick}
        role="group"
        aria-label={`Estimate track from ${formatStatValue(round.lowAnchorValue, round.categoryKey)} to ${formatStatValue(round.lowAnchorValue + round.rangeSize, round.categoryKey)} ${unit}`}
      >
        <div className={styles.track} ref={trackRef}>
          {middles.map((player) => {
            const band = bands[player.playerId]
            if (!band) return null
            const active = selectedId === player.playerId
            return (
              <div
                key={`band-${player.playerId}`}
                className={`${styles.band} ${active ? styles.bandActive : ''}`}
                data-testid={`band-${player.playerId}`}
                style={
                  {
                    left: `${band.start * 100}%`,
                    width: `${(band.end - band.start) * 100}%`,
                    top: barTop - 6,
                    height: BAR_HEIGHT + 12,
                    '--c': colors[player.playerId],
                  } as CSSProperties
                }
              />
            )
          })}

          <div className={styles.bar} style={{ top: barTop, height: BAR_HEIGHT }} />
          <span className={`${styles.endLabel} ${styles.endLeft}`} style={{ top: barBottom + 3 }}>
            {formatStatValue(round.lowAnchorValue, round.categoryKey)}
          </span>
          <span className={`${styles.endLabel} ${styles.endRight}`} style={{ top: barBottom + 3 }}>
            {formatStatValue(round.lowAnchorValue + round.rangeSize, round.categoryKey)}
          </span>

          {revealed &&
            middles.map((player, index) => {
              const guess = positions[player.playerId]
              if (guess === undefined) return null
              const truth = truePercent(round, player)
              return (
                <div
                  key={`gap-${player.playerId}`}
                  className={styles.errorSpan}
                  style={
                    {
                      left: `${Math.min(guess, truth) * 100}%`,
                      width: `${Math.abs(guess - truth) * 100}%`,
                      top: barTop + 2 + (index % 3) * 4,
                      '--c': colors[player.playerId],
                    } as CSSProperties
                  }
                />
              )
            })}

          {placed.map((player) => {
            const id = player.playerId
            const lane = guessLanes[id]
            const selected = selectedId === id
            const guessValue = formatStatValue(valueAtPercent(round, positions[id]), round.categoryKey)
            const name = players[id]?.fullName ?? id
            return (
              <div key={id}>
                <div
                  className={styles.stem}
                  style={
                    {
                      left: `${positions[id] * 100}%`,
                      top: barTop - 6 - lane * laneHeight,
                      height: 6 + lane * laneHeight,
                      '--c': colors[id],
                    } as CSSProperties
                  }
                />
                <div
                  role="slider"
                  tabIndex={disabled ? -1 : 0}
                  aria-label={`${name}, estimate`}
                  aria-orientation="horizontal"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(positions[id] * 100)}
                  aria-valuetext={`${guessValue} ${unit}`}
                  aria-disabled={disabled}
                  data-marker
                  data-testid={`marker-${id}`}
                  className={`${styles.marker} ${selected ? styles.markerSelected : ''} ${revealed ? styles.markerGhost : ''}`}
                  style={
                    {
                      left: `${positions[id] * 100}%`,
                      top: barTop - 6 - markerSize - lane * laneHeight,
                      zIndex: selected ? 30 : 10 - lane,
                    } as CSSProperties
                  }
                  onPointerDown={(event) => handleMarkerPointerDown(event, id)}
                  onPointerMove={(event) => handleMarkerPointerMove(event, id)}
                  onPointerUp={() => (draggingId.current = null)}
                  onPointerCancel={() => (draggingId.current = null)}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelect(id)
                  }}
                  onKeyDown={(event) => handleMarkerKeyDown(event, id)}
                >
                  {selected && !revealed && <span className={styles.pill}>{guessValue}</span>}
                  <PlayerAvatar player={players[id]} size={markerSize} ringColor={colors[id]} />
                </div>
              </div>
            )
          })}

          {revealed &&
            middles.map((player) => {
              const id = player.playerId
              const truth = truePercent(round, player)
              const lane = truthLanes[id]
              const avatarTop = truthTop + lane * laneHeight
              return (
                <div key={`truth-${id}`} data-testid={`truth-${id}`}>
                  <div
                    className={`${styles.stem} ${styles.truthStem}`}
                    style={
                      {
                        left: `${truth * 100}%`,
                        top: barBottom,
                        height: avatarTop - barBottom,
                        '--c': colors[id],
                      } as CSSProperties
                    }
                  />
                  <div
                    className={styles.truth}
                    style={{ left: `${truth * 100}%`, top: avatarTop } as CSSProperties}
                  >
                    <PlayerAvatar player={players[id]} size={markerSize} ringColor={colors[id]} />
                    <span className={styles.truthPill}>{formatStatValue(player.value, round.categoryKey)}</span>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
