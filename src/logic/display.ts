const SUFFIXES = new Set(['jr.', 'sr.', 'ii', 'iii', 'iv'])

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter((part) => !SUFFIXES.has(part.toLowerCase()))
  if (parts.length === 0 || parts[0] === '') return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase()
}

/** One distinct marker color per middle player, reused cyclically beyond 8. */
export const PLAYER_COLORS = [
  '#e8590c',
  '#1c7ed6',
  '#2f9e44',
  '#ae3ec9',
  '#f08c00',
  '#0ca678',
  '#d6336c',
  '#4263eb',
] as const
