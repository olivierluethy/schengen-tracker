import { motion } from 'framer-motion'

export default function EmptyState({ onAdd }) {
  return (
    <motion.div
      className="card p-8 text-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mx-auto h-12 w-12 rounded-2xl bg-accent-dim grid place-items-center text-xl">
        🛬
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">No stays yet</h2>
      <p className="mt-2 text-sm text-fog-500 leading-relaxed">
        Add your first Schengen stay and this page will show exactly how many of your
        90 days you have used in any rolling 180-day window.
      </p>
      <p className="mt-3 text-xs text-fog-700 leading-relaxed">
        No account. No internet needed. Everything stays on this device — an account is
        optional and only adds sync between devices and sharing with a partner.
      </p>
      <button
        onClick={onAdd}
        className="mt-5 w-full sm:w-auto px-5 py-3 rounded-xl2 bg-accent text-ink-950
                   font-semibold active:scale-[0.98] transition"
      >
        Add your first stay
      </button>
    </motion.div>
  )
}
