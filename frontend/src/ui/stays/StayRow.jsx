import { AnimatePresence, motion } from 'framer-motion'
import { formatDisplay } from '../../engine/dates.js'
import { stayDuration } from '../../engine/schengen.js'
import { STAY_STATUS, stayStatus } from './stayStatus.js'

/** Fixed geometry, so the windowed list can place rows without measuring. */
export const ROW_BODY = 64
export const ROW_PANEL = 48
export const ROW_GAP = 8

/**
 * Compact by default — the list must read as a list, not a giant table.
 * Tap expands; swipe left past the threshold deletes (with undo).
 */
export default function StayRow({
  stay, color, expanded, highlighted, today, onToggle, onEdit, onDelete,
}) {
  const days = stayDuration(stay)
  const status = STAY_STATUS[stayStatus(stay, today)]
  return (
    <div className="relative overflow-hidden rounded-xl2">
      <div className="absolute inset-0 bg-over/20 flex items-center justify-end pr-5">
        <span className="text-over text-sm font-semibold">Delete</span>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={0.08}
        onDragEnd={(_, info) => { if (info.offset.x < -100) onDelete(stay) }}
        onMouseEnter={() => onToggle(stay.id, 'hover')}
        className={[
          'relative bg-ink-900 border rounded-xl2 transition-colors duration-150',
          highlighted ? 'border-accent bg-ink-850' : 'border-ink-700 hover:border-ink-600',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={() => onToggle(stay.id, 'tap')}
          aria-expanded={expanded}
          className="w-full flex items-center gap-3 px-3.5 text-left"
          style={{ height: ROW_BODY }}
        >
          <span className="h-9 w-1.5 rounded-full shrink-0" style={{ background: color }} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium truncate leading-tight">{stay.name}</span>
            <span className="block num text-[11px] text-fog-500 truncate mt-1">
              {formatDisplay(stay.startDate)}
              <span className="text-fog-800 px-1">→</span>
              {formatDisplay(stay.endDate)}
            </span>
          </span>
          <span className="shrink-0 flex flex-col items-end gap-1.5">
            <span className={`pill !gap-1.5 !px-2 !py-[3px] ${status.className}`}>
              {status.dot && <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />}
              {status.label}
            </span>
            <span className="num text-sm text-fog-300 leading-none">{days}d</span>
          </span>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: ROW_PANEL, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="px-3.5 flex items-center justify-between border-t border-ink-800"
                style={{ height: ROW_PANEL }}>
                <span className="text-xs text-fog-700 truncate">
                  {stay.country || 'No country set'}
                </span>
                <span className="flex gap-2 shrink-0">
                  <button onClick={() => onEdit(stay)} className="btn-quiet !px-3 !py-1.5 text-xs">
                    Edit
                  </button>
                  <button onClick={() => onDelete(stay)} className="btn-danger !px-3 !py-1.5 text-xs">
                    Delete
                  </button>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
