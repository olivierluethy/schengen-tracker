/**
 * The Schengen 90/180 rule.
 *
 * For a reference date D, count days of presence inside the INCLUSIVE window
 * [D - 179, D] — 180 calendar days wide. Both the entry and the exit day of a
 * stay count as days of presence. The limit is 90 days.
 *
 * Everything here is pure: no React, no Dexie, no browser APIs. That is what
 * lets the graph, the PDF renderer and the partner joint-scan all share it.
 */
import { addDays, diffDays, eachDay, epochDay, todayISO } from './dates.js'

export const WINDOW_DAYS = 180
export const LIMIT_DAYS = 90
export const WARNING_FROM = 76

/** Inclusive of both entry and exit days: 23 Jul → 30 Jul is 8 days. */
export function stayDuration(stay) {
  return Math.max(0, diffDays(stay.startDate, stay.endDate) + 1)
}

const activeStays = (stays) => (stays || []).filter((s) => s && !s.deleted)

/**
 * Map every day of presence to exactly ONE owning stay.
 *
 * A day covered by two stays is one day of presence, not two. The earlier
 * `startDate` claims the shared day (ties broken by id, so the result is
 * deterministic). This is what makes the stacked graph bands sum exactly to
 * the rolling total instead of overshooting it.
 */
export function buildPresence(stays) {
  const ordered = activeStays(stays).slice().sort((a, b) =>
    a.startDate === b.startDate ? (a.id < b.id ? -1 : 1) : a.startDate < b.startDate ? -1 : 1,
  )
  const presence = new Map()
  for (const s of ordered) {
    for (const day of eachDay(s.startDate, s.endDate)) {
      if (!presence.has(day)) presence.set(day, s.id)
    }
  }
  return presence
}

export function usageOn(presence, refISO) {
  const start = addDays(refISO, -(WINDOW_DAYS - 1))
  let used = 0
  for (const day of presence.keys()) {
    if (day >= start && day <= refISO) used++
  }
  return used
}

export function contributionsOn(presence, refISO) {
  const start = addDays(refISO, -(WINDOW_DAYS - 1))
  const out = {}
  for (const [day, stayId] of presence) {
    if (day >= start && day <= refISO) out[stayId] = (out[stayId] || 0) + 1
  }
  return out
}

export function remainingOn(used) {
  return Math.max(0, LIMIT_DAYS - used)
}

export function statusOf(used) {
  if (used > LIMIT_DAYS) return 'over'
  if (used >= WARNING_FROM) return 'warning'
  return 'compliant'
}

/**
 * The rolling series, decomposed per stay.
 *
 * Uses a sliding window over a sorted day list so the cost is O(days) rather
 * than O(days x window). Each point carries `s_<stayId>` keys — Recharts
 * dataKeys must be flat strings, and the `s_` prefix keeps them from colliding
 * with `date`, `total`, `remaining` or `t`.
 *
 * @param {number} step Emit every Nth day (the last day is always emitted).
 */
export function buildSeries(stays, fromISO, toISO, step = 1) {
  const active = activeStays(stays)
  const stayIds = active.map((s) => s.id)
  const presence = buildPresence(active)

  const sortedDays = Array.from(presence.keys()).sort()
  const points = []
  const counts = new Map() // stayId -> days currently inside the window
  let head = 0             // next day to enter the window
  let tail = 0             // next day to leave the window
  let total = 0

  const span = diffDays(fromISO, toISO)
  for (let i = 0; i <= span; i++) {
    const date = addDays(fromISO, i)
    const windowStart = addDays(date, -(WINDOW_DAYS - 1))

    while (head < sortedDays.length && sortedDays[head] <= date) {
      const id = presence.get(sortedDays[head])
      counts.set(id, (counts.get(id) || 0) + 1)
      total++
      head++
    }
    while (tail < head && sortedDays[tail] < windowStart) {
      const id = presence.get(sortedDays[tail])
      counts.set(id, counts.get(id) - 1)
      total--
      tail++
    }

    const isLast = i === span
    if (i % step !== 0 && !isLast) continue

    const point = {
      t: epochDay(date),
      date,
      total,
      remaining: remainingOn(total),
    }
    for (const id of stayIds) point[`s_${id}`] = counts.get(id) || 0
    points.push(point)
  }

  return { points, stayIds }
}

/** Earliest stay (or today − 180) through today + 180, per the spec. */
export function graphRange(stays, today = todayISO()) {
  const active = activeStays(stays)
  const earliest = active.reduce(
    (min, s) => (min === null || s.startDate < min ? s.startDate : min),
    null,
  )
  return {
    from: earliest || addDays(today, -WINDOW_DAYS),
    to: addDays(today, WINDOW_DAYS),
  }
}
