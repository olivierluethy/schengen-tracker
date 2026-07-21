import { eachDay, parseISO, toISO } from '../../engine/dates.js'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/** Days of the month `anchorISO` falls in, padded to whole Monday-start weeks. */
function monthCells(anchorISO) {
  const d = parseISO(anchorISO)
  const first = toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12)))
  const last = toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)))
  const leading = (parseISO(first).getUTCDay() + 6) % 7 // Monday = 0
  const cells = []
  for (let i = 0; i < leading; i++) cells.push(null)
  for (const day of eachDay(first, last)) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/**
 * The day grid.
 *
 * The selected range is drawn as one continuous bar with rounded ends, so a
 * range reads as a range rather than as two unrelated highlighted days.
 */
export default function MonthGrid({ anchorISO, startDate, endDate, onPick, todayISODate }) {
  const cells = monthCells(anchorISO)
  const singleDay = startDate && endDate && startDate === endDate

  return (
    <div>
      <div className="grid grid-cols-7 mb-1.5">
        {/* Two letters, not one: "T T" and "S S" are not a weekday header. */}
        {WEEKDAYS.map((w) => (
          <div key={w} className="stamp text-center py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`pad-${i}`} className="h-11" />

          const inRange = startDate && endDate && iso > startDate && iso < endDate
          const isStart = iso === startDate
          const isEnd = iso === endDate
          const isCap = isStart || isEnd
          const isToday = iso === todayISODate
          // Only the outer edges of the bar are rounded.
          const round = singleDay || (isStart && !endDate) ? 'rounded-xl'
            : isStart ? 'rounded-l-xl'
              : isEnd ? 'rounded-r-xl'
                : inRange ? 'rounded-none' : 'rounded-xl'

          return (
            <div key={iso} className="relative h-11">
              {(inRange || (isCap && !singleDay && endDate)) && (
                <span
                  aria-hidden
                  className={`absolute inset-y-1 bg-accent-deep ${
                    isStart ? 'left-1 right-0 rounded-l-lg'
                      : isEnd ? 'right-1 left-0 rounded-r-lg' : 'inset-x-0'}`}
                />
              )}
              <button
                type="button"
                onClick={() => onPick(iso)}
                aria-pressed={isCap}
                className={[
                  'relative h-11 w-full num text-sm transition-colors',
                  round,
                  isCap ? 'bg-accent text-ink-950 font-semibold'
                    : inRange ? 'text-fog-100'
                      : 'text-fog-300 hover:bg-ink-800',
                  isToday && !isCap ? 'ring-1 ring-inset ring-ink-500' : '',
                ].join(' ')}
              >
                {Number(iso.slice(8, 10))}
                {isToday && (
                  <span className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full ${
                    isCap ? 'bg-ink-950/60' : 'bg-accent'}`} />
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
