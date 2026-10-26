import { useState, type CSSProperties, type ReactNode } from 'react'
import { SCOPE_DESCRIPTIONS, STAT_CATEGORIES, formatStatValue } from '../logic/categories.ts'
import { isRoundFullyPlaced, type RoundState } from '../logic/gameState.ts'
import type { Band } from '../logic/hints.ts'
import { PLAYER_COLORS } from '../logic/display.ts'
import { scoreTier } from '../logic/history.ts'
import {
  anchorsOf,
  hintBandFor,
  middlePlayersOf,
  scoreRound,
  totalHintsUsed,
  valueAtPercent,
} from '../logic/roundScoring.ts'
import type { Player, PuzzleRound } from '../types/index.ts'
import { AnchorCard } from './AnchorCard.tsx'
import { PlayerCard } from './PlayerCard.tsx'
import { ScopeBadge } from './ScopeBadge.tsx'
import { SliderTrack } from './SliderTrack.tsx'
import styles from './RoundBoard.module.css'

const VERDICTS = ['Rough round', 'Getting there', 'Solid', 'Sharp', 'Dead-eye'] as const

interface RoundBoardProps {
  round: PuzzleRound
  players: Record<string, Player>
  state: RoundState
  hintsPerRound: number
  onPlace: (playerId: string, position: number) => void
  onHint: (playerId: string) => void
  onSubmit: () => void
  /** Rendered after the round is submitted (e.g. "next round" or "reroll" actions). */
  afterSubmit?: ReactNode
}

function firstUnplaced(round: PuzzleRound, positions: Record<string, number>, skipId?: string): string | null {
  return middlePlayersOf(round).find((p) => p.playerId !== skipId && positions[p.playerId] === undefined)?.playerId ?? null
}

export function RoundBoard({
  round,
  players,
  state,
  hintsPerRound,
  onPlace,
  onHint,
  onSubmit,
  afterSubmit,
}: RoundBoardProps) {
  const category = STAT_CATEGORIES[round.categoryKey]
  const middles = middlePlayersOf(round)
  const { low, high } = anchorsOf(round)
  const [selectedId, setSelectedId] = useState<string | null>(
    () => firstUnplaced(round, state.positions) ?? middles[0]?.playerId ?? null,
  )

  const revealed = state.submitted
  const hintsUsed = totalHintsUsed(state.hints)
  const hintsLeft = Math.max(0, hintsPerRound - hintsUsed)
  const complete = isRoundFullyPlaced(round, state)
  const placedCount = middles.filter((p) => state.positions[p.playerId] !== undefined).length
  const scored = scoreRound(round, state)
  const colors: Record<string, string> = Object.fromEntries(
    middles.map((player, index) => [player.playerId, PLAYER_COLORS[index % PLAYER_COLORS.length]]),
  )

  const bands: Record<string, Band> = {}
  for (const player of middles) {
    const count = state.hints[player.playerId] ?? 0
    if (count > 0) bands[player.playerId] = hintBandFor(round, player, count)
  }

  const handlePlace = (playerId: string, position: number) => {
    const wasPlaced = state.positions[playerId] !== undefined
    onPlace(playerId, position)
    if (!wasPlaced) setSelectedId(firstUnplaced(round, state.positions, playerId) ?? playerId)
  }

  const selected = selectedId ? middles.find((p) => p.playerId === selectedId) : undefined
  const selectedPlaced = selected ? state.positions[selected.playerId] !== undefined : false

  let instruction: string
  if (revealed) instruction = 'Round locked in. Here is how close you got.'
  else if (!selected) instruction = 'Pick a player below, then tap the track to place them.'
  else if (!selectedPlaced) instruction = `Tap the track to place ${players[selected.playerId]?.fullName ?? 'this player'}.`
  else if (complete) instruction = 'Fine-tune by dragging or with arrow keys, then lock in your round.'
  else instruction = 'Pick the next player, or drag a marker to adjust it.'

  const verdict = VERDICTS[scoreTier(scored.max > 0 ? scored.total / scored.max : 0)]

  return (
    <section
      className={styles.board}
      style={{ '--scope-color': `var(--scope-${round.scope})` } as CSSProperties}
      aria-label={`${category.label} round`}
    >
      <header className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{category.label}</h2>
            <ScopeBadge scope={round.scope} size="lg" />
          </div>
          <p className={styles.scopeNote}>{SCOPE_DESCRIPTIONS[round.scope]}</p>
          <p className={styles.subtitle}>
            <span title="The slider's width varies slightly from puzzle to puzzle; the two anchors mark its exact ends.">
              Slider spans ~{formatStatValue(round.nominalRangeSize ?? round.rangeSize, round.categoryKey)} {category.unit}
            </span>
          </p>
        </div>
        <div className={styles.hintsLeft} aria-live="polite">
          <span aria-hidden="true">💡</span> {hintsLeft} hint{hintsLeft === 1 ? '' : 's'} left
        </div>
      </header>

      <div className={styles.anchors}>
        <AnchorCard anchor={low} player={players[low.playerId]} round={round} side="low" />
        <span className={styles.anchorArrow} aria-hidden="true">
          ⟷
        </span>
        <AnchorCard anchor={high} player={players[high.playerId]} round={round} side="high" />
      </div>

      <p className={styles.instruction} aria-live="polite">
        {instruction}
      </p>

      <SliderTrack
        round={round}
        players={players}
        colors={colors}
        positions={state.positions}
        bands={bands}
        selectedId={revealed ? null : selectedId}
        revealed={revealed}
        disabled={revealed}
        onSelect={setSelectedId}
        onPlace={handlePlace}
      />

      {revealed && (
        <div className={styles.summary} role="status">
          <span className={styles.summaryScore}>
            {scored.total + scored.bonus}
            <small> / {scored.max}</small>
          </span>
          <span className={styles.summaryDetail}>
            <span className={styles.verdict}>{verdict}</span>
            <span className={styles.base}>
              {scored.bonus > 0
                ? `${scored.total} without bonus · +${scored.bonus} for the exact order`
                : 'Order bonus missed (+100 for the exact order)'}
            </span>
          </span>
        </div>
      )}

      <ul className={styles.tray}>
        {middles.map((player) => {
          const id = player.playerId
          const position = state.positions[id]
          return (
            <PlayerCard
              key={id}
              player={players[id]}
              selection={player}
              scope={round.scope}
              color={colors[id]}
              selected={selectedId === id}
              guessLabel={position === undefined ? undefined : formatStatValue(valueAtPercent(round, position), round.categoryKey)}
              hintCount={state.hints[id] ?? 0}
              canHint={!revealed && hintsLeft > 0}
              revealed={revealed}
              score={revealed ? scored.playerScores[id] : undefined}
              actualLabel={formatStatValue(player.value, round.categoryKey)}
              unit={category.unit}
              onSelect={() => setSelectedId(id)}
              onHint={() => onHint(id)}
            />
          )
        })}
      </ul>

      {!revealed ? (
        <div className={styles.submitRow}>
          <button type="button" className="btn btn-primary" disabled={!complete} onClick={onSubmit}>
            Lock in round
          </button>
          {!complete && (
            <span className={styles.progress}>
              {placedCount} of {middles.length} placed
            </span>
          )}
          {complete && (
            <span className={styles.progress}>Bonus: +100 if the left-to-right order is exactly right</span>
          )}
        </div>
      ) : (
        afterSubmit
      )}
    </section>
  )
}
