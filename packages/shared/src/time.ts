const ZONED_ISO_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/

/**
 * A timestamp is only accepted when it carries an explicit offset (or Z).
 * This is the guard that keeps naive local strings out of the database.
 */
export function isZonedIso(value: unknown): value is string {
  if (typeof value !== 'string' || !ZONED_ISO_PATTERN.test(value)) return false
  return !Number.isNaN(Date.parse(value))
}

export function normalizeZonedIso(value: string): string {
  if (!isZonedIso(value)) {
    throw new Error(`Expected an ISO 8601 timestamp with a timezone offset, received: ${value}`)
  }
  return new Date(value).toISOString()
}

export function nowIso(now: Date = new Date()): string {
  return now.toISOString()
}

export function systemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export function systemLocale(): string {
  return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US'
}

/**
 * Formats an instant as an ISO 8601 string carrying the explicit offset of the
 * supplied IANA timezone, e.g. 2026-10-31T15:00:00+08:00.
 */
export function toOffsetIso(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '00'

  const offsetName =
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+00:00'
  const rawOffset = offsetName.replace('GMT', '').trim()
  const match = /^([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(rawOffset)
  const offset = match ? `${match[1]}${match[2]?.padStart(2, '0')}:${match[3] ?? '00'}` : '+00:00'

  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick(
    'minute',
  )}:${pick('second')}${offset}`
}

export function isSameLocalDay(a: string, b: string | Date): boolean {
  const left = new Date(a)
  const right = typeof b === 'string' ? new Date(b) : b
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export function startOfLocalDay(date: Date = new Date()): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

export function endOfLocalDay(date: Date = new Date()): Date {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

export function minutesUntil(iso: string, now: Date = new Date()): number {
  return Math.round((new Date(iso).getTime() - now.getTime()) / 60_000)
}

export function formatClockTime(iso: string, locale = systemLocale()): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string, locale = systemLocale()): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatWeekday(date: Date = new Date(), locale = systemLocale()): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date)
}
