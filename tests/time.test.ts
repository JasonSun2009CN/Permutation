import { describe, expect, it } from 'vitest'
import { addMinutes, isZonedIso, normalizeZonedIso, toOffsetIso } from '@permutation/shared'

describe('time helpers', () => {
  it('rejects naive local timestamps', () => {
    expect(isZonedIso('2026-10-31T15:00:00')).toBe(false)
    expect(isZonedIso('2026-10-31T15:00')).toBe(false)
    expect(isZonedIso('tomorrow at 3')).toBe(false)
  })

  it('accepts timestamps with Z or an explicit offset', () => {
    expect(isZonedIso('2026-10-31T15:00:00+08:00')).toBe(true)
    expect(isZonedIso('2026-10-31T07:00:00Z')).toBe(true)
    expect(isZonedIso('2026-10-31T07:00:00.123Z')).toBe(true)
  })

  it('normalises to UTC', () => {
    expect(normalizeZonedIso('2026-10-31T15:00:00+08:00')).toBe('2026-10-31T07:00:00.000Z')
  })

  it('throws on a naive timestamp', () => {
    expect(() => normalizeZonedIso('2026-10-31T15:00:00')).toThrow(/timezone offset/i)
  })

  it('formats an instant with the offset of a timezone', () => {
    const instant = new Date('2026-10-31T07:00:00Z')
    expect(toOffsetIso(instant, 'Asia/Shanghai')).toBe('2026-10-31T15:00:00+08:00')
    expect(toOffsetIso(instant, 'UTC')).toBe('2026-10-31T07:00:00+00:00')
    expect(toOffsetIso(instant, 'America/New_York')).toBe('2026-10-31T03:00:00-04:00')
  })

  it('adds minutes without losing the instant', () => {
    expect(addMinutes('2026-10-31T07:00:00.000Z', 10)).toBe('2026-10-31T07:10:00.000Z')
  })
})
