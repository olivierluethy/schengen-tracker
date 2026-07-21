import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { buildSeries, graphRange } from '../../engine/schengen.js'
import { epochDay, todayISO } from '../../engine/dates.js'
import ChartCanvas from './ChartCanvas.jsx'
import ChartLegend from './ChartLegend.jsx'
import ExpandedChart from './ExpandedChart.jsx'

/** Past this many, the key stops being a key and becomes a wall of names. */
const LEGEND_MAX = 8

/**
 * The chart card on the tracker.
 *
 * Stacked per trip, so the card answers both questions at once: how much of
 * the allowance is spent on each date, and whose travel spent it.
 *
 * `chartRef` is handed to the PDF exporter, which serialises the first <svg>
 * it finds inside — so nothing else in that wrapper may render an <svg>.
 */
export default function ComplianceGraph({ stays, colors, highlightedId, onHighlight, chartRef }) {
  const today = todayISO()
  const [expanded, setExpanded] = useState(false)

  const { points, range, step } = useMemo(() => {
    const r = graphRange(stays, today)
    // Keep the point count sane on long histories; tiles always use exact math.
    const span = Math.abs(epochDay(r.to) - epochDay(r.from))
    const s = span > 900 ? 3 : span > 450 ? 2 : 1
    return { points: buildSeries(stays, r.from, r.to, s).points, range: r, step: s }
  }, [stays, today])

  const domain = [epochDay(range.from), epochDay(range.to)]

  return (
    <>
      <motion.section
        className="card p-3 sm:p-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between gap-3 px-1 pb-2">
          <h2 className="stamp stamp-rule">Rolling window</h2>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="btn-ghost !px-3 !py-1.5 text-xs"
          >
            Full view
          </button>
        </div>

        <div ref={chartRef}>
          <ChartCanvas
            stays={stays}
            colors={colors}
            points={points}
            domain={domain}
            today={today}
            height={252}
            highlightedId={highlightedId}
            onHighlight={onHighlight}
          />
        </div>

        <div className="pt-3 border-t border-ink-800 mt-1">
          <ChartLegend
            stays={stays}
            colors={colors}
            highlightedId={highlightedId}
            onHighlight={onHighlight}
            max={LEGEND_MAX}
          />
        </div>

        <p className="px-1 pt-2.5 text-[11px] text-fog-700 leading-relaxed">
          Each colour is one trip. A band’s thickness is how many of that trip’s days
          still count in the 180-day window on that date, so the top of the stack is
          your total. Point at a trip to pick it out; hover the plot for a date’s figures.
          {step > 1 && ' Sampled for display — the figures above are exact.'}
        </p>
      </motion.section>

      <ExpandedChart
        open={expanded}
        onClose={() => setExpanded(false)}
        stays={stays}
        colors={colors}
        highlightedId={highlightedId}
        onHighlight={onHighlight}
      />
    </>
  )
}
