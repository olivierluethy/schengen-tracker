import { eachDay, formatMonth, parseISO, toISO } from '../../engine/dates.js'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

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

export default function MonthGrid({ anchorISO, startDate, endDate, onPick, todayISODate }) {
  const cells = monthCells(anchorISO)
  return (
    <div>
      <div className="text-sm font-semibold text-fog-300 mb-2">{formatMonth(anchorISO)}</div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] text-fog-700 mb-1">
        {WEEKDAYS.map((w, i) => <div key={i}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />
          const inRange = startDate && endDate && iso >= startDate && iso <= endDate
          const isEnd = iso === startDate || iso === endDate
          const isToday = iso === todayISODate
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(iso)}
              className={[
                'h-10 text-sm rounded-lg transition num',
                inRange && !isEnd ? 'bg-accent-dim/50 text-fog-100 rounded-none' : '',
                isEnd ? 'bg-accent text-ink-950 font-semibold' : '',
                !inRange && !isEnd ? 'text-fog-300 hover:bg-ink-800' : '',
                isToday && !isEnd ? 'ring-1 ring-inset ring-ink-600' : '',
              ].join(' ')}
            >
              {Number(iso.slice(8, 10))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
