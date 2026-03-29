import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { parseISO, isAfter, isBefore, startOfDay } from 'date-fns'


export const CATEGORIES = [
  { id: 'travel',    label: 'Travel',    emoji: '✈️',  cssVar: 'var(--cat-travel)' },
  { id: 'music',     label: 'Music',     emoji: '🎵',  cssVar: 'var(--cat-music)' },
  { id: 'family',    label: 'Family',    emoji: '❤️',  cssVar: 'var(--cat-family)' },
  { id: 'food',      label: 'Food',      emoji: '🍽️',  cssVar: 'var(--cat-food)' },
  { id: 'wellness',  label: 'Wellness',  emoji: '🌿',  cssVar: 'var(--cat-wellness)' },
  { id: 'adventure', label: 'Adventure', emoji: '🧗',  cssVar: 'var(--cat-adventure)' },
  { id: 'other',     label: 'Other',     emoji: '✨',  cssVar: 'var(--cat-other)' },
]

export const getCategoryMeta = (id) =>
  CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1]

// Deterministic fingerprint for deduplication — title + date + sender
const fingerprint = (e) =>
  `${(e.title || '').trim().toLowerCase()}|${e.startDate || ''}|${(e.emailFrom || '').toLowerCase()}`

export const useStore = create(
  persist(
    (set, get) => ({
      events: [],
      inboxItems: [],  // email-sourced pending events
      gmailConnected: false,
      activeTab: 'home',
      lastScanMeta: null, // { range, found, scanned, completedAt, status }

      // --- Events ---
      addEvent: (event) => set(state => ({
        events: [...state.events, {
          ...event,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          source: event.source || 'manual',
        }]
      })),

      updateEvent: (id, updates) => set(state => ({
        events: state.events.map(e => e.id === id ? { ...e, ...updates } : e)
      })),

      deleteEvent: (id) => set(state => ({
        events: state.events.filter(e => e.id !== id)
      })),

      // --- Inbox ---
      addInboxItem: (item) => {
        const fp = fingerprint(item)
        const { events, inboxItems } = get()
        // Skip if already approved (in events) or already pending (in inbox)
        const isDupe = events.some(e => fingerprint(e) === fp) ||
                       inboxItems.some(e => fingerprint(e) === fp)
        if (isDupe) return
        set(state => ({ inboxItems: [...state.inboxItems, { ...item, id: crypto.randomUUID() }] }))
      },

      approveInboxItem: (id) => {
        const item = get().inboxItems.find(i => i.id === id)
        if (!item) return
        get().addEvent({ ...item, source: 'email' })
        set(state => ({ inboxItems: state.inboxItems.filter(i => i.id !== id) }))
      },

      approveAllInboxItems: () => {
        get().inboxItems.forEach(item => get().addEvent({ ...item, source: 'email' }))
        set({ inboxItems: [] })
      },

      dismissInboxItem: (id) => set(state => ({
        inboxItems: state.inboxItems.filter(i => i.id !== id)
      })),

      // Keep for explicit manual clear if ever needed
      clearInboxItems: () => set({ inboxItems: [] }),

      // Clears pending inbox + scan metadata (approved events untouched)
      resetInbox: () => set({ inboxItems: [], lastScanMeta: null }),

      // Nuclear — wipes everything back to first-launch state (preserves Gmail connection)
      fullReset: () => {
        localStorage.removeItem('thread-ingest-job')
        set({
          events: [],
          inboxItems: [],
          lastScanMeta: null,
          activeTab: 'home',
          // gmailConnected intentionally preserved — reconnecting Gmail is annoying
        })
      },

      // --- Scan metadata ---
      setLastScanMeta: (meta) => set({ lastScanMeta: meta }),

      // --- Gmail ---
      setGmailConnected: (val) => set({ gmailConnected: val }),

      // --- Nav ---
      setActiveTab: (tab) => set({ activeTab: tab }),

      // --- Derived helpers ---
      getUpcomingEvents: () => {
        const today = startOfDay(new Date())
        return get().events
          .filter(e => isAfter(parseISO(e.startDate), today) || 
                       (e.endDate && isAfter(parseISO(e.endDate), today)))
          .sort((a, b) => parseISO(a.startDate) - parseISO(b.startDate))
      },

      getNextEvent: () => {
        return get().getUpcomingEvents()[0] || null
      },

      getEventsByMonth: (year) => {
        const byMonth = {}
        for (let m = 0; m < 12; m++) byMonth[m] = []
        get().events.forEach(e => {
          const d = parseISO(e.startDate)
          if (d.getFullYear() === year) {
            byMonth[d.getMonth()].push(e)
          }
        })
        Object.values(byMonth).forEach(arr =>
          arr.sort((a, b) => parseISO(a.startDate) - parseISO(b.startDate))
        )
        return byMonth
      },

      getGapMonths: (year) => {
        const byMonth = get().getEventsByMonth(year)
        return Object.entries(byMonth)
          .filter(([, evts]) => evts.length === 0)
          .map(([m]) => parseInt(m))
      },
    }),
    {
      name: 'thread-storage',
      partialize: (state) => ({
        events: state.events,
        inboxItems: state.inboxItems,
        gmailConnected: state.gmailConnected,
        lastScanMeta: state.lastScanMeta,
      }),
    }
  )
)
