import { AnimatePresence, motion } from 'framer-motion'

const LABELS = {
  offline: { text: 'Offline', tone: 'border-ink-700 text-fog-500', dot: 'bg-fog-700', hint: 'Everything still works' },
  local: { text: 'On this device', tone: 'border-ink-700 text-fog-500', dot: 'bg-fog-700', hint: 'No account needed' },
  syncing: { text: 'Syncing', tone: 'border-accent/40 text-accent-soft', dot: 'bg-accent animate-pulse', hint: '' },
  synced: { text: 'Synced', tone: 'border-ok/30 text-ok', dot: 'bg-ok', hint: '' },
  pending: { text: 'Pending', tone: 'border-warn/30 text-warn', dot: 'bg-warn', hint: 'Will sync when back online' },
}

export default function SyncPill({ state = 'local', count = 0 }) {
  const s = LABELS[state] || LABELS.local
  const text = state === 'pending' && count ? `${count} pending` : s.text
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        className={`pill bg-ink-900/80 ${s.tone}`}
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
