import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  differenceInDays, parseISO, getDayOfYear,
  format, isSameDay, startOfDay, isAfter,
} from 'date-fns'
import { useStore, getCategoryMeta } from '../store/useStore'
import { MapPin, ChevronRight, Sparkles } from 'lucide-react'

const TOTAL_DAYS = 365
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── CountdownHero ────────────────────────────────────────────────────────────

function CountdownHero({ event, onTap }) {
  const meta     = getCategoryMeta(event.category)
  const daysAway = differenceInDays(parseISO(event.startDate), new Date())
  const isToday  = daysAway <= 0
  const isRange  = event.endDate && !isSameDay(parseISO(event.startDate), parseISO(event.endDate))

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileTap={{ scale: 0.975 }}
      onClick={onTap}
      className="mx-4 mb-6 rounded-3xl cursor-pointer relative overflow-hidden"
      style={{ background: 'var(--bg-card)', minHeight: 200 }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 70% 30%, ${meta.cssVar}28 0%, transparent 70%)` }}
      />
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-full"
        style={{ background: `linear-gradient(90deg, ${meta.cssVar}, transparent)` }}
      />

      <div className="relative p-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: `${meta.cssVar}20`, color: meta.cssVar }}
          >
            <span>{meta.emoji}</span>
            <span className="uppercase tracking-wider">{meta.label}</span>
          </div>
          <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
        </div>

        <h2 className="font-display text-2xl leading-tight mb-4" style={{ color: 'var(--text-primary)' }}>
          {event.title}
        </h2>

        <div className="flex items-baseline gap-2 mb-3">
          {isToday ? (
            <span className="font-counter font-black text-5xl" style={{ color: meta.cssVar }}>
              Today! 🎉
            </span>
          ) : (
            <>
              <span
                className="font-counter font-black leading-none"
                style={{ color: meta.cssVar, fontSize: daysAway > 99 ? '4.5rem' : '5.5rem', lineHeight: 1 }}
              >
                {daysAway}
              </span>
              <span className="text-xl font-medium" style={{ color: 'var(--text-secondary)' }}>
                {daysAway === 1 ? 'day' : 'days'} away
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span>
            {format(parseISO(event.startDate), 'MMM d')}
            {isRange ? ` – ${format(parseISO(event.endDate), 'MMM d')}` : ''}
          </span>
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {event.location}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── UpcomingStrip ────────────────────────────────────────────────────────────

function UpcomingStrip({ events, onEventTap }) {
  return (
    <div className="mb-6">
      <p
        className="text-xs font-semibold uppercase tracking-widest mx-4 mb-3"
        style={{ color: 'var(--text-muted)' }}
      >
        Coming Up
      </p>
      <div className="flex gap-3 px-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {events.map((event, i) => {
          const meta     = getCategoryMeta(event.category)
          const daysAway = differenceInDays(parseISO(event.startDate), new Date())
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07, duration: 0.35 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => onEventTap(event)}
              className="flex-shrink-0 rounded-2xl p-3.5 cursor-pointer relative overflow-hidden"
              style={{
                background:  'var(--bg-card)',
                borderTop:   `3px solid ${meta.cssVar}`,
                width:       120,
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(circle at 80% 20%, ${meta.cssVar}15, transparent 70%)` }}
              />
              <span className="text-2xl block mb-2">{meta.emoji}</span>
              <p
                className="text-xs font-semibold leading-tight mb-2 line-clamp-2"
                style={{ color: 'var(--text-primary)' }}
              >
                {event.title}
              </p>
              <div className="flex items-end justify-between">
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {format(parseISO(event.startDate), 'MMM d')}
                </p>
                {daysAway > 0 && (
                  <p className="text-xs font-bold font-counter" style={{ color: meta.cssVar }}>
                    {daysAway}d
                  </p>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─── YearProgress ─────────────────────────────────────────────────────────────

function YearProgress() {
  const dayOfYear = getDayOfYear(new Date())
  const pct       = Math.round((dayOfYear / TOTAL_DAYS) * 100)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="mx-4 mb-6 rounded-2xl p-4"
      style={{ background: 'var(--bg-card)' }}
    >
      <div className="flex justify-between items-center mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Year Progress
        </p>
        <p className="font-counter font-bold text-sm" style={{ color: 'var(--accent)' }}>
          {pct}%
        </p>
      </div>
      <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--bg-elevated)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, var(--accent), oklch(0.82 0.16 75 / 0.7))` }}
        />
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {format(new Date(), 'MMMM d')} · Day {dayOfYear} of {TOTAL_DAYS}
      </p>
    </motion.div>
  )
}

// ─── NudgeCards ───────────────────────────────────────────────────────────────

function NudgeCards({ gapMonths, onAdd }) {
  if (!gapMonths.length) return null
  const showing = gapMonths.slice(0, 2)

  return (
    <div className="mx-4 mb-6">
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
        Open Space
      </p>
      {showing.map((month, i) => (
        <motion.div
          key={month}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 + i * 0.1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onAdd(`${new Date().getFullYear()}-${String(month + 1).padStart(2, '0')}-15`)}
          className="flex items-center justify-between rounded-2xl px-4 py-4 mb-2 cursor-pointer"
          style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent-dim)' }}
            >
              <Sparkles size={14} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Nothing in {MONTHS[month]}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Add something to look forward to
              </p>
            </div>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        </motion.div>
      ))}
    </div>
  )
}

// ─── HomeView ─────────────────────────────────────────────────────────────────

export default function HomeView({ onEventTap, onAddWithDate }) {
  const events = useStore(s => s.events)

  const upcoming = useMemo(() => {
    const today = startOfDay(new Date())
    return events
      .filter(e =>
        isAfter(parseISO(e.startDate), today) ||
        (e.endDate && isAfter(parseISO(e.endDate), today))
      )
      .sort((a, b) => parseISO(a.startDate) - parseISO(b.startDate))
  }, [events])

  const nextEvent = useMemo(() => upcoming[0] || null, [upcoming])

  const gapMonths = useMemo(() => {
    const year   = new Date().getFullYear()
    const byMonth = {}
    for (let m = 0; m < 12; m++) byMonth[m] = []
    events.forEach(e => {
      const d = parseISO(e.startDate)
      if (d.getFullYear() === year) byMonth[d.getMonth()].push(e)
    })
    return Object.entries(byMonth)
      .filter(([, evts]) => evts.length === 0)
      .map(([m]) => parseInt(m))
  }, [events])

  return (
    <div className="scroll-area pt-4 pb-4">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-4 mb-5"
      >
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>
            IRL.FM
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {format(new Date(), 'EEEE, MMMM d')}
          </p>
        </div>
      </motion.div>

      {/* Next event hero */}
      {nextEvent ? (
        <CountdownHero event={nextEvent} onTap={() => onEventTap(nextEvent)} />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mx-4 mb-6 rounded-3xl p-8 text-center"
          style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)' }}
        >
          <p className="text-5xl mb-3">🗓️</p>
          <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Nothing planned yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Connect Gmail or add your first event</p>
        </motion.div>
      )}

      {/* Upcoming strip */}
      {upcoming.length > 1 && (
        <UpcomingStrip events={upcoming.slice(1, 7)} onEventTap={onEventTap} />
      )}

      {/* Year progress */}
      <YearProgress />

      {/* Gap month nudges */}
      <NudgeCards
        gapMonths={gapMonths.filter(m => m >= new Date().getMonth())}
        onAdd={onAddWithDate}
      />

    </div>
  )
}
