import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, differenceInDays, isSameDay } from 'date-fns'
import { ArrowLeft, MapPin, Pencil, Trash2, Mail, PlaneTakeoff } from 'lucide-react'
import { locationLabel, hasRoute } from '../utils/locationDisplay'
import { useStore, getCategoryMeta } from '../store/useStore'

export default function EventDetailView({ event, onClose, onEdit }) {
  const deleteEvent = useStore(s => s.deleteEvent)
  if (!event) return null

  const meta = getCategoryMeta(event.category)
  const daysAway = differenceInDays(parseISO(event.startDate), new Date())
  const isPast = daysAway < 0
  const isToday = daysAway === 0
  const isRange = event.endDate && !isSameDay(parseISO(event.startDate), parseISO(event.endDate))

  const handleDelete = () => {
    deleteEvent(event.id)
    onClose()
  }

  return (
    <AnimatePresence>
      <motion.div
        key="detail"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 38 }}
        className="fixed inset-0 z-30 flex flex-col"
        style={{ background: 'var(--bg-base)' }}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <ArrowLeft size={20} />
            <span className="text-sm">Back</span>
          </motion.button>
          <div className="flex gap-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => onEdit(event)} style={{ color: 'var(--text-muted)' }}>
              <Pencil size={18} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={handleDelete} style={{ color: 'var(--cat-family)' }}>
              <Trash2 size={18} />
            </motion.button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-8 pb-12">
          {/* Category + icon */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="text-6xl mb-4">{meta.emoji}</div>

            <h1 className="font-display text-3xl mb-1" style={{ color: 'var(--text-primary)' }}>
              {event.title}
            </h1>
            <p className="text-sm mb-6" style={{ color: meta.cssVar }}>
              {meta.label}
            </p>
          </motion.div>

          {/* Countdown chip */}
          {!isPast && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 mb-6"
              style={{ background: `${meta.cssVar}22`, border: `1px solid ${meta.cssVar}44` }}
            >
              <span className="font-counter font-bold text-2xl" style={{ color: meta.cssVar }}>
                {isToday ? '🎉 Today!' : `${daysAway} days away`}
              </span>
            </motion.div>
          )}

          {/* Details card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl p-4 mb-4"
            style={{ background: 'var(--bg-card)' }}
          >
            <div className="flex items-center gap-3 py-2">
              <span className="text-base" style={{ color: 'var(--text-muted)' }}>📅</span>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {format(parseISO(event.startDate), 'EEEE, MMMM d, yyyy')}
                </p>
                {isRange && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    → {format(parseISO(event.endDate), 'EEEE, MMMM d')}
                  </p>
                )}
              </div>
            </div>

            {(event.location || event.origin) && (
              <>
                <div className="h-px my-1" style={{ background: 'var(--border-subtle)' }} />
                <div className="flex items-center gap-3 py-2">
                  {hasRoute(event)
                    ? <PlaneTakeoff size={16} style={{ color: 'var(--text-muted)' }} />
                    : <MapPin size={16} style={{ color: 'var(--text-muted)' }} />}
                  {hasRoute(event) ? (
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {event.origin} → {event.location}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      {locationLabel(event)}
                    </p>
                  )}
                </div>
              </>
            )}
          </motion.div>

          {/* Notes */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-4"
          >
            <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
              Notes
            </p>
            <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', minHeight: 72 }}>
              <p className="text-sm" style={{ color: event.notes ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {event.notes || 'Tap to add notes...'}
              </p>
            </div>
          </motion.div>

          {/* Source */}
          {event.source === 'email' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="flex items-center gap-2 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              <Mail size={12} />
              <span>Auto-detected from email</span>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
