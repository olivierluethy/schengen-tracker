import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'

export default function Toast({ message, actionLabel, onAction, onDismiss, duration = 5000 }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [message, duration, onDismiss])

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="fixed left-1/2 -translate-x-1/2 bottom-24 lg:bottom-8 z-[60] flex items-center
                     gap-4 bg-ink-800 border border-ink-600 rounded-full pl-5 pr-2 py-2 shadow-pop"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <span className="text-sm text-fog-300">{message}</span>
          {actionLabel && (
            <button
              onClick={onAction}
              className="text-sm font-semibold text-accent px-3 py-1 rounded-full hover:bg-ink-700"
            >
              {actionLabel}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
