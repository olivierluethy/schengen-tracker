import { todayISO } from '../../engine/dates.js'

/**
 * Where a stay sits relative to today — a reading aid, not a compliance verdict.
 *
 * Both ends are inclusive: the day you arrive and the day you leave are days
 * you are there. Dates are ISO `YYYY-MM-DD`, which sorts lexicographically, so
 * comparing the strings is the same comparison as comparing the calendar days
 * and costs no Date parsing per row.
 *
 * `todayISO()` is the device's local calendar day, so a stay moves from
 * upcoming to now to past on its own as the clock passes midnight.
 */
export function stayStatus(stay, today = todayISO()) {
  if (stay.startDate > today) return 'upcoming'
  if (stay.endDate < today) return 'past'
  return 'now'
}

/**
 * Three states, three registers: ahead of you, around you, behind you.
 * Only the live one carries a dot — the pill you should notice first.
 */
export const STAY_STATUS = {
  upcoming: { label: 'Upcoming', className: 'border-accent/35 bg-accent/10 text-accent-soft' },
  now: { label: 'Now', className: 'border-ok/35 bg-ok/10 text-ok', dot: 'bg-ok' },
  past: { label: 'Past', className: 'border-ink-700 bg-ink-850 text-fog-700' },
}
