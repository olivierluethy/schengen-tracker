import { describe, expect, it } from 'vitest'
import { STAY_STATUS, stayStatus } from './stayStatus.js'

const stay = (startDate, endDate) => ({ startDate, endDate })

describe('stayStatus', () => {
  const today = '2026-07-21'

  it('calls a stay that has not started upcoming', () => {
    expect(stayStatus(stay('2026-07-22', '2026-07-30'), today)).toBe('upcoming')
  })

  it('calls a stay that has ended past', () => {
    expect(stayStatus(stay('2026-06-01', '2026-07-20'), today)).toBe('past')
  })

  it('calls a stay around today now', () => {
    expect(stayStatus(stay('2026-07-01', '2026-08-01'), today)).toBe('now')
  })

  it('treats both ends as inclusive', () => {
    expect(stayStatus(stay(today, '2026-08-01'), today)).toBe('now')
    expect(stayStatus(stay('2026-06-01', today), today)).toBe('now')
  })

  it('handles a single-day stay', () => {
    expect(stayStatus(stay(today, today), today)).toBe('now')
  })

  it('flips as the day passes', () => {
    const s = stay('2026-07-22', '2026-07-23')
    expect(stayStatus(s, '2026-07-21')).toBe('upcoming')
    expect(stayStatus(s, '2026-07-22')).toBe('now')
    expect(stayStatus(s, '2026-07-23')).toBe('now')
    expect(stayStatus(s, '2026-07-24')).toBe('past')
  })

  it('has a label for every state', () => {
    for (const key of ['upcoming', 'now', 'past']) {
      expect(STAY_STATUS[key].label).toBeTruthy()
    }
  })
})
