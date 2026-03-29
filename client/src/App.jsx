import { apiUrl } from "./api.js"
import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from './store/useStore'
import { useIngestion } from './hooks/useIngestion'
import BottomNav from './components/BottomNav'
import AddEventSheet from './components/AddEventSheet'
import HomeView from './views/HomeView'
import YearView from './views/YearView'
import InboxView from './views/InboxView'
import EventDetailView from './views/EventDetailView'
import DebugView from './views/DebugView'

const views = {
  home: HomeView,
  year: YearView,
  inbox: InboxView,
  debug: DebugView,
}

export default function App() {
  const activeTab = useStore(s => s.activeTab)
  const setActiveTab = useStore(s => s.setActiveTab)
  const setGmailConnected = useStore(s => s.setGmailConnected)
  const addInboxItem = useStore(s => s.addInboxItem)
  const clearInboxItems = useStore(s => s.clearInboxItems)
  const setLastScanMeta = useStore(s => s.setLastScanMeta)
  const currentRangeRef = useRef(null)
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [prefillDate, setPrefillDate] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [session, setSession] = useState(() => localStorage.getItem('thread-session'))
  const [toast, setToast] = useState(null) // { type: 'success'|'error', message }

  const showToast = useCallback((type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 5000)
  }, [])

  const { isRunning, scanned, found, startIngestion, cancelIngestion } = useIngestion({
    // Stream events to inbox as they arrive — switch to inbox tab on first hit
    onProgress: useCallback((newEvents) => {
      // Client-side denylist — specific promo senders from otherwise-useful domains
      const PROMO_SENDERS = [
        'emails@songkick.com',
        'discover@airbnb.com',
      ]
      const filtered = newEvents.filter(e => {
        const from = (e.emailFrom || '').toLowerCase()
        return !PROMO_SENDERS.some(promo => from.includes(promo))
      })
      filtered.forEach(e => addInboxItem(e))
      if (filtered.length > 0) setActiveTab('inbox')
    }, [addInboxItem, setActiveTab, setLastScanMeta]),
    // On completion: update scan metadata and show toast
    onComplete: useCallback((allEvents) => {
      setLastScanMeta(prev => ({
        ...prev,
        found: allEvents.length,
        completedAt: new Date().toISOString(),
        status: 'complete',
      }))
      showToast('success', `Found ${allEvents.length} event${allEvents.length !== 1 ? 's' : ''} in your inbox`)
    }, [showToast, setLastScanMeta]),
    onError: useCallback((msg) => {
      showToast('error', `Scan failed: ${msg}`)
    }, [showToast]),
  })

  // Verify session is still valid on mount (backend restarts wipe in-memory sessions)
  useEffect(() => {
    const sessionId = localStorage.getItem('thread-session')
    if (sessionId) {
      fetch(apiUrl(`/auth/status?session=${sessionId}`))
        .then(r => r.json())
        .then(data => {
          if (!data.connected) {
            setGmailConnected(false)
            setSession(null)
            localStorage.removeItem('thread-session')
          }
        })
        .catch(() => { /* backend unreachable — leave state as-is */ })
    }
  }, [])

  // Handle OAuth callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const sessionId = params.get('session')

    if (connected === 'true' && sessionId) {
      setGmailConnected(true)
      localStorage.setItem('thread-session', sessionId)
      setSession(sessionId)
      setActiveTab('inbox')
      // Clean URL — don't auto-sync, let the user pick a year range
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const openAdd = (date = null) => {
    setPrefillDate(date)
    setAddSheetOpen(true)
  }

  const ActiveView = views[activeTab] || HomeView

  return (
    <div className="flex flex-col h-dvh" style={{ background: 'var(--bg-base)' }}>
      {/* Main view area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0"
          >
            <ActiveView
              onEventTap={setSelectedEvent}
              onAddWithDate={openAdd}
              session={session}
              onStartIngestion={(sinceDate, beforeDate) => {
                if (!session) {
                  showToast('error', 'Session expired — reconnecting Gmail…')
                  setTimeout(() => { window.location.href = (import.meta.env.VITE_BACKEND_URL || '') + '/auth/google' }, 1200)
                  return
                }
                const year = sinceDate ? sinceDate.slice(0, 4) : '?'
                currentRangeRef.current = year
                setLastScanMeta({ range: year, status: 'running', startedAt: new Date().toISOString(), found: 0, scanned: 0 })
                startIngestion(session, sinceDate, beforeDate)
              }}
              isIngesting={isRunning}
            />
          </motion.div>
        </AnimatePresence>

        {/* Event Detail overlay */}
        <AnimatePresence>
          {selectedEvent && (
            <EventDetailView
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
              onEdit={(event) => {
                setSelectedEvent(null)
                // TODO: open edit sheet
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Ingestion progress banner */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
          >
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Scanning your inbox…
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {scanned} emails checked · {found} event{found !== 1 ? 's' : ''} found so far
              </p>
            </div>
            <button
              onClick={cancelIngestion}
              className="text-xs px-3 py-1.5 rounded-full flex-shrink-0"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{
              background: toast.type === 'success' ? '#1a3a2a' : '#3a1a1a',
              border: `1px solid ${toast.type === 'success' ? '#2d6a4f' : '#6a2d2d'}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <span className="text-lg">{toast.type === 'success' ? '✅' : '❌'}</span>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{toast.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Nav */}
      <BottomNav onAdd={() => openAdd()} />

      {/* Add Event Sheet */}
      <AddEventSheet
        open={addSheetOpen}
        onClose={() => { setAddSheetOpen(false); setPrefillDate(null) }}
        prefillDate={prefillDate}
      />
    </div>
  )
}
