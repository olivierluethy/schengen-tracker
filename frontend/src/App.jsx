import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import TabBar from './ui/common/TabBar.jsx'
import SyncPill from './ui/common/SyncPill.jsx'
import TrackerScreen from './ui/screens/TrackerScreen.jsx'
import PartnersScreen from './ui/screens/PartnersScreen.jsx'
import SettingsScreen from './ui/screens/SettingsScreen.jsx'
import { useOnline } from './sync/useOnline.js'

const SCREENS = {
  tracker: TrackerScreen,
  partners: PartnersScreen,
  settings: SettingsScreen,
}

export default function App() {
  const [tab, setTab] = useState('tracker')
  const online = useOnline()
  const Screen = SCREENS[tab]

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="sticky top-0 z-30 bg-ink-950/85 backdrop-blur border-b border-ink-800 safe-t">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight leading-none">Schengen</h1>
            <p className="text-[11px] text-fog-700 leading-none mt-1">90 days in any 180</p>
          </div>
          <SyncPill state={online ? 'local' : 'offline'} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Screen />
          </motion.div>
        </AnimatePresence>
      </main>

      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
