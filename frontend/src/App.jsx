import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import TabBar from './ui/common/TabBar.jsx'
import { TABS } from './ui/common/navItems.js'
import SideNav from './ui/common/SideNav.jsx'
import SyncPill from './ui/common/SyncPill.jsx'
import TrackerScreen from './ui/screens/TrackerScreen.jsx'
import PartnersScreen from './ui/screens/PartnersScreen.jsx'
import SettingsScreen from './ui/screens/SettingsScreen.jsx'
import { useSync } from './sync/useSync.js'

const SCREENS = {
  tracker: TrackerScreen,
  partners: PartnersScreen,
  settings: SettingsScreen,
}

export default function App() {
  const [tab, setTab] = useState('tracker')
  const { state, count } = useSync()
  const Screen = SCREENS[tab]
  const title = TABS.find((t) => t.id === tab)?.label

  return (
    <div className="min-h-screen bg-ink-950">
      <SideNav active={tab} onChange={setTab} syncState={state} syncCount={count} />

      {/* Phone header. On desktop the identity lives in the side nav instead. */}
      <header className="lg:hidden sticky top-0 z-30 bg-ink-950/85 backdrop-blur
                         border-b border-ink-800 safe-t">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <h1 className="heading text-base leading-none">Schengen</h1>
            <p className="stamp mt-1.5">90 days in any 180</p>
          </div>
          <SyncPill state={state} count={count} />
        </div>
      </header>

      <div className="lg:pl-60">
        {/* Desktop page header: names the section the way a desktop app does. */}
        <header className="hidden lg:flex items-end justify-between gap-6
                           max-w-[92rem] mx-auto px-8 pt-8 pb-5">
          <h2 className="heading text-2xl leading-none">{title}</h2>
          <div className="h-px flex-1 bg-ink-800 mb-1.5" />
        </header>

        <main className="max-w-2xl lg:max-w-[92rem] mx-auto px-4 lg:px-8 pt-4 lg:pt-0
                         pb-28 lg:pb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <Screen />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
