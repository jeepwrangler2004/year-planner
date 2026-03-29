import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { Check, X, Mail, RefreshCw, Zap, Trash2, RotateCcw, ExternalLink, PlaneTakeoff, CheckCheck } from 'lucide-react'
import { locationLabel, hasRoute } from '../utils/locationDisplay'
import { useStore, getCategoryMeta } from '../store/useStore'
import IngestAllButton from '../components/IngestAllButton'
import HistoricalYearButtons from '../components/HistoricalYearButtons'

function InboxCard({ item, onApprove, onDismiss }) {
  const meta = getCategoryMeta(item.category)
  const [leaving, setLeaving] = useState(null)

  const handleApprove = () => {
    setLeaving('approve')
    setTimeout(() => onApprove(item.id), 280)
  }
  const handleDismiss = () => {
    setLeaving('dismiss')
    setTimeout(() => onDismiss(item.id), 280)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{
        opacity: leaving ? 0 : 1,
        x: leaving === 'approve' ? 80 : leaving === 'dismiss' ? -80 : 0,
        y: leaving ? -8 : 0,
      }}
      transition={{ duration: 0.26 }}
      className="rounded-2xl overflow-hidden mb-3 relative"
      style={{ background: 'var(--bg-card)' }}
    >
      {/* Category accent + glow */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${meta.cssVar}, transparent 60%)` }} />
      <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none" style={{ background: `radial-gradient(circle at center, ${meta.cssVar}12, transparent 70%)` }} />

      <div className="relative p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${meta.cssVar}20` }}
            >
              <span className="text-xl">{meta.emoji}</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: meta.cssVar }}>
                {meta.label} Detected
              </p>
              <p className="font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
              {(item.location || item.origin) && (
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                {hasRoute(item)
                  ? <PlaneTakeoff size={11} className="flex-shrink-0" />
                  : null}
                {locationLabel(item)}
              </p>
            )}
            </div>
          </div>
        </div>

        {item.startDate && (
          <div className="flex items-center gap-2 mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>📅</span>
            <span>
              {format(parseISO(item.startDate), 'MMMM d, yyyy')}
              {item.endDate && item.endDate !== item.startDate
                ? ` – ${format(parseISO(item.endDate), 'MMMM d')}`
                : ''}
            </span>
          </div>
        )}

        {item.emailFrom && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 text-xs min-w-0" style={{ color: 'var(--text-muted)' }}>
              <Mail size={11} className="flex-shrink-0" />
              <span className="truncate">{item.emailFrom}</span>
            </div>
            {item.gmailId && (
              <motion.a
                href={`https://mail.google.com/mail/u/0/#all/${item.gmailId}`}
                target="_blank"
                rel="noopener noreferrer"
                whileTap={{ scale: 0.88 }}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg flex-shrink-0 ml-2"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                <ExternalLink size={10} />
                View
              </motion.a>
            )}
          </div>
        )}

        <div className="h-px mb-3" style={{ background: 'var(--border-subtle)' }} />

        <div className="flex gap-2.5">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleDismiss}
            className="flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            <X size={14} /> Dismiss
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleApprove}
            className="flex-[2] py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
            style={{ background: meta.cssVar, color: 'var(--bg-base)' }}
          >
            <Check size={14} /> Add to My Year
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

function ConnectGmail({ onConnect }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-4 mt-6"
    >
      {/* Hero illustration area */}
      <div
        className="rounded-3xl p-8 text-center mb-4 relative overflow-hidden"
        style={{ background: 'var(--bg-card)' }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, oklch(0.65 0.20 300 / 0.15), transparent 70%)' }} />

        <div className="relative">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="text-6xl">📧</div>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                className="absolute -right-2 -top-2 text-2xl"
              >
                ✨
              </motion.div>
            </div>
          </div>

          <h3 className="font-display text-2xl mb-2" style={{ color: 'var(--text-primary)' }}>
            Your year, auto-built
          </h3>
          <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
            Connect Gmail and IRL.FM finds your flights, concerts, hotels, and reservations — all in one timeline.
          </p>

          {/* Feature bullets */}
          {[
            { icon: '✈️', text: 'Flights & hotel bookings' },
            { icon: '🎵', text: 'Concert & event tickets' },
            { icon: '🍽️', text: 'Restaurant reservations' },
          ].map(f => (
            <div key={f.text} className="flex items-center gap-3 text-sm mb-2 text-left">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: 'var(--bg-elevated)' }}>
                {f.icon}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{f.text}</span>
              <span className="ml-auto text-xs" style={{ color: 'var(--cat-wellness)' }}>✓</span>
            </div>
          ))}
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onConnect}
        className="w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2"
        style={{
          background: 'var(--accent)',
          color: 'var(--bg-base)',
          boxShadow: '0 4px 24px oklch(0.82 0.16 75 / 0.35)',
        }}
      >
        <Zap size={18} />
        Connect Gmail
      </motion.button>
      <p className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>
        Read-only · We never store your emails
      </p>
    </motion.div>
  )
}

export default function InboxView({ onStartIngestion, isIngesting, session }) {
  const inboxItems           = useStore(s => s.inboxItems)
  const approveInboxItem     = useStore(s => s.approveInboxItem)
  const approveAllInboxItems = useStore(s => s.approveAllInboxItems)
  const dismissInboxItem     = useStore(s => s.dismissInboxItem)
  const gmailConnected = useStore(s => s.gmailConnected)
  const lastScanMeta = useStore(s => s.lastScanMeta)
  const resetInbox = useStore(s => s.resetInbox)
  const fullReset = useStore(s => s.fullReset)
  // confirmType: null | 'inbox' | 'full'
  const [confirmType, setConfirmType] = useState(null)

  const requestConfirm = (type) => {
    setConfirmType(type)
    setTimeout(() => setConfirmType(null), 3000)
  }
  const handleConfirm = () => {
    if (confirmType === 'inbox') resetInbox()
    if (confirmType === 'full') fullReset()
    setConfirmType(null)
  }

  const handleConnect = () => {
    window.location.href = (import.meta.env.VITE_BACKEND_URL || '') + '/auth/google'
  }

  // Handler for individual year ingestion (2012-2022)
  const handleIngestYear = (year) => {
    if (!session) {
      console.error('No session available')
      return
    }
    onStartIngestion(`${year}/01/01`, `${year}/12/31`)
  }

  // Handler for events found during ingest-all
  const handleEventsFound = (events) => {
    // Events are already handled by the parent's onProgress callback
    console.log(`Received ${events.length} events from ingest-all`)
  }

  const scanSummary = lastScanMeta && lastScanMeta.status === 'complete'
    ? `${lastScanMeta.range} · ${lastScanMeta.found} found · ${formatDistanceToNow(new Date(lastScanMeta.completedAt), { addSuffix: true })}`
    : null

  return (
    <div className="scroll-area pt-4 pb-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-4 mb-5"
      >
        {/* Row 1: title + year scan buttons */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>
            Inbox
          </h1>

          {gmailConnected && (
            isIngesting ? (
              <div className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-medium" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                <RefreshCw size={12} className="animate-spin" />
                Scanning…
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {inboxItems.length > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold mr-1" style={{ background: 'var(--cat-music)', color: '#fff' }}>
                    {inboxItems.length}
                  </span>
                )}
                {[2024, 2025, 2026].map(year => (
                  <motion.button
                    key={year}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => onStartIngestion(`${year}/01/01`, `${year}/12/31`)}
                    className="text-xs px-2.5 py-2 rounded-xl font-semibold"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    {year}
                  </motion.button>
                ))}
              </div>
            )
          )}
        </div>

        {/* Row 2: status + management controls */}
        {gmailConnected && (
          <div className="flex items-center justify-between mt-1.5">
            <div>
              <p className="text-xs" style={{ color: 'var(--cat-wellness)' }}>● Gmail connected</p>
              {scanSummary && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Last scan: {scanSummary}</p>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleConnect}
                className="text-xs px-2.5 py-1.5 rounded-lg"
                style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                Reconnect
              </motion.button>

              {/* Clear inbox — wipes pending items + scan history */}
              <AnimatePresence mode="wait">
                {confirmType === 'inbox' ? (
                  <motion.button
                    key="confirm-inbox"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleConfirm}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-semibold"
                    style={{ background: '#2a2000', color: '#fbbf24', border: '1px solid #78580a' }}
                  >
                    Sure?
                  </motion.button>
                ) : (
                  <motion.button
                    key="trash-btn"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => requestConfirm('inbox')}
                    className="p-1.5 rounded-lg flex flex-col items-center gap-0.5"
                    style={{ background: 'var(--bg-card)', color: '#f59e0b', border: '1px solid #78350f55' }}
                    title="Clear inbox & scan history (keeps approved events)"
                  >
                    <Trash2 size={13} />
                    <span style={{ fontSize: '8px', lineHeight: 1, fontWeight: 600, letterSpacing: '0.03em', color: '#f59e0b' }}>clear</span>
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Full reset — nuclear, back to first launch */}
              <AnimatePresence mode="wait">
                {confirmType === 'full' ? (
                  <motion.button
                    key="confirm-full"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleConfirm}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-semibold"
                    style={{ background: '#3a1a1a', color: '#f87171', border: '1px solid #6a2d2d' }}
                  >
                    Sure?
                  </motion.button>
                ) : (
                  <motion.button
                    key="full-reset-btn"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => requestConfirm('full')}
                    className="p-1.5 rounded-lg flex flex-col items-center gap-0.5"
                    style={{ background: 'var(--bg-card)', color: '#ef4444', border: '1px solid #7f1d1d55' }}
                    title="Full reset — wipes all events (keeps Gmail connected)"
                  >
                    <RotateCcw size={13} />
                    <span style={{ fontSize: '8px', lineHeight: 1, fontWeight: 600, letterSpacing: '0.03em', color: '#ef4444' }}>reset all</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </motion.div>

      {/* Ingest All Button and Historical Years (only when connected) */}
      {gmailConnected && (
        <div className="px-4 mb-6">
          <IngestAllButton 
            session={session} 
            onEventsFound={handleEventsFound} 
          />
          <HistoricalYearButtons 
            onIngestYear={handleIngestYear} 
            isIngesting={isIngesting} 
          />
        </div>
      )}

      {!gmailConnected ? (
        <ConnectGmail onConnect={handleConnect} />
      ) : inboxItems.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center pt-16 px-8 text-center"
        >
          <div className="text-6xl mb-4">✅</div>
          <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>All caught up</p>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Pick a year above to scan your Gmail for events
          </p>
        </motion.div>
      ) : (
        <div className="px-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Found in your Gmail — approve to add
            </p>
            {inboxItems.length > 1 && (
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={approveAllInboxItems}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl"
                style={{
                  background: 'var(--accent)',
                  color:      'var(--bg-base)',
                }}
              >
                <CheckCheck size={13} />
                Accept all {inboxItems.length}
              </motion.button>
            )}
          </div>
          <AnimatePresence mode="popLayout">
            {inboxItems.map(item => (
              <InboxCard
                key={item.id}
                item={item}
                onApprove={approveInboxItem}
                onDismiss={dismissInboxItem}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
