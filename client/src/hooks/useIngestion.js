import { apiUrl } from "../api.js"
import { useState, useEffect, useRef, useCallback } from 'react'

const JOB_KEY = 'thread-ingest-job'
const POLL_MS = 3000

/**
 * Manages a server-side background ingestion job.
 *
 * - Starts a job on the server, returns immediately with a jobId
 * - Stores jobId in localStorage so the job survives page refreshes
 * - Polls /api/gmail/ingest/:jobId every 3s while running
 * - Calls onProgress(newEvents) as events arrive (only new ones each poll)
 * - Calls onComplete(allEvents) when done
 * - Calls onError(message) on failure
 */
export function useIngestion({ onComplete, onError, onProgress }) {
  const [jobId, setJobId] = useState(() => localStorage.getItem(JOB_KEY))
  const [jobStatus, setJobStatus] = useState(null) // null | 'running' | 'done' | 'error'
  const [scanned, setScanned] = useState(0)
  const [found, setFound] = useState(0)
  const intervalRef = useRef(null)
  const doneRef = useRef(false)     // prevent double-firing onComplete
  const seenCountRef = useRef(0)    // tracks how many events we've already passed to onProgress

  const clearJob = useCallback(() => {
    localStorage.removeItem(JOB_KEY)
    setJobId(null)
    setJobStatus(null)
    setScanned(0)
    setFound(0)
    doneRef.current = false
    seenCountRef.current = 0
  }, [])

  // Start a new ingestion job
  // sinceDate: YYYY/MM/DD — start of range (default: 2026/01/01)
  // beforeDate: YYYY/MM/DD — end of range; omit to scan to present
  const startIngestion = useCallback(async (session, sinceDate, beforeDate) => {
    // Reset seen counter so onProgress fires fresh for the new scan
    seenCountRef.current = 0
    doneRef.current = false

    try {
      const since = sinceDate || '2026/01/01'

      const res = await fetch(apiUrl('/api/gmail/ingest'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, sinceDate: since, beforeDate: beforeDate || null }),
      })
      if (!res.ok) throw new Error('Failed to start ingestion')
      const { jobId: id } = await res.json()
      localStorage.setItem(JOB_KEY, id)
      setJobId(id)
      setJobStatus('running')
      setScanned(0)
      setFound(0)
    } catch (err) {
      onError?.(err.message)
    }
  }, [onError])

  // Poll while a jobId exists
  useEffect(() => {
    if (!jobId) return

    const poll = async () => {
      try {
        const res = await fetch(apiUrl(`/api/gmail/ingest/${jobId}`)

        // 404 = server restarted, job lost — clean up silently
        if (res.status === 404) {
          clearJob()
          return
        }

        const data = await res.json()
        setScanned(data.scanned ?? 0)
        setFound(data.eventCount ?? 0)
        setJobStatus(data.status)

        // Stream new events to onProgress as they arrive
        const allEvents = data.events ?? []
        if (allEvents.length > seenCountRef.current) {
          const newEvents = allEvents.slice(seenCountRef.current)
          seenCountRef.current = allEvents.length
          onProgress?.(newEvents)
        }

        if (data.status === 'done' && !doneRef.current) {
          doneRef.current = true
          clearInterval(intervalRef.current)
          onComplete?.(allEvents)
          clearJob()
        } else if (data.status === 'error') {
          clearInterval(intervalRef.current)
          onError?.(data.error ?? 'Ingestion failed')
          clearJob()
        }
      } catch {
        // Network error — keep polling, maybe transient
      }
    }

    poll() // immediate first poll
    intervalRef.current = setInterval(poll, POLL_MS)
    return () => clearInterval(intervalRef.current)
  }, [jobId, clearJob, onComplete, onError, onProgress])

  const cancelIngestion = useCallback(async () => {
    const id = localStorage.getItem(JOB_KEY)
    if (!id) return
    clearInterval(intervalRef.current)
    try {
      await fetch(apiUrl(`/api/gmail/ingest/${id}`), { method: 'DELETE' })
    } catch { /* best effort */ }
    clearJob()
  }, [clearJob])

  return {
    isRunning: jobStatus === 'running',
    jobStatus,
    scanned,
    found,
    startIngestion,
    cancelIngestion,
    clearJob,
  }
}
