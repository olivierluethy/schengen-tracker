import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { buildSeries, graphRange, stayDuration } from '../../engine/schengen.js'
import { formatDisplay, formatShort, todayISO } from '../../engine/dates.js'
import ChartCanvas from './ChartCanvas.jsx'

const MIN_POINTS = 24

/**
 * The chart at full size, with a zoomable and pannable time axis.
 *
 * Zoom and pan are expressed as a window over the point array and driven by the
 * overview strip at the bottom, so the strip is always an honest picture of
 * where you are in the whole history. Every figure is recomputed from the same
 * engine the card uses — this view shows more of the data, never different data.
 */
export default function ExpandedChart({ open, onClose, stays, colors, highlightedId, onHighlight }) {
  const today = todayISO()
  const [view, setView] = useState(null)

  const { points, range } = useMemo(() => {
    const r = graphRange(stays, today)
    return { points: buildSeries(stays, r.from, r.to, 1).points, range: r }
  }, [stays, today])

  const last = Math.max(0, points.length - 1)

  const clampWindow = useCallback((start, end) => {
    let s = Math.round(start)
    let e = Math.round(end)
    if (e - s < MIN_POINTS) e = s + MIN_POINTS
    if (s < 0) { e -= s; s = 0 }
    if (e > last) { s -= e - last; e = last }
    return { start: Math.max(0, s), end: Math.min(last, e) }
  }, [last])

  const zoom = useCallback((factor) => {
    setView((w) => {
      const cur = w || { start: 0, end: last }
      const mid = (cur.start + cur.end) / 2
      const half = ((cur.end - cur.start) * factor) / 2
      return clampWindow(mid - half, mid + half)
    })
  }, [clampWindow, last])

  const fitAll = useCallback(() => setView({ start: 0, end: last }), [last])

  useEffect(() => { if (open) fitAll() }, [open, fitAll])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === '+' || e.key === '=') zoom(0.6)
      else if (e.key === '-' || e.key === '_') zoom(1 / 0.6)
      else if (e.key === '0') fitAll()
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose, zoom, fitAll])

  const win = view || { start: 0, end: last }

  function jumpTo(stay) {
    const from = points.findIndex((p) => p.date >= stay.startDate)
    if (from < 0) return
    const toIdx = points.findIndex((p) => p.date >= stay.endDate)
    const to = toIdx < 0 ? last : toIdx
    const pad = Math.max(21, Math.round((to - from) * 0.6))
    setView(clampWindow(from - pad, to + pad))
    onHighlight(stay.id)
  }

  const visibleFrom = points[win.start]?.date || range.from
  const visibleTo = points[win.end]?.date || range.to
  const spanDays = win.end - win.start + 1

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-ink-950 flex flex-col"
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label="Full chart"
        >
          <header className="safe-t border-b border-ink-800 px-4 sm:px-6">
            <div className="h-14 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="heading text-base leading-none">Rolling window</h2>
                <p className="mt-1.5 num text-[11px] text-fog-700 truncate">
                  {formatDisplay(visibleFrom)} → {formatDisplay(visibleTo)} · {spanDays} days shown
                </p>
              </div>
              <button type="button" onClick={onClose} className="btn-quiet shrink-0">Close</button>
            </div>
          </header>

          <div className="px-4 sm:px-6 py-2.5 flex items-center gap-2 border-b border-ink-850">
            <span className="stamp hidden sm:inline">Zoom</span>
            {/* One control, two halves — a pair of separate buttons read as two
                unrelated actions when they are the same action twice. */}
            <span className="inline-flex items-stretch rounded-xl border border-ink-700 bg-ink-900
                             overflow-hidden">
              <button
                type="button" onClick={() => zoom(1 / 0.6)} aria-label="Zoom out"
                className="px-3.5 py-1.5 text-fog-300 hover:bg-ink-800 hover:text-fog-100
                           transition-colors duration-150"
              >
                −
              </button>
              <span className="w-px bg-ink-700" aria-hidden="true" />
              <button
                type="button" onClick={() => zoom(0.6)} aria-label="Zoom in"
                className="px-3.5 py-1.5 text-fog-300 hover:bg-ink-800 hover:text-fog-100
                           transition-colors duration-150"
              >
                +
              </button>
            </span>
            <button type="button" onClick={fitAll} className="btn-ghost !px-3 !py-1.5 text-xs">
              Fit all
            </button>
            <span className="ml-auto text-[11px] text-fog-800 hidden md:inline">
              Drag the strip below the chart to pan
            </span>
          </div>

          <div className="flex-1 min-h-0 px-1 sm:px-4 pt-2">
            <ChartCanvas
              stays={stays}
              colors={colors}
              points={points}
              domain={[points[win.start]?.t ?? 'dataMin', points[win.end]?.t ?? 'dataMax']}
              today={today}
              height="100%"
              highlightedId={highlightedId}
              onHighlight={onHighlight}
              tickGap={72}
              tickTarget={10}
              brush
              brushIndex={win}
              onBrushChange={(r) => {
                if (typeof r?.startIndex === 'number') {
                  setView({ start: r.startIndex, end: r.endIndex })
                }
              }}
            />
          </div>

          <div className="safe-b border-t border-ink-800 px-4 sm:px-6 py-3">
            {/* This strip is the chart's key as well as its index: pointing at
                a trip raises its band, clicking zooms the axis onto it. */}
            <h3 className="stamp mb-2">Trips · point to highlight, tap to zoom</h3>
            <div
              className="flex gap-2 overflow-x-auto no-scrollbar pb-1"
              onMouseLeave={() => onHighlight(null)}
            >
              {stays.map((s) => {
                const focused = highlightedId === s.id
                const dimmed = highlightedId && !focused
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => jumpTo(s)}
                    onMouseEnter={() => onHighlight(s.id)}
                    onFocus={() => onHighlight(s.id)}
                    style={focused ? { borderColor: colors[s.id] } : undefined}
                    className={`shrink-0 flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left
                      transition-all duration-150 ${focused
                        ? 'bg-ink-850'
                        : `border-ink-700 bg-ink-900 hover:border-ink-600 ${dimmed ? 'opacity-45' : ''}`}`}
                  >
                    <span className="h-7 w-1.5 rounded-full shrink-0" style={{ background: colors[s.id] }} />
                    <span className="block">
                      <span className="block text-xs text-fog-100 max-w-[9rem] truncate">{s.name}</span>
                      <span className="block num text-[10px] text-fog-700 mt-0.5">
                        {formatShort(s.startDate)} · {stayDuration(s)}d
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
