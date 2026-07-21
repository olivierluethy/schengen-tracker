const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * The fast paths out of the day grid.
 *
 * Going from 2026 back to 2024 is two taps here — a year, then a month —
 * instead of twenty-four presses of the back arrow.
 */
export function MonthPicker({ year, selectedMonth, onPick }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MONTHS.map((m, i) => {
        const active = selectedMonth === i
        return (
          <button
            key={m}
            type="button"
            onClick={() => onPick(i)}
            className={`h-14 rounded-xl text-sm transition-colors ${
              active ? 'bg-accent text-ink-950 font-semibold'
                : 'bg-ink-850 text-fog-300 hover:bg-ink-800 hover:text-fog-100'}`}
          >
            {m}
            <span className="block num text-[10px] opacity-60 mt-0.5">{year}</span>
          </button>
        )
      })}
    </div>
  )
}

export function YearPicker({ years, selectedYear, currentYear, onPick }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {years.map((y) => {
        const active = y === selectedYear
        return (
          <button
            key={y}
            type="button"
            onClick={() => onPick(y)}
            className={`h-14 rounded-xl num text-sm transition-colors ${
              active ? 'bg-accent text-ink-950 font-semibold'
                : 'bg-ink-850 text-fog-300 hover:bg-ink-800 hover:text-fog-100'}`}
          >
            {y}
            {y === currentYear && !active && (
              <span className="block h-1 w-1 rounded-full bg-accent mx-auto mt-1" />
            )}
          </button>
        )
      })}
    </div>
  )
}

export { MONTHS }
