import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StayRow from './StayRow.jsx'

export default function StayList({ stays, colors, highlightedId, onHighlight, onEdit, onDelete }) {
  const [expandedId, setExpandedId] = useState(null)

  const toggle = (id, source) => {
    if (source === 'hover') return onHighlight(id)
    setExpandedId((cur) => (cur === id ? null : id))
    onHighlight(id)
  }

  return (
    <div
      className="space-y-2"
      onMouseLeave={() => onHighlight(null)}
    >
      <AnimatePresence initial={false}>
        {stays.map((s) => (
          <motion.div
            key={s.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
          >
            <StayRow
              stay={s}
              color={colors[s.id]}
              expanded={expandedId === s.id}
              highlighted={highlightedId === s.id}
              onToggle={toggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
