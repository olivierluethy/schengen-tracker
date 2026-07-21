import { AnimatePresence, motion } from 'framer-motion'

const LABELS = {
  offline: { text: 'Offline', dot: 'bg-fog-500', hint: 'Everything still works' },
  local: { text: 'On this device', dot: 'bg-fog-500', hint: 'No account needed' },
  syncing: { text: 'Syncing', dot: 'bg-accent animate-pulse', hint: '' },
  synced: { text: 'Synced', dot: 'bg-ok', hint: '' },
  pending: { text: 'Pending', dot: 'bg-warn', hint: 'Will sync when back online' },
}

export default function SyncPill({ state = 'local', count = 0 }) {
  const s = LABELS[state] || LABELS.local
  const text = state === 'pending' && count ? `${count} pending` : s.text
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        className="inline-flex items-center gap-2 rounded-full border border-ink-700
                   bg-ink-900/80 px-3 py-1.5 text-xs text-fog-300"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.18 }}
        title={s.hint}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
        {text}
      </motion.div>
    </AnimatePresence>
  )
}
