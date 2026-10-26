const MS_PER_DAY = 86_400_000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** Local calendar date as YYYY-MM-DD (the daily puzzle rolls over at local midnight). */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayString(now: Date = new Date()): string {
  return toDateString(now)
}

function parseUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

export function shiftDate(date: string, days: number): string {
  return new Date(parseUtc(date).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10)
}

export function formatLongDate(date: string): string {
  return parseUtc(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatShortDate(date: string): string {
  return parseUtc(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function formatMonth(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** 0 = Sunday .. 6 = Saturday for a YYYY-MM-DD date. */
export function weekdayOf(date: string): number {
  return parseUtc(date).getUTCDay()
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

export function makeDate(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`
}
