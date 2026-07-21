import { motion } from 'framer-motion'

const TABS = [
  { id: 'tracker', label: 'Tracker', icon: '📈' },
  { id: 'partners', label: 'Partners', icon: '👥' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function TabBar({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-ink-700 bg-ink-950/90 backdrop-blur safe-b">
      <div className="max-w-2xl mx-auto grid grid-cols-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={active === t.id}
            className="relative py-3 flex flex-col items-center gap-1 text-[11px] tracking-wide"
          >
            {active === t.id && (
              <motion.span
                layoutId="tab-underline"
                className="absolute top-0 h-0.5 w-10 rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className={active === t.id ? 'opacity-100' : 'opacity-50'}>{t.icon}</span>
            <span className={active === t.id ? 'text-fog-100' : 'text-fog-700'}>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
