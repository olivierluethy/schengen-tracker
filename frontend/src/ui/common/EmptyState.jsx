import { motion } from 'framer-motion'

export default function EmptyState({ onAdd }) {
  return (
    <motion.div
      className="card p-8 sm:p-10 text-center max-w-xl mx-auto"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mx-auto h-12 w-12 rounded-2xl bg-accent-deep border border-accent-dim
                      grid place-items-center text-xl">
        🛬
      </div>
      <h2 className="heading mt-5 text-xl">No stays yet</h2>
      <p className="mt-2.5 text-sm text-fog-500 leading-relaxed">
        Add your first Schengen stay and this page will show exactly how many of your
        90 days you have used in any rolling 180-day window.
      </p>
      <p className="mt-3.5 text-xs text-fog-700 leading-relaxed">
        No account. No internet needed. Everything stays on this device — an account is
        optional and only adds sync between devices and sharing with a partner.
      </p>
      <button onClick={onAdd} className="btn-primary btn-lg mt-6 w-full sm:w-auto">
        Add your first stay
      </button>
    </motion.div>
  )
}
