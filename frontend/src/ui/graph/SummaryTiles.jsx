import { motion } from 'framer-motion'
import { LIMIT_DAYS, WINDOW_DAYS } from '../../engine/schengen.js'
import { addDays, formatDisplay } from '../../engine/dates.js'

const STATUS = {
  compliant: { label: 'Compliant', text: 'text-ok', dot: 'bg-ok', ring: 'border-ok/30 bg-ok/10', bar: 'bg-ok' },
  warning: { label: 'Getting close', text: 'text-warn', dot: 'bg-warn', ring: 'border-warn/30 bg-warn/10', bar: 'bg-warn' },
  over: { label: 'Over the limit', text: 'text-over', dot: 'bg-over', ring: 'border-over/30 bg-over/10', bar: 'bg-over' },
}

export default function SummaryTiles({ used, remaining, status, today }) {
  const s = STATUS[status]
  const pct = Math.min(100, Math.round((used / LIMIT_DAYS) * 100))
  const windowStart = today ? addDays(today, -(WINDOW_DAYS - 1)) : null

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="stamp">Days used</h2>
          <div className="mt-2 flex items-baseline gap-1.5">
            <motion.span
              key={used}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="num text-[2.75rem] font-semibold leading-none tracking-tight"
            >
              {used}
            </motion.span>
            <span className="num text-lg text-fog-700 leading-none">/ {LIMIT_DAYS}</span>
          </div>
        </div>

        <motion.span
          key={status}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className={`pill ${s.ring} ${s.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </motion.span>
      </div>

      {/* The allowance as a single bar: the fastest read on the page. */}
      <div className="mt-4 h-1.5 rounded-full bg-ink-800 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${s.bar}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="well px-3.5 py-3">
          <span className="stamp block">Days left</span>
          <span className="mt-1.5 block num text-2xl font-semibold leading-none tracking-tight">
            {remaining}
          </span>
        </div>
        <div className="well px-3.5 py-3">
          <span className="stamp block">Window opened</span>
          <span className="mt-1.5 block num text-sm text-fog-300 leading-tight">
            {windowStart ? formatDisplay(windowStart) : '—'}
          </span>
          <span className="mt-1 block text-[10px] text-fog-800">{WINDOW_DAYS} days back from today</span>
        </div>
      </div>
    </section>
  )
}
