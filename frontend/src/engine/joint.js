/**
 * Two-person planning: does a proposed trip fit, and when are we BOTH free?
 *
 * The joint scan works from usage CURVES, not from stay records — that is what
 * makes it privacy-safe. A `graph_only` partner payload carries only
 * {date, used, remaining}, and this module needs nothing more.
 */
import { addDays, diffDays, eachDay } from './dates.js'
import { buildPresence, LIMIT_DAYS, WINDOW_DAYS } from './schengen.js'

/**
 * Check a proposed trip against one person's OWN stays (full detail available).
 * Scans through `endDate + 179` because the added days keep counting — and
 * other trips keep arriving — for the rest of the window.
 */
export function feasibility(stays, { startDate, endDate }) {
  const presence = buildPresence(stays)
  for (const day of eachDay(startDate, endDate)) presence.set(day, '__proposed__')

  let peakUsed = 0
  let breachDate = null
  const scanTo = addDays(endDate, WINDOW_DAYS - 1)

  for (const day of eachDay(startDate, scanTo)) {
    const windowStart = addDays(day, -(WINDOW_DAYS - 1))
    let used = 0
    for (const d of presence.keys()) {
      if (d >= windowStart && d <= day) used++
    }
    if (used > peakUsed) peakUsed = used
    if (used > LIMIT_DAYS && breachDate === null) breachDate = day
  }

  return { ok: breachDate === null, breachDate, peakUsed }
}

/**
 * Start days from which an L-day trip keeps this person within 90.
 *
 * Conservative: every proposed day is treated as a NEW day of presence. If the
 * person is already in Schengen on one of them, real usage is lower — so this
 * can under-report availability, never over-report it.
 */
export function curveFeasibleStarts(curve, minLength) {
  const byDate = new Map(curve.map((p) => [p.date, p.used]))
  const starts = new Set()

  for (let i = 0; i < curve.length; i++) {
    const start = curve[i].date
    let ok = true
    for (let k = 0; k < minLength; k++) {
      const day = addDays(start, k)
      const used = byDate.get(day)
      // Unknown day = beyond the shared horizon; refuse rather than guess.
      if (used === undefined || used + (k + 1) > LIMIT_DAYS) { ok = false; break }
    }
    if (ok) starts.add(start)
  }
  return starts
}

/**
 * Date ranges where BOTH partners can take a trip of at least `minLength` days.
 * Consecutive feasible starts are merged into one window.
 */
export function jointWindows({ curveA, curveB, minLength = 7, horizonDays = 365 }) {
  const length = Math.max(1, Number(minLength) || 1)
  const limitDate = curveA.length ? addDays(curveA[0].date, horizonDays) : null

  const a = curveFeasibleStarts(curveA, length)
  const b = curveFeasibleStarts(curveB, length)

  const shared = curveA
    .map((p) => p.date)
    .filter((d) => a.has(d) && b.has(d) && (!limitDate || d <= limitDate))
    .sort()

  const windows = []
  let runStart = null
  let prev = null

  for (const d of shared) {
    if (runStart === null) { runStart = d; prev = d; continue }
    if (diffDays(prev, d) === 1) { prev = d; continue }
    windows.push(closeWindow(runStart, prev, length))
    runStart = d
    prev = d
  }
  if (runStart !== null) windows.push(closeWindow(runStart, prev, length))

  return windows
}

function closeWindow(firstStart, lastStart, length) {
  // The last usable day is the final feasible start plus the trip length.
  const to = addDays(lastStart, length - 1)
  return { from: firstStart, to, length: diffDays(firstStart, to) + 1 }
}
