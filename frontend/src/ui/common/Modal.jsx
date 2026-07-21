import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'

/**
 * A bottom sheet on phones, a centred dialog from 640px up. Motion is
 * purposeful: the sheet rises from where the thumb is, so the eye follows it.
 */
export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
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
            className="relative w-full sm:max-w-md bg-ink-900 border-t sm:border border-ink-700
                       sm:rounded-xl2 rounded-t-3xl shadow-lift max-h-[92vh] overflow-y-auto safe-b"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="sm:hidden pt-3 grid place-items-center">
              <div className="h-1 w-10 rounded-full bg-ink-600" />
            </div>
            {title && (
              <div className="px-5 pt-4 pb-2">
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              </div>
            )}
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
