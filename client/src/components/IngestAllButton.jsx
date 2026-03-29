import { apiUrl } from "../api.js"
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pause, Play, RotateCcw, CheckCircle, AlertCircle } from 'lucide-react'

const JOB_KEY = 'ingest-all-job'
const POLL_MS = 3000

/**
 * IngestAllButton - One-button year-by-year ingestion with SSE progress
 * 
 * Features:
 * - Single prominent button to start ingestion
 * - SSE streaming for real-time progress
 * - Progress bar showing year completion
 * - Pause/resume capability
 * - Error handling with retry option
 */
export default function IngestAllButton({ session, onEventsFound }) {
  const [status, setStatus] = useState('idle') // idle | running | paused | complete | error
  const [progress, setProgress] = useState({ year: 0, yearIndex: 0, totalYears: 0, eventsFound: 0 })
  const [error, setError] = useState(null)
  const eventSourceRef = useRef(null)
  const pollIntervalRef = useRef(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const startIngestion = useCallback(async () => {
    if (!session) return

    setStatus('running')
    setError(null)

    try {
      // Start the ingestion
      const res = await fetch(apiUrl('/api/gmail/ingest-all'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, startYear: 2012, endYear: new Date().getFullYear() }),
      })

      if (!res.ok) throw new Error('Failed to start ingestion')

      // Connect to SSE stream
      const eventSource = new EventSource(apiUrl(`/api/gmail/ingest-all?session=${session}`))
      eventSourceRef.current = eventSource

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)

          switch (data.type) {
            case 'progress':
              setProgress({
                year: data.year,
                yearIndex: data.yearIndex,
                totalYears: data.totalYears,
                eventsFound: data.eventsFound,
              })
              // Stream events to parent
              if (data.newEvents && data.newEvents.length > 0) {
                onEventsFound?.(data.newEvents)
              }
              break

            case 'complete':
              setStatus('complete')
              setProgress(prev => ({ ...prev, eventsFound: data.totalEvents }))
              eventSource.close()
              break

            case 'error':
              setError({ year: data.year, message: data.message })
              setStatus('error')
              eventSource.close()
              break

            case 'cancelled':
              setStatus('idle')
              eventSource.close()
              break
          }
        } catch (err) {
          console.error('SSE parse error:', err)
        }
      }

      eventSource.onerror = () => {
        // Fallback to polling if SSE fails
        eventSource.close()
        startPolling()
      }

    } catch (err) {
      setError({ message: err.message })
      setStatus('error')
    }
  }, [session, onEventsFound])

  const startPolling = useCallback(async () => {
    const poll = async () => {
      try {
        const res = await fetch(apiUrl('/api/gmail/ingest-all/status'))
        const data = await res.json()

        if (!data.running && status !== 'idle') {
          // Job finished
          if (data.error) {
            setError({ message: data.error })
            setStatus('error')
          } else {
            setStatus('complete')
          }
          clearInterval(pollIntervalRef.current)
          return
        }

        setProgress({
          year: data.currentYear,
          yearIndex: data.currentYearIndex,
          totalYears: data.totalYears,
          eventsFound: data.totalEvents,
        })

        if (data.paused) {
          setStatus('paused')
        } else if (data.running) {
          setStatus('running')
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }

    poll()
    pollIntervalRef.current = setInterval(poll, POLL_MS)
  }, [status])

  const pauseIngestion = useCallback(async () => {
    try {
      await fetch(apiUrl('/api/gmail/ingest-all/pause'), { method: 'POST' })
      setStatus('paused')
    } catch (err) {
      console.error('Pause error:', err)
    }
  }, [])

  const resumeIngestion = useCallback(async () => {
    try {
      await fetch(apiUrl('/api/gmail/ingest-all/resume'), { method: 'POST' })
      setStatus('running')
    } catch (err) {
      console.error('Resume error:', err)
    }
  }, [])

  const cancelIngestion = useCallback(async () => {
    try {
      await fetch(apiUrl('/api/gmail/ingest-all'), { method: 'DELETE' })
      setStatus('idle')
      setProgress({ year: 0, yearIndex: 0, totalYears: 0, eventsFound: 0 })
    } catch (err) {
      console.error('Cancel error:', err)
    }
  }, [])

  const retry = useCallback(() => {
    setError(null)
    setStatus('idle')
    startIngestion()
  }, [startIngestion])

  // Progress percentage
  const progressPct = progress.totalYears > 0 
    ? Math.round(((progress.yearIndex + 1) / progress.totalYears) * 100)
    : 0

  // --- Render states ---

  if (status === 'idle') {
    return (
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={startIngestion}
        className="w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2"
        style={{
          background: 'var(--accent)',
          color: 'var(--bg-base)',
          boxShadow: '0 4px 24px oklch(0.82 0.16 75 / 0.35)',
        }}
      >
        <span>🗂</span>
        Ingest All Years
      </motion.button>
    )
  }

  if (status === 'running' || status === 'paused') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Progress text */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {status === 'paused' ? '⏸ Paused at' : '📥 Ingesting'} {progress.year} ({progress.yearIndex + 1} of {progress.totalYears} years)
          </p>
          <p className="text-sm" style={{ color: 'var(--accent)' }}>
            {progress.eventsFound.toLocaleString()} events found
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'var(--bg-elevated)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.3 }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, var(--accent), oklch(0.82 0.16 75 / 0.7))` }}
          />
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {status === 'running' ? (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={pauseIngestion}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              <Pause size={14} /> Pause
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={resumeIngestion}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
              style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}
            >
              <Play size={14} /> Resume
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={cancelIngestion}
            className="py-2.5 px-4 rounded-xl text-sm font-medium"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            Cancel
          </motion.button>
        </div>
      </motion.div>
    )
  }

  if (status === 'complete') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--cat-wellness)' }}
      >
        <CheckCircle size={24} style={{ color: 'var(--cat-wellness)' }} />
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            ✅ Done — {progress.eventsFound.toLocaleString()} events ingested
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            across {progress.totalYears} years
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => { setStatus('idle'); setProgress({ year: 0, yearIndex: 0, totalYears: 0, eventsFound: 0 }) }}
          className="p-2 rounded-lg"
          style={{ background: 'var(--bg-elevated)' }}
          title="Start over"
        >
          <RotateCcw size={14} style={{ color: 'var(--text-muted)' }} />
        </motion.button>
      </motion.div>
    )
  }

  if (status === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: 'var(--bg-card)', border: '1px solid #6a2d2d' }}
      >
        <AlertCircle size={24} style={{ color: '#f87171' }} />
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            ⚠️ Error{error?.year ? ` in ${error.year}` : ''}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {error?.message || 'Something went wrong'}
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={retry}
          className="py-2 px-4 rounded-xl text-sm font-medium"
          style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}
        >
          Retry
        </motion.button>
      </motion.div>
    )
  }

  return null
}
