import { describe, expect, it } from 'vitest'
import { clampToBand, hintBand } from './hints.ts'

describe('hintBand', () => {
  it('is the full slider with no hints', () => {
    expect(hintBand(0.4, 0, 'seed')).toEqual({ start: 0, end: 1 })
  })

  it('halves the width with every hint and always contains the true position', () => {
    for (let trial = 0; trial < 200; trial++) {
      const actual = (trial % 99) / 100 + 0.005
      let previous = { start: 0, end: 1 }
      for (let hints = 1; hints <= 5; hints++) {
        const band = hintBand(actual, hints, `seed-${trial}`)
        expect(band.end - band.start).toBeCloseTo(0.5 ** hints, 10)
        expect(band.start).toBeLessThanOrEqual(actual + 1e-9)
        expect(band.end).toBeGreaterThanOrEqual(actual - 1e-9)
        expect(band.start).toBeGreaterThanOrEqual(previous.start - 1e-9)
        expect(band.end).toBeLessThanOrEqual(previous.end + 1e-9)
        previous = band
      }
    }
  })

  it('is deterministic for the same seed', () => {
    expect(hintBand(0.3, 2, 'abc')).toEqual(hintBand(0.3, 2, 'abc'))
  })

  it('does not always center the answer', () => {
    const centers = new Set(
      Array.from({ length: 20 }, (_, i) => {
        const band = hintBand(0.5, 1, `seed-${i}`)
        return (0.5 - band.start) / (band.end - band.start)
      }).map((position) => position.toFixed(2)),
    )
    expect(centers.size).toBeGreaterThan(5)
  })
})

describe('clampToBand', () => {
  it('limits a position to the band', () => {
    const band = { start: 0.25, end: 0.75 }
    expect(clampToBand(0.1, band)).toBe(0.25)
    expect(clampToBand(0.9, band)).toBe(0.75)
    expect(clampToBand(0.5, band)).toBe(0.5)
  })
})
