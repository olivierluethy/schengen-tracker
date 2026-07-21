import { motion } from 'framer-motion'
import { LIMIT_DAYS } from '../../engine/schengen.js'

const STATUS = {
  compliant: { label: 'Compliant', cls: 'text-ok', dot: 'bg-ok' },
  warning: { label: 'Getting close', cls: 'text-warn', dot: 'bg-warn' },
  over: { label: 'Over the limit', cls: 'text-over', dot: 'bg-over' },
}

export default function SummaryTiles({ used, remaining, status }) {
  const s = STATUS[status]
  return (
    <div className="grid grid-cols-3 gap-2">
      <Tile label="Days used" value={used} suffix={`/ ${LIMIT_DAYS}`} />
      <Tile label="Days left" value={remaining} />
      <motion.div
        key={status}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="card px-3 py-3 flex flex-col justify-between"
      >
        <span className="text-[10px] uppercase tracking-widest text-fog-700">Status</span>
        <span className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${s.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </motion.div>
    </div>
  )
}

function Tile({ label, value, suffix }) {
  return (
    <div className="card px-3 py-3">
      <span className="block text-[10px] uppercase tracking-widest text-fog-700">{label}</span>
      <span className="mt-1 block num text-2xl font-semibold tracking-tight leading-none">
        {value}
        {suffix && <span className="text-sm text-fog-700 font-normal ml-1">{suffix}</span>}
      </span>
    </div>
  )
}
