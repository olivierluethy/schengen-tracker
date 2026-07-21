import { useMemo } from 'react'
import { stayDuration } from '../../engine/schengen.js'

export const SORTS = {
  recent: { label: 'Newest first', compare: (a, b) => cmp(b.startDate, a.startDate) },
  oldest: { label: 'Oldest first', compare: (a, b) => cmp(a.startDate, b.startDate) },
  longest: { label: 'Longest first', compare: (a, b) => stayDuration(b) - stayDuration(a) },
  shortest: { label: 'Shortest first', compare: (a, b) => stayDuration(a) - stayDuration(b) },
  name: { label: 'Name A–Z', compare: (a, b) => a.name.localeCompare(b.name) },
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Search, sort and grouping for the stays list.
 *
 * Returns a FLAT item list — headers and rows interleaved — because that is
 * what the windowing renderer consumes. Grouping and virtualisation therefore
 * cost the same whether or not either is switched on.
 *
 * This never touches the array handed to the chart: how the list is ordered is
 * a reading preference, not a change to the data.
 */
export function useStayView(stays, { query, sort, grouped, collapsed }) {
  return useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q
      ? stays.filter((s) =>
        s.name.toLowerCase().includes(q) || (s.country || '').toLowerCase().includes(q))
      : stays

    const sorted = matched.slice().sort(SORTS[sort]?.compare || SORTS.recent.compare)

    if (!grouped) {
      return {
        items: sorted.map((s) => ({ type: 'row', key: s.id, stay: s })),
        total: matched.length,
        filtered: stays.length - matched.length,
      }
    }

    // Years appear in the order the sort produced them, so "oldest first"
    // really does start at the oldest year.
    const order = []
    const buckets = new Map()
    for (const s of sorted) {
      const year = s.startDate.slice(0, 4)
      if (!buckets.has(year)) { buckets.set(year, []); order.push(year) }
      buckets.get(year).push(s)
    }

    const items = []
    for (const year of order) {
      const rows = buckets.get(year)
      const isCollapsed = collapsed.has(year)
      items.push({
        type: 'header',
        key: `y-${year}`,
        year,
        count: rows.length,
        days: rows.reduce((n, s) => n + stayDuration(s), 0),
        collapsed: isCollapsed,
      })
      if (!isCollapsed) {
        for (const s of rows) items.push({ type: 'row', key: s.id, stay: s })
      }
    }

    return { items, total: matched.length, filtered: stays.length - matched.length }
  }, [stays, query, sort, grouped, collapsed])
}
