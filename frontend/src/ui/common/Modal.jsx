import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'

const SIZES = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-xl',
}

/**
 * A bottom sheet on phones, a centred dialog from 640px up. Motion is
 * purposeful: the sheet rises from where the thumb is, so the eye follows it.
 */
export default function Modal({ open, onClose, title, size = 'md', children }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative w-full ${SIZES[size]} bg-ink-900 border-t sm:border border-ink-700
                       sm:rounded-xl2 rounded-t-3xl shadow-pop max-h-[92vh] overflow-y-auto safe-b`}
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="sm:hidden pt-3 grid place-items-center">
              <div className="h-1 w-10 rounded-full bg-ink-600" />
            </div>
            {title && (
              <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
                <h2 className="heading text-lg leading-tight">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="hidden sm:grid h-7 w-7 place-items-center rounded-lg text-fog-700
                             hover:text-fog-100 hover:bg-ink-800 transition-colors shrink-0"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
