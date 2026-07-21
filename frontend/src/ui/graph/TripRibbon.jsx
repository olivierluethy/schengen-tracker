import { epochDay } from '../../engine/dates.js'

/**
 * The labelled trip ribbon.
 *
 * Rendered as a Recharts <Customized> child so it receives the chart's real
 * xAxisMap and can use the SAME scale function the areas use. Approximating
 * the scale by hand would drift by a few pixels and quietly break the
 * "this band is that trip" promise the whole design rests on.
 */
export default function TripRibbon(props) {
  const { xAxisMap, offset, stays, colors, highlightedId, onHighlight, rowHeight = 14 } = props
  const axis = xAxisMap && Object.values(xAxisMap)[0]
  if (!axis || !offset) return null
  const scale = axis.scale

  // Lay trips out in lanes so overlapping trips never sit on top of each other.
  const lanes = []
  const placed = stays.map((s) => {
    const x1 = scale(epochDay(s.startDate))
    const x2 = scale(epochDay(s.endDate))
    let lane = lanes.findIndex((end) => x1 > end + 6)
    if (lane === -1) { lane = lanes.length; lanes.push(0) }
    lanes[lane] = x2
    return { stay: s, x1, x2, lane }
  })

  const top = offset.top + offset.height + 10

  return (
    <g>
      {placed.map(({ stay, x1, x2, lane }) => {
        const w = Math.max(3, x2 - x1)
        const dim = highlightedId && highlightedId !== stay.id
        const y = top + lane * (rowHeight + 4)
        return (
          <g
            key={stay.id}
            opacity={dim ? 0.28 : 1}
            style={{ cursor: 'pointer', transition: 'opacity 160ms' }}
            onMouseEnter={() => onHighlight(stay.id)}
            onMouseLeave={() => onHighlight(null)}
            onClick={() => onHighlight(stay.id)}
          >
            <rect x={x1} y={y} width={w} height={rowHeight} rx={rowHeight / 2}
              fill={colors[stay.id]} />
            {w > 46 && (
              <text x={x1 + 8} y={y + rowHeight - 3.5} fontSize={10} fill="#0A0C10"
                fontWeight="600" style={{ pointerEvents: 'none' }}>
                {stay.name.length > 14 ? `${stay.name.slice(0, 13)}…` : stay.name}
              </text>
            )}
            {w <= 46 && (
              <text x={x2 + 5} y={y + rowHeight - 3.5} fontSize={10} fill="#8B94A5"
                style={{ pointerEvents: 'none' }}>
                {stay.name.length > 12 ? `${stay.name.slice(0, 11)}…` : stay.name}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

/** Height the chart must reserve below the plot for the ribbon lanes. */
export function ribbonHeight(stays) {
  if (!stays.length) return 0
  // Worst case is one lane per overlapping group; 3 lanes covers realistic use
  // and the chart simply clips beyond that.
  const lanes = Math.min(3, stays.length)
  return 10 + lanes * 18
}
