import { useRef, useState } from 'react'
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
import PdfScreen from './PdfScreen.jsx'

export default function TrackerScreen() {
  const stays = useLiveQuery(() => listStays(), [], null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)
  const [undo, setUndo] = useState(null)
  const chartWrapRef = useRef(null)
  const [pdfOpen, setPdfOpen] = useState(false)

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
    <div>
      {stays.length === 0 ? (
        <EmptyState onAdd={openAdd} />
      ) : (
        <>
          {/* The chart and its figures on the left; the stays that produce them
              on the right, where they double as the chart's legend. */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_23rem] xl:gap-6 xl:items-start">
            <div className="space-y-4">
              <SummaryTiles used={used} remaining={remaining} status={status} today={today} />

              {/* Nothing else in this wrapper may render an <svg>: the PDF
                  exporter serialises the first one it finds here. */}
              <div ref={chartWrapRef}>
                <ComplianceGraph
                  stays={stays}
                  colors={colors}
                  highlightedId={highlightedId}
                  onHighlight={setHighlightedId}
                />
              </div>

              <button onClick={() => setPdfOpen(true)} className="btn-quiet btn-lg w-full">
                Preview PDF report
              </button>
            </div>

            <div className="xl:sticky xl:top-8">
              <StayList
                stays={stays}
                colors={colors}
                highlightedId={highlightedId}
                onHighlight={setHighlightedId}
                onEdit={openEdit}
                onDelete={remove}
              />
            </div>
          </div>

          <motion.button
            onClick={openAdd}
            className="fixed right-5 bottom-24 lg:right-8 lg:bottom-8 z-40 h-14 w-14 rounded-full
                       bg-accent text-ink-950 text-2xl font-light shadow-pop grid place-items-center"
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.04 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            aria-label="Add stay"
          >
            +
          </motion.button>
        </>
      )}

      <StayForm open={formOpen} stay={editing} onClose={() => setFormOpen(false)} />

      <Toast
        message={undo ? `Deleted “${undo.name}”` : null}
        actionLabel="Undo"
        onAction={async () => { await restoreStay(undo.id); setUndo(null) }}
        onDismiss={() => setUndo(null)}
      />

      {pdfOpen && (
        <PdfScreen
          stays={stays}
          chartSvg={chartWrapRef.current?.querySelector('svg') || null}
          onClose={() => setPdfOpen(false)}
        />
      )}
    </div>
  )
}
