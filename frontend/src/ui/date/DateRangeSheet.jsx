import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Modal from '../common/Modal.jsx'
import MonthGrid from './MonthGrid.jsx'
import { MonthPicker, YearPicker, MONTHS } from './PeriodGrids.jsx'
import { diffDays, formatDisplay, parseISO, toISO, todayISO } from '../../engine/dates.js'

const shiftMonth = (iso, n) => {
  const d = parseISO(iso)
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12)))
}
const withMonth = (iso, month) => {
  const d = parseISO(iso)
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), month, 1, 12)))
}
const withYear = (iso, year) => {
  const d = parseISO(iso)
  return toISO(new Date(Date.UTC(year, d.getUTCMonth(), 1, 12)))
}
const yearOf = (iso) => parseISO(iso).getUTCFullYear()
const monthOf = (iso) => parseISO(iso).getUTCMonth()

/**
 * Range picker: first tap sets the start, second tap sets the end. Tapping the
 * same day twice is a one-day stay. Tapping before the current start restarts
 * the range. There is no native date input anywhere in this app — that is
 * precisely where the reference app's empty-field bug lives.
 */
export default function DateRangeSheet({ open, value, onCancel, onConfirm }) {
  const today = todayISO()
  const [start, setStart] = useState(value?.startDate || null)
  const [end, setEnd] = useState(value?.endDate || null)
  const [anchor, setAnchor] = useState(value?.startDate || today)
  const [level, setLevel] = useState('days') // days | months | years

  const days = start && end ? diffDays(start, end) + 1 : 0
  const valid = Boolean(start && end && end >= start)
  // The title is the instruction — it always names the next thing to do.
  const title = !start ? 'Pick the start date'
    : !end ? 'Pick the end date'
      : 'Check your dates'

  const pick = (iso) => {
    if (!start || end || iso < start) {
      setStart(iso)
      setEnd(null)
    } else {
      setEnd(iso)
    }
  }

  const step = (n) => setAnchor(shiftMonth(anchor, level === 'days' ? n : n * 12))

  const yearPage = Math.floor(yearOf(anchor) / 12) * 12
  const years = Array.from({ length: 12 }, (_, i) => yearPage + i)

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
    >
      {/* Live read-out of the selection, always in the same place. */}
      <div className="well px-3.5 py-3 mb-3">
        <div className="flex items-center justify-between gap-3">
          <span className="num text-sm">
            <span className={start ? 'text-fog-100' : 'text-fog-800'}>
              {start ? formatDisplay(start) : 'Start'}
            </span>
            <span className="text-fog-700 px-2">→</span>
            <span className={end ? 'text-fog-100' : 'text-fog-800'}>
              {end ? formatDisplay(end) : 'End'}
            </span>
          </span>
          <AnimatePresence mode="wait">
            <motion.span
              key={days}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.15 }}
              className="num text-xs text-fog-500 shrink-0"
            >
              {days ? `${days} day${days === 1 ? '' : 's'}` : ''}
            </motion.span>
          </AnimatePresence>
        </div>
        {start && !end && (
          <div className="mt-2.5 flex items-center gap-2 border-t border-ink-700 pt-2.5">
            <span className="text-[11px] text-fog-700 leading-snug">
              Pick the last day, or make it a one-day stay.
            </span>
            <button
              type="button"
              onClick={() => setEnd(start)}
              className="ml-auto shrink-0 btn-quiet !px-3 !py-1.5 text-xs"
            >
              Single day
            </button>
          </div>
        )}
      </div>

      {/* Header: the arrows step, the label jumps. */}
      <div className="flex items-center gap-2 mb-3">
        <button type="button" onClick={() => step(-1)} disabled={level === 'years'}
          aria-label={level === 'days' ? 'Previous month' : 'Previous year'}
          className="btn-quiet !px-3 !py-2 disabled:opacity-25">‹</button>

        <button
          type="button"
          onClick={() => setLevel(level === 'days' ? 'months' : level === 'months' ? 'years' : 'days')}
          className="flex-1 rounded-xl bg-ink-850 border border-ink-700 px-3 py-2 text-sm
                     text-fog-100 hover:border-ink-600 transition-colors"
        >
          {level === 'days' && `${MONTHS[monthOf(anchor)]} ${yearOf(anchor)}`}
          {level === 'months' && `${yearOf(anchor)}`}
          {level === 'years' && `${years[0]} – ${years[11]}`}
          <span className="text-fog-700 ml-1.5 text-xs">
            {level === 'years' ? '↩' : '▾'}
          </span>
        </button>

        <button type="button" onClick={() => step(1)} disabled={level === 'years'}
          aria-label={level === 'days' ? 'Next month' : 'Next year'}
          className="btn-quiet !px-3 !py-2 disabled:opacity-25">›</button>
      </div>

      {level === 'years' && (
        <div className="flex items-center justify-between mb-2">
          <button type="button" onClick={() => setAnchor(withYear(anchor, yearOf(anchor) - 12))}
            className="btn-ghost !px-3 !py-1.5 text-xs">Earlier</button>
          <button type="button" onClick={() => setAnchor(withYear(anchor, yearOf(anchor) + 12))}
            className="btn-ghost !px-3 !py-1.5 text-xs">Later</button>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={level}
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.14 }}
        >
          {level === 'days' && (
            <MonthGrid
              anchorISO={anchor}
              startDate={start}
              endDate={end}
              onPick={pick}
              todayISODate={today}
            />
          )}
          {level === 'months' && (
            <MonthPicker
              year={yearOf(anchor)}
              selectedMonth={monthOf(anchor)}
              onPick={(m) => { setAnchor(withMonth(anchor, m)); setLevel('days') }}
            />
          )}
          {level === 'years' && (
            <YearPicker
              years={years}
              selectedYear={yearOf(anchor)}
              currentYear={yearOf(today)}
              onPick={(y) => { setAnchor(withYear(anchor, y)); setLevel('months') }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onCancel} className="btn-quiet btn-lg flex-1">
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => onConfirm({ startDate: start, endDate: end })}
          className="btn-primary btn-lg flex-[1.4]"
        >
          {valid ? `Use ${days} day${days === 1 ? '' : 's'}` : 'Pick both dates'}
        </button>
      </div>
    </Modal>
  )
}
