import { useState } from 'react'
import Modal from '../common/Modal.jsx'
import MonthGrid from './MonthGrid.jsx'
import { addDays, diffDays, formatDisplay, parseISO, toISO, todayISO } from '../../engine/dates.js'

const shiftMonth = (iso, n) => {
  const d = parseISO(iso)
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12)))
}

/**
 * Range picker: first tap sets the start, second tap sets the end. Tapping
 * before the current start restarts the range. There is no native date input
 * anywhere in this app — that is precisely where the reference app's
 * empty-field bug lives.
 */
export default function DateRangeSheet({ open, value, onCancel, onConfirm }) {
  const today = todayISO()
  const [start, setStart] = useState(value?.startDate || null)
  const [end, setEnd] = useState(value?.endDate || null)
  const [anchor, setAnchor] = useState(value?.startDate || today)

  const pick = (iso) => {
    if (!start || end || iso < start) {
      setStart(iso)
      setEnd(null)
    } else {
      setEnd(iso)
    }
  }

  const nights = start && end ? diffDays(start, end) + 1 : 0

  return (
    <Modal open={open} onClose={onCancel} title="Select dates">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setAnchor(shiftMonth(anchor, -1))}
          className="h-9 w-9 rounded-lg bg-ink-800 text-fog-300">‹</button>
        <div className="text-xs text-fog-500">
          {start ? formatDisplay(start) : 'Pick a start day'}
          {end ? ` → ${formatDisplay(end)}` : ''}
        </div>
        <button type="button" onClick={() => setAnchor(shiftMonth(anchor, 1))}
          className="h-9 w-9 rounded-lg bg-ink-800 text-fog-300">›</button>
      </div>

      <MonthGrid
        anchorISO={anchor}
        startDate={start}
        endDate={end}
        onPick={pick}
        todayISODate={today}
      />

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-fog-500 num">
          {nights ? `${nights} day${nights === 1 ? '' : 's'}` : ' '}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
            className="px-4 py-2.5 rounded-xl2 bg-ink-800 text-fog-300">Cancel</button>
          <button
            type="button"
            disabled={!start}
            onClick={() => onConfirm({ startDate: start, endDate: end || start })}
            className="px-4 py-2.5 rounded-xl2 bg-accent text-ink-950 font-semibold disabled:opacity-40"
          >
            Use these dates
          </button>
        </div>
      </div>
    </Modal>
  )
}
