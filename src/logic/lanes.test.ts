import { describe, expect, it } from 'vitest'
import { assignLanes, laneCount } from './lanes.ts'

describe('assignLanes', () => {
  it('keeps well separated markers in one lane', () => {
    const lanes = assignLanes(
      [
        { id: 'a', position: 0.1 },
        { id: 'b', position: 0.5 },
        { id: 'c', position: 0.9 },
      ],
      0.1,
    )
    expect(lanes).toEqual({ a: 0, b: 0, c: 0 })
    expect(laneCount(lanes)).toBe(1)
  })

  it('stacks overlapping markers and reuses freed lanes', () => {
    const lanes = assignLanes(
      [
        { id: 'a', position: 0.5 },
        { id: 'b', position: 0.52 },
        { id: 'c', position: 0.53 },
        { id: 'd', position: 0.9 },
      ],
      0.1,
    )
    expect(lanes.a).toBe(0)
    expect(lanes.b).toBe(1)
    expect(lanes.c).toBe(2)
    expect(lanes.d).toBe(0)
  })

  it('is stable for identical positions and handles empty input', () => {
    const lanes = assignLanes(
      [
        { id: 'b', position: 0.5 },
        { id: 'a', position: 0.5 },
      ],
      0.1,
    )
    expect(lanes).toEqual({ a: 0, b: 1 })
    expect(laneCount({})).toBe(0)
  })

  it('never places two markers closer than the gap in the same lane', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ id: String(i), position: ((i * 37) % 100) / 100 }))
    const lanes = assignLanes(items, 0.08)
    for (const a of items) {
      for (const b of items) {
        if (a.id < b.id && lanes[a.id] === lanes[b.id]) {
          expect(Math.abs(a.position - b.position)).toBeGreaterThanOrEqual(0.08 - 1e-9)
        }
      }
    }
  })
})
