import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Area, ComposedChart, Customized, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { buildSeries, graphRange, LIMIT_DAYS } from '../../engine/schengen.js'
import { epochDay, fromEpochDay, formatDisplay, formatShort, todayISO } from '../../engine/dates.js'
import TripRibbon, { ribbonHeight } from './TripRibbon.jsx'

/**
 * The rolling 90/180 curve, drawn as STACKED PER-TRIP BANDS.
 *
 * The rolling total is mathematically the sum of each trip's contribution to
 * the window, so stacking the per-trip series reproduces the true curve
 * exactly — Barcelona's band IS the portion of the curve Barcelona drives.
 */
export default function ComplianceGraph({ stays, colors, highlightedId, onHighlight }) {
  const today = todayISO()

  const { points, range, step } = useMemo(() => {
    const r = graphRange(stays, today)
    // Keep the point count sane on long histories; tiles always use exact math.
    const span = Math.abs(epochDay(r.to) - epochDay(r.from))
    const s = span > 900 ? 3 : span > 450 ? 2 : 1
    return { points: buildSeries(stays, r.from, r.to, s).points, range: r, step: s }
  }, [stays, today])

  const ribbon = ribbonHeight(stays)
  const todayT = epochDay(today)

  return (
    <motion.div
      className="card p-3 pb-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <ResponsiveContainer width="100%" height={230 + ribbon}>
        <ComposedChart
          data={points}
          margin={{ top: 8, right: 8, left: -18, bottom: ribbon + 4 }}
          onMouseLeave={() => onHighlight(null)}
        >
          <defs>
            <linearGradient id="overShade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.14} />
              <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="t"
            type="number"
            scale="linear"
            domain={[epochDay(range.from), epochDay(range.to)]}
            tickFormatter={(t) => formatShort(fromEpochDay(t))}
            tick={{ fill: '#5B6474', fontSize: 10 }}
            axisLine={{ stroke: '#232A36' }}
            tickLine={false}
            minTickGap={44}
          />
          <YAxis
            domain={[0, (max) => Math.max(100, Math.ceil(max / 10) * 10)]}
            tick={{ fill: '#5B6474', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={38}
          />

          <ReferenceLine
            y={LIMIT_DAYS}
            stroke="#FF6B6B"
            strokeDasharray="5 4"
            label={{ value: '90-day limit', position: 'insideTopRight', fill: '#FF6B6B', fontSize: 10 }}
          />
          <ReferenceLine
            x={todayT}
            stroke="#8B94A5"
            strokeDasharray="3 3"
            label={{ value: 'today', position: 'insideTopLeft', fill: '#8B94A5', fontSize: 10 }}
          />

          {stays.map((s) => (
            <Area
              key={s.id}
              type="stepAfter"
              dataKey={`s_${s.id}`}
              stackId="usage"
              stroke={colors[s.id]}
              strokeWidth={highlightedId === s.id ? 1.6 : 0.6}
              fill={colors[s.id]}
              fillOpacity={highlightedId && highlightedId !== s.id ? 0.14 : 0.62}
              isAnimationActive={false}
              onMouseEnter={() => onHighlight(s.id)}
              activeDot={false}
            />
          ))}

          <Tooltip
            cursor={{ stroke: '#2E3644' }}
            content={<GraphTooltip stays={stays} colors={colors} />}
          />

          <Customized
            component={(props) => (
              <TripRibbon
                {...props}
                stays={stays}
                colors={colors}
                highlightedId={highlightedId}
                onHighlight={onHighlight}
              />
            )}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="px-1 pt-1 text-[10px] text-fog-700 leading-relaxed">
        Each colour is one trip. A band's thickness is how many of that trip's days still
        count in the 180-day window on that date.
        {step > 1 && ' Sampled for display; the figures above are exact.'}
      </p>
    </motion.div>
  )
}

function GraphTooltip({ active, payload, label, stays, colors }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  const contributing = stays
    .map((s) => ({ s, v: point[`s_${s.id}`] || 0 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)

  return (
    <div className="bg-ink-850 border border-ink-600 rounded-xl px-3 py-2 shadow-lift">
      <div className="text-xs text-fog-500 num">{formatDisplay(point.date)}</div>
      <div className="mt-1 text-sm font-semibold num">
        {point.total} <span className="text-fog-500 font-normal">of 90 days used</span>
      </div>
      <div className="text-xs text-fog-500 num">{point.remaining} days left</div>
      {contributing.length > 0 && (
        <div className="mt-2 space-y-0.5 border-t border-ink-700 pt-1.5">
          {contributing.slice(0, 5).map(({ s, v }) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-sm" style={{ background: colors[s.id] }} />
              <span className="flex-1 truncate text-fog-300">{s.name}</span>
              <span className="num text-fog-500">{v}d</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
