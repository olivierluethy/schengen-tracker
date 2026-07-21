import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { listStays, softDeleteStay, restoreStay } from '../../db/stays.js'
import { colorMap } from '../../engine/palette.js'
import EmptyState from '../common/EmptyState.jsx'
import Toast from '../common/Toast.jsx'
import StayList from '../stays/StayList.jsx'
import StayForm from '../stays/StayForm.jsx'
import { buildPresence, usageOn, remainingOn, statusOf } from '../../engine/schengen.js'
import { todayISO } from '../../engine/dates.js'
import SummaryTiles from '../graph/SummaryTiles.jsx'
import ComplianceGraph from '../graph/ComplianceGraph.jsx'

export default function TrackerScreen() {
  const stays = useLiveQuery(() => listStays(), [], null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)
  const [undo, setUndo] = useState(null)

  if (stays === null) return <div className="h-40 rounded-xl2 bg-ink-900 animate-pulse" />

  const colors = colorMap(stays)

  const today = todayISO()
  const used = usageOn(buildPresence(stays), today)
  const remaining = remainingOn(used)
  const status = statusOf(used)

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (stay) => { setEditing(stay); setFormOpen(true) }

  const remove = async (stay) => {
    await softDeleteStay(stay.id)
    setUndo(stay)
  }

  return (
    <div className="space-y-4">
      {stays.length === 0 ? (
        <EmptyState onAdd={openAdd} />
      ) : (
        <>
          <SummaryTiles used={used} remaining={remaining} status={status} />

          <ComplianceGraph
            stays={stays}
            colors={colors}
            highlightedId={highlightedId}
            onHighlight={setHighlightedId}
          />

          <section>
            <h2 className="text-xs uppercase tracking-widest text-fog-700 mb-2 px-1">
              Your stays
            </h2>
            <StayList
              stays={stays}
              colors={colors}
              highlightedId={highlightedId}
              onHighlight={setHighlightedId}
              onEdit={openEdit}
              onDelete={remove}
            />
          </section>
        </>
      )}

      {stays.length > 0 && (
        <motion.button
          onClick={openAdd}
          className="fixed right-5 bottom-24 z-40 h-14 w-14 rounded-full bg-accent text-ink-950
                     text-2xl font-light shadow-lift grid place-items-center"
          whileTap={{ scale: 0.92 }}
          aria-label="Add stay"
        >
          +
        </motion.button>
      )}

      <StayForm open={formOpen} stay={editing} onClose={() => setFormOpen(false)} />

      <Toast
        message={undo ? `Deleted “${undo.name}”` : null}
        actionLabel="Undo"
        onAction={async () => { await restoreStay(undo.id); setUndo(null) }}
        onDismiss={() => setUndo(null)}
      />
    </div>
  )
}
