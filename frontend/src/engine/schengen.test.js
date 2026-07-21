import { describe, it, expect } from 'vitest'
import {
  WINDOW_DAYS, LIMIT_DAYS,
  stayDuration, buildPresence, usageOn, contributionsOn,
  remainingOn, statusOf, buildSeries, graphRange,
} from './schengen.js'

const stay = (id, name, startDate, endDate) => ({
  id, name, country: null, startDate, endDate,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deleted: false, ownerId: null,
})

describe('constants', () => {
  it('encodes the 90/180 rule', () => {
    expect(WINDOW_DAYS).toBe(180)
    expect(LIMIT_DAYS).toBe(90)
  })
})

describe('stayDuration', () => {
  it('counts both entry and exit days', () => {
    expect(stayDuration(stay('a', 'Barcelona', '2026-07-23', '2026-07-30'))).toBe(8)
  })
  it('counts a same-day trip as one day', () => {
    expect(stayDuration(stay('a', 'Transit', '2026-07-23', '2026-07-23'))).toBe(1)
  })
})

describe('usageOn', () => {
  it('counts every day of a stay that falls inside the window', () => {
    const p = buildPresence([stay('a', 'Barcelona', '2026-07-23', '2026-07-30')])
    expect(usageOn(p, '2026-07-30')).toBe(8)
  })

  it('includes a day exactly 179 days before the reference date', () => {
    // Window is [D-179, D] inclusive — 180 days wide.
    // 2026-01-23 is exactly 179 days before 2026-07-21, so it still counts.
    const p = buildPresence([stay('a', 'Edge', '2026-01-23', '2026-01-23')])
    expect(usageOn(p, '2026-07-21')).toBe(1)
  })

  it('excludes a day exactly 180 days before the reference date', () => {
    // One day later the same stay has dropped out of the window.
    const p = buildPresence([stay('a', 'Edge', '2026-01-23', '2026-01-23')])
    expect(usageOn(p, '2026-07-22')).toBe(0)
  })

  it('ignores future days relative to the reference date', () => {
    const p = buildPresence([stay('a', 'Later', '2026-08-01', '2026-08-10')])
    expect(usageOn(p, '2026-07-21')).toBe(0)
  })

  it('ignores deleted stays', () => {
    const gone = { ...stay('a', 'Gone', '2026-07-01', '2026-07-10'), deleted: true }
    expect(usageOn(buildPresence([gone]), '2026-07-10')).toBe(0)
  })

  it('does not double-count overlapping stays', () => {
    const p = buildPresence([
      stay('a', 'Paris', '2026-07-01', '2026-07-10'),
      stay('b', 'Lyon', '2026-07-05', '2026-07-15'),
    ])
    // Union is 1–15 July = 15 days, not 10 + 11 = 21.
    expect(usageOn(p, '2026-07-15')).toBe(15)
  })
})

describe('contributionsOn', () => {
  it('splits the total across stays', () => {
    const stays = [
      stay('a', 'Lisbon', '2026-07-01', '2026-07-05'),   // 5 days
      stay('b', 'Paris', '2026-07-10', '2026-07-14'),    // 5 days
    ]
    const c = contributionsOn(buildPresence(stays), '2026-07-20')
    expect(c.a).toBe(5)
    expect(c.b).toBe(5)
  })

  it('attributes a shared day to the earlier-starting stay', () => {
    const stays = [
      stay('a', 'Paris', '2026-07-01', '2026-07-10'),  // owns 1–10
      stay('b', 'Lyon', '2026-07-05', '2026-07-15'),   // owns 11–15 only
    ]
    const c = contributionsOn(buildPresence(stays), '2026-07-15')
    expect(c.a).toBe(10)
    expect(c.b).toBe(5)
    expect(c.a + c.b).toBe(usageOn(buildPresence(stays), '2026-07-15'))
  })
})

describe('statusOf / remainingOn', () => {
  it('applies the thresholds at their exact boundaries', () => {
    expect(statusOf(0)).toBe('compliant')
    expect(statusOf(75)).toBe('compliant')
    expect(statusOf(76)).toBe('warning')
    expect(statusOf(90)).toBe('warning')
    expect(statusOf(91)).toBe('over')
  })
  it('never reports negative remaining days', () => {
    expect(remainingOn(40)).toBe(50)
    expect(remainingOn(90)).toBe(0)
    expect(remainingOn(100)).toBe(0)
  })
})

describe('buildSeries', () => {
  const stays = [
    stay('a', 'Lisbon', '2026-03-01', '2026-03-10'),
    stay('b', 'Paris', '2026-05-01', '2026-05-20'),
  ]

  it('emits one point per day, inclusive', () => {
    const { points } = buildSeries(stays, '2026-05-01', '2026-05-10')
    expect(points).toHaveLength(10)
    expect(points[0].date).toBe('2026-05-01')
    expect(points[9].date).toBe('2026-05-10')
  })

  it('per-stay bands sum exactly to the total on every point', () => {
    const { points, stayIds } = buildSeries(stays, '2026-02-01', '2026-08-01')
    for (const p of points) {
      const sum = stayIds.reduce((acc, id) => acc + (p[`s_${id}`] || 0), 0)
      expect(sum).toBe(p.total)
    }
  })

  it('exposes remaining alongside total', () => {
    const { points } = buildSeries(stays, '2026-05-20', '2026-05-20')
    expect(points[0].remaining).toBe(90 - points[0].total)
  })

  it('honours the sampling step but always includes the last day', () => {
    const { points } = buildSeries(stays, '2026-05-01', '2026-05-10', 3)
    expect(points.map((p) => p.date)).toEqual([
      '2026-05-01', '2026-05-04', '2026-05-07', '2026-05-10',
    ])
  })

  it('returns an empty series when there are no stays', () => {
    const { points, stayIds } = buildSeries([], '2026-05-01', '2026-05-03')
    expect(stayIds).toEqual([])
    expect(points.every((p) => p.total === 0)).toBe(true)
  })
})

describe('graphRange', () => {
  it('runs from the earliest stay to today + 180 days', () => {
    const r = graphRange(
      [stay('a', 'Old', '2026-01-10', '2026-01-20')],
      '2026-07-21',
    )
    expect(r.from).toBe('2026-01-10')
    expect(r.to).toBe('2027-01-17') // 2026-07-21 + 180
  })

  it('falls back to today − 180 when there are no stays', () => {
    const r = graphRange([], '2026-07-21')
    expect(r.from).toBe('2026-01-22')
    expect(r.to).toBe('2027-01-17')
  })
})
