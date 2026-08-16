import { describe, expect, it, vi } from 'vitest'
import { cmpSpotNumber, fmtDT, fmtRange, fromPbDate, isPast, localNowOffset, toPbDate } from './format'

vi.mock('../i18n', () => ({ default: { language: 'en' } }))

describe('toPbDate', () => {
  it('appends seconds and converts to ISO', () => {
    const out = toPbDate('2026-08-16T10:30')
    expect(out).toBe(new Date('2026-08-16T10:30:00').toISOString())
  })
})

describe('fromPbDate', () => {
  it('parses PB space-separated datetimes', () => {
    const d = fromPbDate('2026-08-16 10:30:00.000Z')
    expect(d).not.toBeNull()
    expect(d!.toISOString()).toBe('2026-08-16T10:30:00.000Z')
  })

  it('returns null for empty or invalid input', () => {
    expect(fromPbDate('')).toBeNull()
    expect(fromPbDate(undefined)).toBeNull()
    expect(fromPbDate('not-a-date')).toBeNull()
  })
})

describe('fmtDT', () => {
  it('renders an em dash for invalid input', () => {
    expect(fmtDT(null)).toBe('—')
    expect(fmtDT('garbage')).toBe('—')
  })

  it('renders a human-readable date', () => {
    expect(fmtDT('2026-08-16 10:30:00.000Z')).not.toBe('—')
    expect(fmtDT('2026-08-16 10:30:00.000Z')).toContain('2026')
  })
})

describe('fmtRange', () => {
  it('joins from and to with an arrow', () => {
    expect(fmtRange('2026-08-16 10:00:00.000Z', '2026-08-16 12:00:00.000Z')).toContain('→')
  })
})

describe('isPast', () => {
  it('is true for past dates and false for future ones', () => {
    expect(isPast('2000-01-01 00:00:00.000Z')).toBe(true)
    expect(isPast('2999-01-01 00:00:00.000Z')).toBe(false)
    expect(isPast(null)).toBe(false)
    expect(isPast('nonsense')).toBe(false)
  })
})

describe('cmpSpotNumber', () => {
  it('compares numerically when possible', () => {
    expect(cmpSpotNumber('9', '10')).toBeLessThan(0)
    expect(cmpSpotNumber('B2', 'B10')).toBeLessThan(0)
    expect(cmpSpotNumber('5', '5')).toBe(0)
  })

  it('falls back to string comparison', () => {
    expect(cmpSpotNumber('A', 'B')).toBeLessThan(0)
  })
})

describe('localNowOffset', () => {
  it('produces a datetime-local format', () => {
    expect(localNowOffset(0)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(localNowOffset(2)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})
