// Small deterministic RNG so puzzles are reproducible from a seed string.

export type Rng = () => number

/** FNV-1a string hash -> unsigned 32-bit integer. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** mulberry32 seeded from a string; returns floats in [0, 1). */
export function createRng(seed: string): Rng {
  let state = hashString(seed)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function randomInt(rng: Rng, maxExclusive: number): number {
  return Math.floor(rng() * maxExclusive)
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  return items[randomInt(rng, items.length)]
}

/** Fisher-Yates; returns a new array. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = items.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** One item, chosen with probability proportional to its weight. */
export function pickWeighted<T>(rng: Rng, items: readonly T[], weightOf: (item: T) => number): T {
  const weights = items.map((item) => Math.max(0, weightOf(item)))
  let roll = rng() * weights.reduce((sum, weight) => sum + weight, 0)
  for (let i = 0; i < items.length; i++) {
    if (roll < weights[i]) return items[i]
    roll -= weights[i]
  }
  return items[items.length - 1]
}

/** Random order where heavier items tend to come first (weighted sampling without replacement). */
export function shuffleWeighted<T>(rng: Rng, items: readonly T[], weightOf: (item: T) => number): T[] {
  return items
    .map((item) => ({ item, key: rng() ** (1 / Math.max(weightOf(item), 1e-9)) }))
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item)
}
