import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StayRow, { ROW_BODY, ROW_GAP, ROW_PANEL } from './StayRow.jsx'
import VirtualList from './VirtualList.jsx'
import { SORTS, useStayView } from './useStayView.js'
import { todayISO } from '../../engine/dates.js'

const HEADER_H = 44
const VIRTUALISE_FROM = 30

/**
 * The stays list.
 *
 * Sorting, searching and grouping are reading aids only — the array the chart
 * receives is untouched, so re-sorting the list can never restack the bands or
 * recolour a trip.
 */
export default function StayList({
  stays, colors, highlightedId, onHighlight, onEdit, onDelete,
}) {
  const [expandedId, setExpandedId] = useState(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')
  const [grouped, setGrouped] = useState(false)
  const [collapsed, setCollapsed] = useState(() => new Set())

  // Read once per render so every row in a list dates itself from the same day.
  const today = todayISO()
  const { items, total } = useStayView(stays, { query, sort, grouped, collapsed })
  const showTools = stays.length >= 5
  const virtual = items.length > VIRTUALISE_FROM

  const toggle = (id, source) => {
    if (source === 'hover') return onHighlight(id)
    setExpandedId((cur) => (cur === id ? null : id))
    onHighlight(id)
  }

  const toggleYear = (year) => setCollapsed((cur) => {
    const next = new Set(cur)
    if (next.has(year)) next.delete(year)
    else next.add(year)
    return next
  })

  const heightOf = (item) =>
    item.type === 'header'
      ? HEADER_H
      : ROW_BODY + ROW_GAP + (expandedId === item.stay.id ? ROW_PANEL : 0)

  const renderItem = (item) => {
    if (item.type === 'header') {
      return (
        <button
          type="button"
          onClick={() => toggleYear(item.year)}
          className="w-full flex items-center gap-3 px-1 text-left"
          style={{ height: HEADER_H }}
          aria-expanded={!item.collapsed}
        >
          <span className={`text-fog-700 text-xs transition-transform duration-150 ${
            item.collapsed ? '' : 'rotate-90'}`}>›</span>
          <span className="num text-sm text-fog-100">{item.year}</span>
          <span className="rule flex-1" />
          <span className="num text-[11px] text-fog-700 shrink-0">
            {item.count} {item.count === 1 ? 'stay' : 'stays'} · {item.days}d
          </span>
        </button>
      )
    }
    return (
      <div style={{ paddingBottom: ROW_GAP }}>
        <StayRow
          stay={item.stay}
          color={colors[item.stay.id]}
          expanded={expandedId === item.stay.id}
          highlighted={highlightedId === item.stay.id}
          today={today}
          onToggle={toggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    )
  }

  return (
    <section>
      <div className="flex items-center gap-3 px-1 mb-2.5">
        <h2 className="stamp stamp-rule">Your stays</h2>
        <span className="num text-[11px] text-fog-800">{total}</span>
      </div>

      {showTools && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[9rem]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="Filter by name or country"
              aria-label="Filter stays"
              className="field !py-2 !px-3 text-sm"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort stays"
            className="select !py-2"
          >
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setGrouped((g) => !g)}
            aria-pressed={grouped}
            className={`btn !px-3 !py-2 text-xs border ${
              grouped
                ? 'border-accent/50 bg-accent/10 text-accent-soft'
                : 'border-ink-700 bg-ink-850 text-fog-500 hover:text-fog-100'}`}
          >
            By year
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="well px-4 py-6 text-center">
          <p className="text-sm text-fog-500">No stay matches “{query}”.</p>
          <button type="button" onClick={() => setQuery('')} className="btn-ghost mt-2 text-xs">
            Clear the filter
          </button>
        </div>
      ) : virtual ? (
        <VirtualList
          items={items}
          getHeight={heightOf}
          renderItem={renderItem}
          focusKey={highlightedId}
          className="max-h-[min(70vh,44rem)] pr-1 -mr-1"
        />
      ) : (
        <div onMouseLeave={() => onHighlight(null)}>
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <motion.div
                key={item.key}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                {renderItem(item)}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  )
}
