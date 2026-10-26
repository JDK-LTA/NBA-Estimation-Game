import { hashString } from './rng.ts'

// TDD.md 2.5: each hint halves the guessing range for one player.

export interface Band {
  start: number
  end: number
}

/**
 * The slider band (0-1) a player is limited to after `hintCount` hints. Every
 * band contains the true position and is nested in the previous one. Where the
 * truth sits inside the band is derived from `seed`, so it is stable between
 * renders but never reveals the answer by always being centered.
 */
export function hintBand(actualPct: number, hintCount: number, seed: string): Band {
  let band: Band = { start: 0, end: 1 }
  for (let step = 1; step <= hintCount; step++) {
    const width = (band.end - band.start) / 2
    const offset = 0.2 + 0.6 * (hashString(`${seed}|${step}`) / 4294967295)
    const start = Math.min(band.end - width, Math.max(band.start, actualPct - width * offset))
    band = { start, end: start + width }
  }
  return band
}

export function clampToBand(position: number, band: Band): number {
  return Math.min(band.end, Math.max(band.start, position))
}
