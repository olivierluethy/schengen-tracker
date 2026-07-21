import { motion } from 'framer-motion'
import SyncPill from './SyncPill.jsx'
import { TABS } from './navItems.js'

/**
 * Desktop navigation. The bottom tab bar stays exactly as it is on phones;
 * from lg up the app reads as a desktop application instead of a stretched
 * phone screen.
 */
export default function SideNav({ active, onChange, syncState, syncCount }) {
  return (
    <nav className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-60 flex-col
                    border-r border-ink-800 bg-ink-925 px-4 py-6">
      <div className="px-2">
        <h1 className="heading text-lg leading-none">Schengen</h1>
        <p className="stamp mt-2">90 days in any 180</p>
      </div>

      <div className="mt-8 space-y-1">
        {TABS.map((t) => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm
                          transition-colors ${
                isActive ? 'text-fog-100' : 'text-fog-500 hover:text-fog-100 hover:bg-ink-900'}`}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl bg-ink-850 border border-ink-700"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <span className={`relative text-base ${isActive ? '' : 'opacity-60'}`}>{t.icon}</span>
              <span className="relative">{t.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-auto px-1">
        <SyncPill state={syncState} count={syncCount} />
      </div>
    </nav>
  )
}
