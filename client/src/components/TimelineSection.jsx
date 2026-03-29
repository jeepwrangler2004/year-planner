import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  addDays, subDays, format, isSameDay, isToday,
  startOfDay, parseISO, isBefore, isAfter, differenceInDays,
} from 'date-fns'
import { useStore, getCategoryMeta } from '../store/useStore'
import { MapPin, Plus, PlaneTakeoff, ArrowUp, ArrowDown, Clock } from 'lucide-react'
import { locationLabel, hasRoute } from '../utils/locationDisplay'

const PRELOAD_EVENTS  = 5   // events to guarantee visible on each side of today at first render
const FALLBACK_PAST   = 30  // days to fall back to if fewer than PRELOAD_EVENTS exist in the past
const FALLBACK_FUTURE = 90  // days to fall back to if fewer than PRELOAD_EVENTS exist in the future
const LOAD_MORE_DAYS  = 30  // days added per sentinel trigger

function computeInitialWindow() {
  const today  = startOfDay(new Date())
  const events = useStore.getState().events

  const past = events
    .filter(e => isBefore(startOfDay(parseISO(e.startDate)), today))
    .sort((a, b) => parseISO(b.startDate) - parseISO(a.startDate))

  const future = events
    .filter(e => !isBefore(startOfDay(parseISO(e.startDate)), today))
    .sort((a, b) => parseISO(a.startDate) - parseISO(b.startDate))

  const pastAnchor   = past[PRELOAD_EVENTS - 1]
  const futureAnchor = future[PRELOAD_EVENTS - 1]

  const windowStart = pastAnchor
    ? subDays(startOfDay(parseISO(pastAnchor.startDate)), 1)
    : subDays(today, FALLBACK_PAST)

  const windowEnd = futureAnchor
    ? addDays(startOfDay(parseISO(futureAnchor.startDate)), 1)
    : addDays(today, FALLBACK_FUTURE)

  return { windowStart, windowEnd }
}

function getScrollParent(el) {
  let parent = el?.parentElement
  while (parent) {
    const oy = window.getComputedStyle(parent).overflowY
    if (oy === 'auto' || oy === 'scroll') return parent
    parent = parent.parentElement
  }
  return document.documentElement
}

function buildGroups(events, windowStart, windowEnd) {
  const today    = startOfDay(new Date())
  const byDate   = new Map()

  events.forEach(e => {
    const d = startOfDay(parseISO(e.startDate))
    if (isBefore(d, windowStart) || isAfter(d, windowEnd)) return
    const key = format(d, 'yyyy-MM-dd')
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key).push(e)
  })

  const uniqueDates = [...byDate.keys()].sort()
  const todayKey = format(today, 'yyyy-MM-dd')
  if (!uniqueDates.includes(todayKey)) {
    uniqueDates.push(todayKey)
    uniqueDates.sort()
  }

  const groups    = []
  let   lastYear  = null
  let   lastMonth = null

  uniqueDates.forEach(dateKey => {
    const cur = parseISO(dateKey)
    const yearKey   = format(cur, 'yyyy')
    const monthKey  = format(cur, 'yyyy-MM')
    const dayEvents = byDate.get(dateKey) || []
    const todayDay  = isToday(cur)

    if (yearKey !== lastYear) {
      groups.push({ type: 'year', label: yearKey, key: `year-${yearKey}` })
      lastYear = yearKey
    }

    if (monthKey !== lastMonth) {
      groups.push({ type: 'month', label: format(cur, 'MMMM yyyy'), key: `month-${monthKey}` })
      lastMonth = monthKey
    }

    groups.push({
      type:   'day',
      date:   new Date(cur),
      events: dayEvents,
      isToday: todayDay,
      isPast:  isBefore(cur, today) && !todayDay,
      key:    dateKey,
    })
  })

  return groups
}

function EventCard({ event, onTap, index }) {
  const meta     = getCategoryMeta(event.category)
  const today    = startOfDay(new Date())
  const daysAway = differenceInDays(parseISO(event.startDate), today)
  const isPast   = daysAway < 0
  const isRange  = event.endDate && !isSameDay(parseISO(event.startDate), parseISO(event.endDate))

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.02, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onTap(event)}
      className="rounded-2xl p-3.5 cursor-pointer relative overflow-hidden mb-2"
      style={{ background: 'var(--bg-card)', borderLeft: `3px solid ${meta.cssVar}`, opacity: isPast ? 0.6 : 1 }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(circle at 95% 50%, ${meta.cssVar}18, transparent 55%)` }} />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <span className="text-lg mt-px leading-none">{meta.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
              {event.title}
            </p>
            {event.subtitle && (
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                {event.subtitle.length > 50 ? event.subtitle.slice(0, 50) + '…' : event.subtitle}
              </p>
            )}
            {(event.location || event.origin) && (
              <p className="text-xs mt-0.5 flex items-center gap-1 truncate" style={{ color: 'var(--text-muted)' }}>
                {hasRoute(event) ? <PlaneTakeoff size={10} className="flex-shrink-0" /> : <MapPin size={10} className="flex-shrink-0" />}
                {locationLabel(event)}
                {hasRoute(event) && event.flightNumber && <span className="ml-1 opacity-75">{event.flightNumber}</span>}
              </p>
            )}
            {event.time && (
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <Clock size={10} />{event.time}
              </p>
            )}
            {isRange && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                → {format(parseISO(event.endDate), 'MMM d')}
              </p>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 self-center">
          {isPast ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>past</span>
          ) : daysAway === 0 ? (
            <span className="text-xs font-bold font-counter" style={{ color: meta.cssVar }}>today</span>
          ) : (
            <span className="text-sm font-bold font-counter" style={{ color: meta.cssVar }}>{daysAway}d</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function TimelineSection({ onEventTap, onAddWithDate }) {
  const events = useStore(s => s.events)
  const today = startOfDay(new Date())

  const initWindowRef = useRef(null)
  if (!initWindowRef.current) initWindowRef.current = computeInitialWindow()

  const [windowStart, setWindowStart] = useState(() => initWindowRef.current.windowStart)
  const [windowEnd,   setWindowEnd]   = useState(() => initWindowRef.current.windowEnd)
  const [loadingPast, setLoadingPast] = useState(false)
  const [loadingFuture, setLoadingFuture] = useState(false)
  const [hasMorePast, setHasMorePast] = useState(true)
  const [hasMoreFuture, setHasMoreFuture] = useState(true)
  const [todayArrow,  setTodayArrow]  = useState(null)

  const topSentinelRef    = useRef(null)
  const bottomSentinelRef = useRef(null)
  const scrollParentRef   = useRef(null)
  const todayRef          = useRef(null)
  const isPrepending      = useRef(false)
  const savedScroll       = useRef({ scrollHeight: 0, scrollTop: 0 })
  const hapticFiredRef    = useRef(false)
  const loadingRef        = useRef(false)

  const scrollToToday = useCallback(() => {
    todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  useEffect(() => {
    if (topSentinelRef.current) {
      scrollParentRef.current = getScrollParent(topSentinelRef.current)
    }
    const container = scrollParentRef.current
    if (!container) return

    // Disable browser's built-in scroll anchoring — we do it manually
    container.style.overflowAnchor = 'none'

    const updateArrow = () => {
      if (!todayRef.current) return
      const rect  = todayRef.current.getBoundingClientRect()
      const viewH = window.innerHeight
      if (rect.bottom < 120)           setTodayArrow('up')
      else if (rect.top > viewH - 120) setTodayArrow('down')
      else                             setTodayArrow(null)

      const todayCentre = rect.top + rect.height / 2
      const viewCentre  = viewH / 2
      const isCentred   = Math.abs(todayCentre - viewCentre) < viewH * 0.15
      if (isCentred && !hapticFiredRef.current) {
        hapticFiredRef.current = true
        navigator.vibrate?.(12)
      } else if (!isCentred) {
        hapticFiredRef.current = false
      }
    }

    updateArrow()
    container.addEventListener('scroll', updateArrow, { passive: true })
    return () => container.removeEventListener('scroll', updateArrow)
  }, [])

  const groups = useMemo(
    () => buildGroups(events, windowStart, windowEnd),
    [events, windowStart, windowEnd]
  )

  // ── Scroll preservation after prepend ─────────────────────────────────────
  // Key insight: useLayoutEffect fires synchronously BEFORE the browser paints.
  // Correcting scrollTop here means the user never sees the jump.
  // The old code used requestAnimationFrame inside useLayoutEffect which pushed
  // the correction to AFTER 2 paint frames — visible jank for 2 frames.
  useLayoutEffect(() => {
    if (!isPrepending.current) return
    isPrepending.current = false
    const container = scrollParentRef.current
    if (!container) return

    // Synchronously correct scroll before browser paints.
    // Any height added by prepended content must be added to scrollTop
    // so the user's viewport position stays stable.
    const delta = container.scrollHeight - savedScroll.current.scrollHeight
    if (delta > 0) {
      container.scrollTop = savedScroll.current.scrollTop + delta
    }

    // Clear loading state. This triggers another render, but scroll is
    // already pinned above so no jank occurs.
    setLoadingPast(false)
  })

  // ── Clear future loading state once windowEnd grows ───────────────────────
  // Bug fix: setLoadingFuture(false) was never called, leaving the future
  // spinner stuck on screen permanently after the first load trigger.
  const prevWindowEndRef = useRef(windowEnd)
  useEffect(() => {
    if (windowEnd !== prevWindowEndRef.current) {
      prevWindowEndRef.current = windowEnd
      setLoadingFuture(false)
      loadingRef.current = false
    }
  }, [windowEnd])

  const loadMorePast = useCallback(() => {
    if (!hasMorePast || loadingPast || loadingRef.current) return
    loadingRef.current = true

    const container = scrollParentRef.current
    if (!container) return

    const earliestEvent = events
      .filter(e => isBefore(startOfDay(parseISO(e.startDate)), windowStart))
      .sort((a, b) => parseISO(a.startDate) - parseISO(b.startDate))[0]

    if (!earliestEvent) {
      setHasMorePast(false)
      loadingRef.current = false
      return
    }

    // Capture metrics BEFORE state updates so useLayoutEffect can compute delta
    savedScroll.current = {
      scrollHeight: container.scrollHeight,
      scrollTop:    container.scrollTop,
    }
    isPrepending.current = true
    setLoadingPast(true)
    setWindowStart(prev => subDays(prev, LOAD_MORE_DAYS))
    // Safety fallback in case useLayoutEffect doesn't fire as expected
    setTimeout(() => { loadingRef.current = false }, 500)
  }, [hasMorePast, loadingPast, events, windowStart])

  const loadMoreFuture = useCallback(() => {
    if (!hasMoreFuture || loadingFuture || loadingRef.current) return
    loadingRef.current = true

    const latestEvent = events
      .filter(e => isAfter(startOfDay(parseISO(e.startDate)), windowEnd))
      .sort((a, b) => parseISO(b.startDate) - parseISO(a.startDate))[0]

    if (!latestEvent) {
      setHasMoreFuture(false)
      loadingRef.current = false
      return
    }

    setLoadingFuture(true)
    setWindowEnd(prev => addDays(prev, LOAD_MORE_DAYS))
    // loadingRef + loadingFuture cleared by prevWindowEndRef effect
    setTimeout(() => { loadingRef.current = false }, 500)
  }, [hasMoreFuture, loadingFuture, events, windowEnd])

  // ── IntersectionObserver ───────────────────────────────────────────────────
  // bottomSentinelRef is now a stable always-rendered 1px div (separate from
  // the loading spinner), so the observer target never disappears mid-load.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (!e.isIntersecting) return
          if (e.target === topSentinelRef.current)    loadMorePast()
          if (e.target === bottomSentinelRef.current) loadMoreFuture()
        })
      },
      { rootMargin: '200px' }
    )
    if (topSentinelRef.current)    obs.observe(topSentinelRef.current)
    if (bottomSentinelRef.current) obs.observe(bottomSentinelRef.current)
    return () => obs.disconnect()
  }, [loadMorePast, loadMoreFuture])

  return (
    <div className="pb-4" style={{ overflowAnchor: 'none' }}>

      {/* Section header */}
      <div className="flex items-center justify-between px-4 mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Timeline
        </p>
        <button
          onClick={() => onAddWithDate(format(today, 'yyyy-MM-dd'))}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
        >
          <Plus size={11} />Add
        </button>
      </div>

      {/* Past-load spinner — minHeight prevents layout shift */}
      <div className="flex justify-center" style={{ minHeight: 48 }}>
        <AnimatePresence>
          {loadingPast && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading older events…</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Top sentinel — always a stable 1px element */}
      <div ref={topSentinelRef} className="h-1" />

      {!hasMorePast && groups.length > 0 && (
        <div className="px-4 py-2 text-center">
          <span className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>No more events</span>
        </div>
      )}

      {/* Timeline body */}
      <div className="relative px-4">
        <div className="absolute top-0 bottom-0 w-px" style={{ left: 28, background: 'var(--border)' }} />

        {groups.map((group) => {
          if (group.type === 'year') {
            return (
              <div key={group.key} className="relative py-6 my-2">
                <div className="absolute left-0 right-0 top-1/2 h-px" style={{ background: 'var(--border)', opacity: 0.5 }} />
                <div className="relative flex justify-center">
                  <span className="px-6 py-1.5 rounded-full text-sm font-bold font-counter"
                    style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    {group.label}
                  </span>
                </div>
              </div>
            )
          }

          if (group.type === 'month') {
            return (
              <div key={group.key} className="relative flex items-center py-2 my-1">
                <div className="absolute left-9 right-4 top-1/2 h-px" style={{ background: 'var(--border)', opacity: 0.3 }} />
                <div className="w-8 h-8 rounded-full flex items-center justify-center z-10 flex-shrink-0"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                    {group.label.slice(0, 3)}
                  </span>
                </div>
                <p className="ml-3 text-xs font-semibold tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                  {group.label}
                </p>
              </div>
            )
          }

          const { isToday: todayRow, isPast, date, events: dayEvents } = group

          if (todayRow) {
            return (
              <div key={group.key} ref={todayRef} className="relative pb-5">
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="rounded-3xl relative overflow-hidden"
                  style={{ background: 'var(--bg-card)', border: '1.5px solid oklch(0.82 0.16 75 / 0.45)', boxShadow: '0 0 36px oklch(0.82 0.16 75 / 0.13)' }}
                >
                  <div className="absolute inset-0 pointer-events-none" style={{
                    background: 'radial-gradient(ellipse at 50% -10%, oklch(0.82 0.16 75 / 0.20) 0%, transparent 65%)',
                  }} />
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{
                    background: 'linear-gradient(90deg, transparent, oklch(0.82 0.16 75 / 0.9), transparent)',
                  }} />
                  <div className="relative p-5">
                    <div className="flex flex-col items-center mb-4">
                      <div className="relative mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }} />
                        <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'var(--accent)', opacity: 0.35 }} />
                      </div>
                      <p className="font-counter font-black text-2xl leading-none" style={{ color: 'var(--accent)' }}>Today</p>
                      <p className="text-sm mt-1" style={{ color: 'oklch(0.65 0.08 75)' }}>{format(date, 'EEEE, MMMM d')}</p>
                    </div>
                    {dayEvents.length > 0 ? (
                      <div className="space-y-2">
                        {dayEvents.map((event, j) => <EventCard key={event.id} event={event} onTap={onEventTap} index={j} />)}
                      </div>
                    ) : (
                      <div className="rounded-2xl px-4 py-3 text-sm text-center"
                        style={{ background: 'oklch(0.82 0.16 75 / 0.06)', border: '1px dashed oklch(0.82 0.16 75 / 0.25)', color: 'var(--text-muted)' }}>
                        Nothing on the books today
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )
          }

          const dayLabel = format(date, 'EEE d')
          return (
            <div key={group.key} className="relative flex gap-3 pb-1">
              <div className="flex-shrink-0 w-9 flex flex-col items-center pt-1">
                <div className="w-3 h-3 rounded-full z-10"
                  style={{ background: 'var(--bg-card)', border: `2px solid ${isPast ? 'var(--text-muted)' : 'var(--border)'}` }} />
              </div>
              <div className="flex-1 min-w-0 pb-3">
                <p className="text-xs font-semibold mb-2" style={{ color: isPast ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                  {dayLabel}
                </p>
                {dayEvents.map((event, j) => <EventCard key={event.id} event={event} onTap={onEventTap} index={j} />)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom sentinel — ALWAYS a stable 1px div so IntersectionObserver
          target never disappears when loading state changes */}
      <div ref={bottomSentinelRef} className="h-1 mx-4" />

      {/* Bottom load indicator — visually separate from the sentinel */}
      <div className="mx-4 flex justify-center py-4">
        {loadingFuture ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading more events…</span>
          </motion.div>
        ) : !hasMoreFuture ? (
          <span className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>No more events</span>
        ) : null}
      </div>

      {/* Today arrow — fixed above nav */}
      <AnimatePresence>
        {todayArrow && (
          <motion.button
            initial={{ opacity: 0, y: todayArrow === 'down' ? 16 : -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: todayArrow === 'down' ? 16 : -16, scale: 0.9 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            whileTap={{ scale: 0.91 }}
            onClick={scrollToToday}
            className="fixed left-1/2 z-40 flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm"
            style={{
              transform: 'translateX(-50%)',
              bottom:    'calc(var(--nav-height) + 14px)',
              background: 'var(--accent)',
              color:      'var(--bg-base)',
              boxShadow:  '0 4px 24px oklch(0.82 0.16 75 / 0.55)',
            }}
          >
            {todayArrow === 'up' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            Today
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
