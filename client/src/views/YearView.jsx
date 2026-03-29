import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { parseISO } from 'date-fns'
import { useStore } from '../store/useStore'
import TimelineSection from '../components/TimelineSection'

export default function YearView({ onEventTap, onAddWithDate }) {
  const year   = new Date().getFullYear()
  const events = useStore(s => s.events)

  const totalEvents = useMemo(
    () => events.filter(e => parseISO(e.startDate).getFullYear() === year).length,
    [events, year]
  )

  return (
    <div className="scroll-area">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-baseline justify-between px-4 mb-6"
      >
        <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>
          {year}
        </h1>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {totalEvents} {totalEvents === 1 ? 'event' : 'events'}
        </span>
      </motion.div>

      {/* Infinite scroll timeline */}
      <TimelineSection onEventTap={onEventTap} onAddWithDate={onAddWithDate} />
    </div>
  )
}
