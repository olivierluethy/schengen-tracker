import { describe, it, expect } from 'vitest'
import {
  parseISO, toISO, addDays, diffDays, eachDay,
  formatDisplay, formatShort, formatMonth, isValidISO,
  epochDay, fromEpochDay,
} from './dates.js'

describe('parseISO / toISO', () => {
  it('round-trips an ISO date', () => {
    expect(toISO(parseISO('2026-11-27'))).toBe('2026-11-27')
  })

  it('survives a DST boundary (Europe switches on 2026-03-29)', () => {
    // Parsing at UTC noon means a local-midnight shift can never roll the date.
    expect(toISO(parseISO('2026-03-29'))).toBe('2026-03-29')
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
  })
})

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })
  it('crosses a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
  it('goes backwards', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('spans the 180-day window', () => {
    expect(addDays('2026-07-21', -179)).toBe('2026-01-23')
  })
})

describe('diffDays', () => {
  it('is signed and exclusive of the start', () => {
    expect(diffDays('2026-07-23', '2026-07-30')).toBe(7)
    expect(diffDays('2026-07-30', '2026-07-23')).toBe(-7)
    expect(diffDays('2026-07-23', '2026-07-23')).toBe(0)
  })
})

describe('eachDay', () => {
  it('is inclusive of both ends', () => {
    const days = eachDay('2026-07-23', '2026-07-30')
    expect(days).toHaveLength(8)
    expect(days[0]).toBe('2026-07-23')
    expect(days[7]).toBe('2026-07-30')
  })
  it('returns a single day when start equals end', () => {
    expect(eachDay('2026-07-23', '2026-07-23')).toEqual(['2026-07-23'])
  })
  it('returns empty when end precedes start', () => {
    expect(eachDay('2026-07-30', '2026-07-23')).toEqual([])
  })
})

describe('formatting', () => {
  it('renders DD MMM YYYY', () => {
    expect(formatDisplay('2026-11-27')).toBe('27 Nov 2026')
  })
  it('pads single-digit days', () => {
    expect(formatDisplay('2026-01-05')).toBe('05 Jan 2026')
  })
  it('renders short and month forms', () => {
    expect(formatShort('2026-11-27')).toBe('27 Nov')
    expect(formatMonth('2026-11-27')).toBe('Nov 2026')
  })
  it('never returns an empty string for a valid date', () => {
    expect(formatDisplay('2026-11-27')).not.toBe('')
  })
  it('returns an em dash for missing input rather than throwing', () => {
    expect(formatDisplay(null)).toBe('—')
    expect(formatDisplay('')).toBe('—')
  })
})

describe('isValidISO', () => {
  it('accepts real dates and rejects everything else', () => {
    expect(isValidISO('2026-11-27')).toBe(true)
    expect(isValidISO('2026-02-30')).toBe(false)
    expect(isValidISO('27-11-2026')).toBe(false)
    expect(isValidISO(null)).toBe(false)
    expect(isValidISO(20261127)).toBe(false)
  })
})

describe('epochDay', () => {
  it('round-trips', () => {
    expect(fromEpochDay(epochDay('2026-11-27'))).toBe('2026-11-27')
  })
  it('increments by one per day', () => {
    expect(epochDay('2026-11-28') - epochDay('2026-11-27')).toBe(1)
  })
})
