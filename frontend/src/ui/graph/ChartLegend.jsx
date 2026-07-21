import { stayDuration } from '../../engine/schengen.js'

/**
 * The key: which colour is which trip.
 *
 * In chart order, not list order — the legend has to be readable top-to-bottom
 * against the stack, and re-sorting the stays list must never reshuffle it.
 * Pointing at an entry raises the matching band, so the legend doubles as the
 * way to pick a trip out of a crowded plot without hunting for it.
 */
export default function ChartLegend({ stays, colors, highlightedId, onHighlight, max }) {
  if (!stays.length) return null
  const shown = max ? stays.slice(0, max) : stays
  const hidden = stays.length - shown.length

  return (
    <ul
      className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-1"
      onMouseLeave={() => onHighlight(null)}
    >
      {shown.map((s) => {
        const focused = highlightedId === s.id
        const dimmed = highlightedId && !focused
        return (
          <li key={s.id}>
            <button
              type="button"
              onMouseEnter={() => onHighlight(s.id)}
              onFocus={() => onHighlight(s.id)}
              onClick={() => onHighlight(focused ? null : s.id)}
              aria-pressed={focused}
              className={`flex items-center gap-2 rounded-md py-0.5 pr-1 transition-opacity duration-150
                ${dimmed ? 'opacity-40' : 'opacity-100'}`}
            >
              <span
                className="h-2.5 w-2.5 rounded-[3px] shrink-0 transition-transform duration-150"
                style={{
                  background: colors[s.id],
                  transform: focused ? 'scale(1.15)' : undefined,
                }}
              />
              <span className={`text-[11px] leading-none max-w-[9rem] truncate
                ${focused ? 'text-fog-100' : 'text-fog-300'}`}>
                {s.name}
              </span>
              <span className="num text-[10px] leading-none text-fog-800">{stayDuration(s)}d</span>
            </button>
          </li>
        )
      })}
      {hidden > 0 && (
        <li className="text-[10px] text-fog-800">
          +{hidden} more in the full view
        </li>
      )}
    </ul>
  )
}
