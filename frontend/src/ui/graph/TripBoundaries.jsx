import { epochDay } from '../../engine/dates.js'

/**
 * Where each trip starts and ends, as the quietest mark that still answers it.
 *
 * Rendered as a Recharts <Customized> child so it receives the chart's real
 * xAxisMap and uses the SAME scale the stacked bands use — approximating the
 * scale by hand would drift a few pixels and quietly break the "this edge
 * belongs to that band" promise.
 *
 * The colour bands already do the separating, so at rest a trip gets nothing
 * but a short tick standing on the plot floor. Hovering one raises full-height
 * hairlines for that trip alone: the old version drew those rails for every
 * trip at once, which is what made the plot look like a barcode.
 */
const TICK_H = 7
const DENSE = 24

export default function TripBoundaries({ xAxisMap, offset, stays, colors, highlightedId }) {
  const axis = xAxisMap && Object.values(xAxisMap)[0]
  if (!axis || !offset) return null

  const left = offset.left
  const right = offset.left + offset.width
  const floor = offset.top + offset.height

  const marks = stays
    .map((s) => ({
      stay: s,
      x1: axis.scale(epochDay(s.startDate)),
      x2: axis.scale(epochDay(s.endDate)),
    }))
    .filter((m) => m.x2 >= left && m.x1 <= right)

  // Past a certain density the ticks stop separating trips and start becoming
  // a texture, so only the trip you are pointing at keeps its marks.
  const restAtRest = marks.length <= DENSE

  return (
    <g style={{ pointerEvents: 'none' }}>
      {marks.map(({ stay, x1, x2 }) => {
        const focused = highlightedId === stay.id
        if (!focused && (!restAtRest || highlightedId)) return null
        const color = colors[stay.id]
        return (
          <g key={stay.id}>
            {[x1, x2].map((x, i) => {
              if (x < left || x > right) return null
              return (
                <g key={i}>
                  {focused && (
                    <line
                      x1={x} x2={x} y1={offset.top} y2={floor}
                      stroke={color} strokeOpacity={0.3} strokeWidth={1}
                      strokeDasharray={i ? '2 3' : undefined}
                    />
                  )}
                  <line
                    x1={x} x2={x} y1={floor - TICK_H} y2={floor}
                    stroke={color} strokeOpacity={focused ? 1 : 0.6} strokeWidth={1.5}
                  />
                </g>
              )
            })}
          </g>
        )
      })}
    </g>
  )
}
