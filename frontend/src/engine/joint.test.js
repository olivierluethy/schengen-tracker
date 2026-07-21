import { describe, it, expect } from 'vitest'
import { feasibility, curveFeasibleStarts, jointWindows } from './joint.js'
import { addDays } from './dates.js'

const stay = (id, startDate, endDate) => ({
  id, name: id, country: null, startDate, endDate,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  deleted: false, ownerId: null,
})

/** A flat curve of `n` days, all with the same usage. */
const flatCurve = (from, days, used) =>
  Array.from({ length: days }, (_, i) => ({
    date: addDays(from, i), used, remaining: Math.max(0, 90 - used),
  }))

describe('feasibility', () => {
  it('accepts a short trip when there is plenty of room', () => {
    const r = feasibility([stay('a', '2026-01-01', '2026-01-10')], {
      startDate: '2026-06-01', endDate: '2026-06-10',
    })
    expect(r.ok).toBe(true)
    expect(r.breachDate).toBe(null)
  })

  it('flags the exact day the 90-day limit is crossed', () => {
    // 85 days used immediately before the proposed trip.
    const r = feasibility([stay('a', '2026-01-01', '2026-03-26')], {
      startDate: '2026-03-27', endDate: '2026-04-10',
    })
    expect(r.ok).toBe(false)
    expect(r.breachDate).toBe('2026-04-01') // the 91st day of presence
  })

  it('counts the proposed trip inclusively', () => {
    // Exactly 90 days total: 82 existing + an 8-day trip.
    const r = feasibility([stay('a', '2026-01-01', '2026-03-23')], {
      startDate: '2026-03-24', endDate: '2026-03-31',
    })
    expect(r.peakUsed).toBe(90)
    expect(r.ok).toBe(true)
  })
})

describe('curveFeasibleStarts', () => {
  it('accepts every start when the curve is empty', () => {
    const starts = curveFeasibleStarts(flatCurve('2026-08-01', 30, 0), 7)
    expect(starts.has('2026-08-01')).toBe(true)
  })

  it('rejects starts that would breach mid-trip', () => {
    // 86 used: adding 5 days reaches 91 on the 5th day.
    const starts = curveFeasibleStarts(flatCurve('2026-08-01', 30, 86), 5)
    expect(starts.size).toBe(0)
  })

  it('accepts a trip that lands exactly on 90', () => {
    const starts = curveFeasibleStarts(flatCurve('2026-08-01', 30, 86), 4)
    expect(starts.has('2026-08-01')).toBe(true)
  })

  it('rejects starts too close to the end of the known curve', () => {
    const starts = curveFeasibleStarts(flatCurve('2026-08-01', 10, 0), 7)
    expect(starts.has('2026-08-05')).toBe(false) // would need data to 2026-08-11
  })
})

describe('jointWindows', () => {
  it('returns a merged window where both have room', () => {
    const w = jointWindows({
      curveA: flatCurve('2026-08-01', 60, 0),
      curveB: flatCurve('2026-08-01', 60, 0),
      minLength: 7,
    })
    expect(w).toHaveLength(1)
    expect(w[0].from).toBe('2026-08-01')
    expect(w[0].length).toBeGreaterThanOrEqual(7)
  })

  it('returns nothing when one partner is out of allowance', () => {
    const w = jointWindows({
      curveA: flatCurve('2026-08-01', 60, 0),
      curveB: flatCurve('2026-08-01', 60, 90),
      minLength: 7,
    })
    expect(w).toEqual([])
  })

  it('intersects the two partners rather than unioning them', () => {
    // A is free the whole time; B is only free in the second half.
    const curveB = [
      ...flatCurve('2026-08-01', 30, 90),
      ...flatCurve('2026-08-31', 30, 0),
    ]
    const w = jointWindows({
      curveA: flatCurve('2026-08-01', 60, 0),
      curveB,
      minLength: 7,
    })
    expect(w).toHaveLength(1)
    expect(w[0].from >= '2026-08-31').toBe(true)
  })

  it('honours the minimum trip length', () => {
    // Only a 3-day gap of headroom exists, so a 7-day request finds nothing.
    const curve = [
      ...flatCurve('2026-08-01', 10, 90),
      ...flatCurve('2026-08-11', 3, 80),
      ...flatCurve('2026-08-14', 10, 90),
    ]
    expect(jointWindows({ curveA: curve, curveB: curve, minLength: 7 })).toEqual([])
    expect(jointWindows({ curveA: curve, curveB: curve, minLength: 3 }).length).toBeGreaterThan(0)
  })
})
