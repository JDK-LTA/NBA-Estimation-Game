export interface LaneItem {
  id: string
  /** Horizontal position as a fraction (0-1) of the track width. */
  position: number
}

/**
 * Stacks markers into rows so neighbours closer than `minGap` (a fraction of
 * the track width) never overlap. Returns a lane index (0 = closest row).
 */
export function assignLanes(items: readonly LaneItem[], minGap: number): Record<string, number> {
  const lanes: Record<string, number> = {}
  const lastInLane: number[] = []

  for (const item of [...items].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))) {
    let lane = lastInLane.findIndex((last) => item.position - last >= minGap)
    if (lane === -1) lane = lastInLane.length
    lastInLane[lane] = item.position
    lanes[item.id] = lane
  }
  return lanes
}

export function laneCount(lanes: Record<string, number>): number {
  const values = Object.values(lanes)
  return values.length === 0 ? 0 : Math.max(...values) + 1
}
