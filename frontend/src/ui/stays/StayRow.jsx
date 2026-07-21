import { AnimatePresence, motion } from 'framer-motion'
import { formatDisplay } from '../../engine/dates.js'
import { stayDuration } from '../../engine/schengen.js'

/**
 * Compact by default — the list must read as a list, not a giant table.
 * Tap expands; swipe left past the threshold deletes (with undo).
 */
export default function StayRow({
  stay, color, expanded, highlighted, onToggle, onEdit, onDelete,
}) {
  const days = stayDuration(stay)
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
          'relative bg-ink-900 border rounded-xl2 transition-colors',
          highlighted ? 'border-accent' : 'border-ink-700',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={() => onToggle(stay.id, 'tap')}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
        >
          <span className="h-8 w-1.5 rounded-full shrink-0" style={{ background: color }} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium truncate">{stay.name}</span>
            <span className="block text-xs text-fog-500 num truncate">
              {formatDisplay(stay.startDate)} → {formatDisplay(stay.endDate)}
            </span>
          </span>
          <span className="shrink-0 text-sm num text-fog-300 tabular-nums">{days}d</span>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 pt-1 flex items-center justify-between border-t border-ink-800">
                <span className="text-xs text-fog-700">
                  {stay.country || 'No country set'}
                </span>
                <span className="flex gap-2">
                  <button onClick={() => onEdit(stay)}
                    className="px-3 py-1.5 rounded-lg bg-ink-800 text-fog-200 text-sm">Edit</button>
                  <button onClick={() => onDelete(stay)}
                    className="px-3 py-1.5 rounded-lg bg-over/15 text-over text-sm">Delete</button>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
