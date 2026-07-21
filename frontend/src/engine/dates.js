/**
 * Date utilities for the Schengen engine.
 *
 * Every date in this app is an ISO `YYYY-MM-DD` string. `Date` objects exist
 * only inside this module. All parsing happens at UTC noon so that a local
 * timezone offset or a DST transition can never shift the calendar day.
 */

const MS_PER_DAY = 86400000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0))
}

export function toISO(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayISO() {
  const now = new Date()
  // Use the LOCAL calendar day — "today" is what the user's wall clock says.
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isValidISO(v) {
  if (typeof v !== 'string' || !ISO_RE.test(v)) return false
  // Reject dates that "roll over", e.g. 2026-02-30 → 2026-03-02.
  return toISO(parseISO(v)) === v
}

export function addDays(iso, n) {
  return toISO(new Date(parseISO(iso).getTime() + n * MS_PER_DAY))
}

export function diffDays(fromISO, toISODate) {
  return Math.round((parseISO(toISODate).getTime() - parseISO(fromISO).getTime()) / MS_PER_DAY)
}

/** Inclusive of BOTH ends — this is what makes a Schengen stay count correctly. */
export function eachDay(startISO, endISO) {
  const span = diffDays(startISO, endISO)
  if (span < 0) return []
  const out = new Array(span + 1)
  for (let i = 0; i <= span; i++) out[i] = addDays(startISO, i)
  return out
}

export function formatDisplay(iso) {
  if (!isValidISO(iso)) return '—'
  const [y, m, d] = iso.split('-')
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`
}

export function formatShort(iso) {
  if (!isValidISO(iso)) return '—'
  const [, m, d] = iso.split('-')
  return `${d} ${MONTHS[Number(m) - 1]}`
}

export function formatMonth(iso) {
  if (!isValidISO(iso)) return '—'
  const [y, m] = iso.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

/** Numeric x-axis value for charts: whole days since the Unix epoch. */
export function epochDay(iso) {
  return Math.floor(parseISO(iso).getTime() / MS_PER_DAY)
}

export function fromEpochDay(n) {
  return toISO(new Date(n * MS_PER_DAY))
}
