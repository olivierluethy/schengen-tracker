import { useMemo } from 'react'
import {
  Area, AreaChart, Brush, CartesianGrid, ComposedChart, Customized, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { LIMIT_DAYS } from '../../engine/schengen.js'
import { epochDay, formatDisplay, formatShort, fromEpochDay } from '../../engine/dates.js'
import TripBoundaries from './TripBoundaries.jsx'
import { CHART, fillId, timeTicks, usageScale } from './chartTheme.js'

/**
 * The rolling 90/180 curve, drawn as STACKED PER-TRIP BANDS.
 *
 * The rolling total is mathematically the sum of each trip's contribution to
 * the window, so stacking the per-trip series reproduces the true curve
 * exactly — Barcelona's band IS the portion of the curve Barcelona drives.
 * Reading the top of the stack gives you the same number the tiles show;
 * reading a single band tells you which travel put it there.
 *
 * Shared verbatim by the card on the tracker and the full view, so the two can
 * never drift apart. Only the height, the tick density and the presence of the
 * overview strip differ.
 */
const BRUSH_H = 34

export default function ChartCanvas({
  stays, colors, points, domain, today, height,
  highlightedId, onHighlight,
  brush = false, brushIndex, onBrushChange, tickGap = 56, tickTarget = 6,
}) {
  const todayT = epochDay(today)
  const brushPx = brush ? BRUSH_H + 10 : 0
  const scale = timeTicks(domain, tickTarget)
  // Off the whole series, not the visible window: zooming must not re-step the
  // axis under you.
  const y = useMemo(
    () => usageScale(points.reduce((max, p) => (p.total > max ? p.total : max), 0)),
    [points],
  )
  // One gradient per COLOUR, not per trip: past eight trips the palette cycles,
  // and repeating trips can share a definition.
  const fills = useMemo(
    () => Array.from(new Set(stays.map((s) => colors[s.id]).filter(Boolean))),
    [stays, colors],
  )

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={points}
        margin={{ top: 24, right: 16, left: 0, bottom: brushPx + 4 }}
        onMouseLeave={() => onHighlight(null)}
      >
        <defs>
          {fills.map((color) => (
            /* Saturated at the band's top edge, softer at its foot: the colour
               stays identifiable while the block stops sitting flat on the page. */
            <linearGradient key={color} id={fillId(color)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={color} stopOpacity={0.5} />
            </linearGradient>
          ))}
        </defs>

        <CartesianGrid horizontal vertical={false} stroke={CHART.grid} strokeDasharray="0" />

        <XAxis
          dataKey="t"
          type="number"
          scale="linear"
          domain={domain}
          allowDataOverflow
          ticks={scale?.ticks}
          tickFormatter={scale ? scale.format : (t) => formatShort(fromEpochDay(t))}
          tick={{ fill: CHART.tick, fontSize: 10, fontFamily: CHART.mono }}
          axisLine={{ stroke: CHART.axis }}
          tickLine={false}
          tickMargin={10}
          minTickGap={tickGap}
          interval={scale ? 'preserveStartEnd' : undefined}
        />
        <YAxis
          domain={y.domain}
          ticks={y.ticks}
          tick={{ fill: CHART.tick, fontSize: 10, fontFamily: CHART.mono }}
          axisLine={false}
          tickLine={false}
          width={34}
          tickMargin={6}
        />

        {/* Everything above 90 is time you are not entitled to. */}
        <ReferenceArea y1={LIMIT_DAYS} y2={y.domain[1]} fill={CHART.limit} fillOpacity={0.03} />

        <ReferenceLine
          x={todayT}
          stroke={CHART.today}
          strokeWidth={1}
          strokeDasharray="2 4"
          label={{
            value: 'TODAY', position: 'insideTop',
            fill: CHART.today, fontSize: 10, fontFamily: CHART.mono, dy: -9,
          }}
        />

        {stays.map((s) => {
          const focused = highlightedId === s.id
          const dimmed = highlightedId && !focused
          return (
            <Area
              key={s.id}
              type="monotone"
              dataKey={`s_${s.id}`}
              stackId="usage"
              /* Stroked in the surface colour, not the series colour: that gap
                 IS what keeps two stacked bands from bleeding together. */
              stroke={CHART.surface}
              strokeWidth={2}
              strokeLinejoin="round"
              fill={`url(#${fillId(colors[s.id])})`}
              fillOpacity={dimmed ? 0.22 : 1}
              isAnimationActive={false}
              onMouseEnter={() => onHighlight(s.id)}
              activeDot={false}
            />
          )
        })}

        {/* Drawn after the bands so the ceiling reads over them, and last of
            the rules so the eye reads the travel first. */}
        <ReferenceLine
          y={LIMIT_DAYS}
          stroke={CHART.limit}
          strokeOpacity={0.75}
          strokeDasharray="4 5"
          strokeWidth={1}
          /* Left, not right: today's rail lives on the right of most histories
             and the two labels would sit on top of each other. */
          label={{
            value: '90-DAY LIMIT', position: 'insideTopLeft', offset: 7,
            fill: CHART.limit, fillOpacity: 0.85, fontSize: 10, fontFamily: CHART.mono,
          }}
        />

        <Customized
          component={(props) => (
            <TripBoundaries
              {...props}
              stays={stays}
              colors={colors}
              highlightedId={highlightedId}
            />
          )}
        />

        <Tooltip
          cursor={{ stroke: CHART.guide, strokeWidth: 1 }}
          content={<GraphTooltip stays={stays} colors={colors} highlightedId={highlightedId} />}
          wrapperStyle={{ outline: 'none' }}
        />

        {brush && (
          <Brush
            dataKey="t"
            height={BRUSH_H}
            travellerWidth={10}
            stroke={CHART.axis}
            fill={CHART.surface}
            startIndex={brushIndex?.start}
            endIndex={brushIndex?.end}
            onChange={onBrushChange}
            tickFormatter={(t) => formatShort(fromEpochDay(t))}
          >
            {/* The panorama: the whole history in miniature, so zooming in
                never costs you your bearings. Totals only — at strip height a
                per-trip stack is a smear. */}
            <AreaChart>
              <YAxis hide domain={[0, (max) => Math.max(LIMIT_DAYS, max)]} />
              <Area
                type="monotone"
                dataKey="total"
                stroke={CHART.curve}
                strokeWidth={1}
                fill={CHART.curve}
                fillOpacity={0.2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </Brush>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function GraphTooltip({ active, payload, stays, colors, highlightedId }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  const contributing = stays
    .map((s) => ({ s, v: point[`s_${s.id}`] || 0 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)
  const hidden = Math.max(0, contributing.length - 6)

  return (
    <div className="bg-ink-850/95 backdrop-blur border border-ink-600 rounded-xl px-3.5 py-2.5 shadow-pop min-w-[13rem]">
      <div className="stamp">{formatDisplay(point.date)}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="num text-xl font-semibold leading-none tracking-tight">{point.total}</span>
        <span className="text-xs text-fog-500">of {LIMIT_DAYS} days used</span>
      </div>
      <div className="mt-1 text-xs text-fog-500">
        <span className="num text-fog-300">{point.remaining}</span> days left
      </div>
      {contributing.length > 0 && (
        <div className="mt-2.5 space-y-1 border-t border-ink-700 pt-2">
          {contributing.slice(0, 6).map(({ s, v }) => {
            const focused = highlightedId === s.id
            return (
              <div
                key={s.id}
                className={`flex items-center gap-2 text-xs ${
                  focused ? 'text-fog-100 font-medium' : 'text-fog-300'}`}
              >
                <span
                  className="h-2 w-2 rounded-[3px] shrink-0"
                  style={{
                    background: colors[s.id],
                    boxShadow: focused ? `0 0 0 2px ${CHART.surface}, 0 0 0 3.5px ${colors[s.id]}` : undefined,
                  }}
                />
                <span className="flex-1 truncate">{s.name}</span>
                <span className={`num ${focused ? 'text-fog-100' : 'text-fog-500'}`}>{v}d</span>
              </div>
            )
          })}
          {hidden > 0 && (
            <div className="text-xs text-fog-700 pl-4">+{hidden} more</div>
          )}
        </div>
      )}
    </div>
  )
}
