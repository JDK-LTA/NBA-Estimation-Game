import { STAT_CATEGORIES, SCOPE_LABELS } from './categories.ts'
import { scoreTier } from './history.ts'
import type { CategoryKey, Scope } from '../types/index.ts'

export interface ShareRound {
  categoryKey: CategoryKey
  scope: Scope
  /** One entry per middle player, in display order. */
  playerScores: number[]
  /** Order bonus earned this round (0 if the order was missed). */
  bonus: number
  hintsUsed: number
}

const TIER_SQUARES = ['⬛', '🟥', '🟧', '🟨', '🟩'] as const

export function squareFor(score: number): string {
  return TIER_SQUARES[scoreTier(score / 100)]
}

/** Spoiler-free summary (no player names) that can be pasted anywhere. */
export function buildShareText(heading: string, rounds: ShareRound[]): string {
  const lines = [`The Range - ${heading}`]
  let total = 0
  let max = 0
  let hints = 0
  let bonus = 0

  for (const round of rounds) {
    const score = round.playerScores.reduce((sum, value) => sum + value, 0)
    total += score
    bonus += round.bonus
    max += round.playerScores.length * 100
    hints += round.hintsUsed
    const label = `${STAT_CATEGORIES[round.categoryKey].unit} (${SCOPE_LABELS[round.scope]})`
    const bonusMark = round.bonus > 0 ? ` +${round.bonus}` : ''
    lines.push(`${round.playerScores.map(squareFor).join('')} ${label} ${score}${bonusMark}`)
  }

  const format = (value: number) => value.toLocaleString('en-US')
  const hintText = hints === 0 ? 'no hints' : `${hints} hint${hints === 1 ? '' : 's'}`
  const totalText =
    bonus > 0 ? `${format(total + bonus)} (${format(total)} + ${format(bonus)} order bonus)` : format(total)
  lines.push(`Total: ${totalText} / ${format(max)} - ${hintText}`)
  return lines.join('\n')
}
