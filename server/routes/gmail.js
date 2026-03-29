import { Router } from 'express'
import { google } from 'googleapis'
import { sessions } from '../server.js'
import { parseEmailForEvents } from '../services/emailParser.js'

const router = Router()

// In-memory job store — survives as long as the server is up
const ingestJobs = {}

// Ingest-all state (year-by-year with SSE)
let ingestAllState = {
  running: false,
  paused: false,
  currentYearIndex: 0,
  years: [],
  totalEvents: 0,
  currentJobId: null,
  error: null,
  cancelled: false,
}

// Primary filter: Gmail's built-in ML categories.
// Gmail auto-classifies flights, hotels, concert tickets, reservations, etc.
// These two categories cover 95%+ of event/travel emails reliably.
const CATEGORY_QUERY = 'category:travel OR category:purchases'

// Sender list — music/event ticketing platforms.
// Non-music platforms (airbnb, opentable, etc.) rely on category:travel/purchases.
const SENDER_QUERY = [
  // Major ticketing
  'ticketmaster.com', 'livenation.com', 'axs.com', 'seatgeek.com', 'stubhub.com',
  // Music-first platforms
  'dice.fm', 'ra.co', 'tixr.com', 'etix.com', 'seated.com',
  'bandsintown.com', 'songkick.com', 'frontgatetickets.com',
  // Boutique / underground
  'posh.vip', 'seetickets.us', 'whatstba.com', 'tokenproof.xyz',
  'eventticketscenter.com',
  // Social / mixed events
  'eventbrite.com', 'universe.com', 'luma.com', 'luma-mail.com', 'lu.ma', 'partiful.com',
  // Travel & dining
  'airbnb.com', 'vrbo.com', 'opentable.com', 'resy.com',
].map(d => `from:${d}`).join(' OR ')

// Subject phrases — specific enough to avoid noise, broad enough to catch variants
const SUBJECT_QUERY = [
  // Phrase matches (precise)
  'subject:"your tickets"',
  'subject:"you\'re going"',
  'subject:"you have tickets"',
  'subject:"here are your tickets"',
  // Luma registration
  'subject:"Registration approved"',
].join(' OR ')

// Noise exclusions
const NOT_QUERY = 'subject:shipped OR subject:tracking OR subject:subscription OR subject:statement from:(amazon.com OR ups.com OR fedex.com OR discover@airbnb.com)'

// Combined query — under 500 chars, Gmail handles this reliably
const FULL_QUERY = `(${CATEGORY_QUERY} OR ${SENDER_QUERY} OR ${SUBJECT_QUERY}) -(${NOT_QUERY})`

function getGmailClient(tokens) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback'
  )
  auth.setCredentials(tokens)
  return google.gmail({ version: 'v1', auth })
}

function extractBody(payload) {
  // Decode base64 email body — handles plain text and multipart
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8')
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8')
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = Buffer.from(part.body.data, 'base64').toString('utf-8')
        // Strip HTML tags for simpler parsing
        return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      }
    }
  }
  return ''
}

function getHeader(headers, name) {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

// POST /api/gmail/scan — scan inbox for events
router.post('/scan', async (req, res) => {
  const { session } = req.body
  const sess = sessions[session]

  if (!sess?.tokens) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  try {
    const gmail = getGmailClient(sess.tokens)

    // Fetch up to 50 matching emails from last 12 months
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: `${FULL_QUERY} newer_than:365d`,
      maxResults: 50,
    })

    const messages = listRes.data.messages || []
    const inboxItems = []

    // Process in batches of 5 to avoid rate limits
    for (let i = 0; i < messages.length; i += 5) {
      const batch = messages.slice(i, i + 5)
      const fetched = await Promise.all(
        batch.map(m => gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' }))
      )

      for (const msgRes of fetched) {
        const msg = msgRes.data
        const headers = msg.payload?.headers || []
        const subject = getHeader(headers, 'subject')
        const from = getHeader(headers, 'from')
        const dateHeader = getHeader(headers, 'date')
        const body = extractBody(msg.payload)

        if (!body) continue

        const events = await parseEmailForEvents({ subject, from, body, date: dateHeader })
        inboxItems.push(...events.map(e => ({ ...e, gmailId: msg.id })))
      }
    }

    res.json({ events: inboxItems, scanned: messages.length })
  } catch (err) {
    console.error('Gmail scan error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/gmail/poll?session=xxx — lightweight poll for new emails since last check
router.get('/poll', async (req, res) => {
  const { session, since } = req.query
  const sess = sessions[session]
  if (!sess?.tokens) return res.status(401).json({ error: 'Not authenticated' })

  try {
    const gmail = getGmailClient(sess.tokens)
    const sinceFilter = since ? `after:${since}` : 'newer_than:1d'

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: `${FULL_QUERY} ${sinceFilter}`,
      maxResults: 10,
    })

    const messages = listRes.data.messages || []
    const inboxItems = []

    for (const m of messages) {
      const msgRes = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' })
      const msg = msgRes.data
      const headers = msg.payload?.headers || []
      const subject = getHeader(headers, 'subject')
      const from = getHeader(headers, 'from')
      const dateHeader = getHeader(headers, 'date')
      const body = extractBody(msg.payload)

      if (body) {
        const events = await parseEmailForEvents({ subject, from, body, date: dateHeader })
        inboxItems.push(...events.map(e => ({ ...e, gmailId: msg.id })))
      }
    }

    res.json({ events: inboxItems, scanned: messages.length })
  } catch (err) {
    console.error('Poll error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/gmail/debug?session=xxx — return raw emails + parse results for filter tuning
router.get('/debug', async (req, res) => {
  const { session } = req.query
  const sess = sessions[session]
  if (!sess?.tokens) return res.status(401).json({ error: 'Not authenticated' })

  try {
    const gmail = getGmailClient(sess.tokens)

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: FULL_QUERY,
      maxResults: 100,
    })

    const messages = listRes.data.messages || []
    const results = []

    // Helper: guess which filter likely caught this email (best-effort — Gmail
    // doesn't tell us which clause of the OR matched)
    function guessMatchedFilter(from, subject, labelIds = []) {
      const fromLower = from.toLowerCase()
      const subjLower = subject.toLowerCase()
      // Gmail category labels look like CATEGORY_TRAVEL, CATEGORY_PURCHASES
      if (labelIds.some(l => l.startsWith('CATEGORY_'))) {
        const cat = labelIds.find(l => l.startsWith('CATEGORY_'))
        return cat.replace('CATEGORY_', '').toLowerCase()
      }
      if (SENDER_QUERY.split(' OR ').some(q => fromLower.includes(q.replace('from:', '')))) return 'sender'
      if (/confirmation|booking|reservation|your trip|your tickets|check-in/i.test(subjLower)) return 'subject'
      return 'category' // caught by Gmail ML, no other match
    }

    // Batch 5 at a time
    for (let i = 0; i < messages.length; i += 5) {
      const batch = messages.slice(i, i + 5)
      const fetched = await Promise.all(
        batch.map(m => gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' }))
      )

      for (const msgRes of fetched) {
        const msg = msgRes.data
        const headers = msg.payload?.headers || []
        const subject = getHeader(headers, 'subject')
        const from = getHeader(headers, 'from')
        const dateHeader = getHeader(headers, 'date')
        const body = extractBody(msg.payload)
        const bodyExcerpt = body.slice(0, 500)
        const labelIds = msg.labelIds || []
        const matchedFilter = guessMatchedFilter(from, subject, labelIds)

        let parsedEvents = []
        let parseError = null
        try {
          parsedEvents = await parseEmailForEvents({ subject, from, body, date: dateHeader })
        } catch (e) {
          parseError = e.message
        }

        results.push({
          id: msg.id,
          subject,
          from,
          date: dateHeader,
          matchedFilter,
          labelIds,
          bodyExcerpt,
          parsedEvents,
          parseError,
        })
      }
    }

    res.json({
      total: messages.length,
      query: FULL_QUERY,
      emails: results,
    })
  } catch (err) {
    console.error('Debug scan error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ─── Background ingestion ────────────────────────────────────────────────────

async function runIngestion(jobId, tokens, sinceDate = null, beforeDate = null) {
  const job = ingestJobs[jobId]
  try {
    const gmail = getGmailClient(tokens)
    let pageToken = undefined

    // Build date filter — scoped to the requested year range
    const after = sinceDate || '2026/01/01'
    const dateFilter = beforeDate ? `after:${after} before:${beforeDate}` : `after:${after}`

    while (true) {
      if (job.cancelled) { job.status = 'cancelled'; return }

      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: `${FULL_QUERY} ${dateFilter}`,
        maxResults: 100,
        ...(pageToken ? { pageToken } : {}),
      })

      const messages = listRes.data.messages || []
      if (!messages.length) break

      for (let i = 0; i < messages.length; i += 5) {
        if (job.cancelled) break

        const batch = messages.slice(i, i + 5)
        const fetched = await Promise.all(
          batch.map(m => gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' }))
        )

        for (const msgRes of fetched) {
          const msg = msgRes.data
          const headers = msg.payload?.headers || []
          const subject = getHeader(headers, 'subject')
          const from = getHeader(headers, 'from')
          const dateHeader = getHeader(headers, 'date')
          const body = extractBody(msg.payload)
          if (!body) continue

          const events = await parseEmailForEvents({ subject, from, body, date: dateHeader })
          const tagged = events.map(e => ({ ...e, gmailId: msg.id }))
          job.events.push(...tagged)
          job.found += tagged.length
          job.scanned++
        }
      }

      pageToken = listRes.data.nextPageToken
      if (!pageToken) break
    }

    if (!job.cancelled) {
      job.status = 'done'
      console.log(`Ingest ${jobId}: done — scanned ${job.scanned}, found ${job.found} events`)
    }
  } catch (err) {
    job.status = 'error'
    job.error = err.message
    console.error(`Ingest ${jobId} failed:`, err.message)
  }
}

// POST /api/gmail/ingest — kick off background ingestion, return jobId immediately
// Body: { session, sinceDate?, beforeDate? } — both YYYY/MM/DD, scopes to that exact range
router.post('/ingest', async (req, res) => {
  const { session, sinceDate, beforeDate } = req.body
  const sess = sessions[session]
  if (!sess?.tokens) return res.status(401).json({ error: 'Not authenticated' })

  const jobId = Math.random().toString(36).slice(2)
  ingestJobs[jobId] = {
    status: 'running',
    scanned: 0,
    found: 0,
    events: [],
    startedAt: Date.now(),
    sinceDate: sinceDate || null,
    beforeDate: beforeDate || null,
  }

  // Fire and forget — client polls for status
  runIngestion(jobId, sess.tokens, sinceDate || null, beforeDate || null)

  const range = beforeDate ? `${sinceDate} → ${beforeDate}` : `${sinceDate || 'default'} → now`
  console.log(`Ingest ${jobId}: started (${range})`)
  res.json({ jobId })
})

// DELETE /api/gmail/ingest/:jobId — cancel a running job
router.delete('/ingest/:jobId', (req, res) => {
  const job = ingestJobs[req.params.jobId]
  if (!job) return res.status(404).json({ error: 'Job not found' })
  if (job.status !== 'running') return res.json({ status: job.status })
  job.cancelled = true
  job.status = 'cancelled'
  console.log(`Ingest ${req.params.jobId}: cancelled`)
  res.json({ status: 'cancelled' })
})

// GET /api/gmail/ingest/:jobId — poll job status + results
router.get('/ingest/:jobId', (req, res) => {
  const job = ingestJobs[req.params.jobId]
  if (!job) return res.status(404).json({ error: 'Job not found — server may have restarted' })

  // Always return current events so the client can show them as they arrive
  const { events, ...meta } = job
  res.json({
    ...meta,
    events,
    eventCount: events.length,
  })
})


// ─── Ingest All Years (SSE) ───────────────────────────────────────────────────

// POST /api/gmail/ingest-all — start year-by-year ingestion with SSE
router.post('/ingest-all', async (req, res) => {
  const { session, startYear, endYear } = req.body
  const sess = sessions[session]
  if (!sess?.tokens) return res.status(401).json({ error: 'Not authenticated' })

  const currentYear = new Date().getFullYear()
  const start = startYear || 2012
  const end = endYear || currentYear
  
  // Build year list
  const years = []
  for (let y = start; y <= end; y++) {
    years.push(y)
  }

  // Reset state
  ingestAllState = {
    running: true,
    paused: false,
    currentYearIndex: 0,
    years,
    totalEvents: 0,
    currentJobId: null,
    error: null,
    cancelled: false,
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // Process each year sequentially
  for (let i = 0; i < years.length; i++) {
    if (ingestAllState.cancelled) {
      sendEvent({ type: 'cancelled' })
      break
    }

    // Wait while paused
    while (ingestAllState.paused && !ingestAllState.cancelled) {
      await new Promise(r => setTimeout(r, 500))
    }

    if (ingestAllState.cancelled) {
      sendEvent({ type: 'cancelled' })
      break
    }

    const year = years[i]
    ingestAllState.currentYearIndex = i

    sendEvent({
      type: 'progress',
      year,
      yearIndex: i,
      totalYears: years.length,
      eventsFound: ingestAllState.totalEvents,
      status: 'running',
    })

    try {
      // Run ingestion for this year
      const jobId = Math.random().toString(36).slice(2)
      ingestAllState.currentJobId = jobId
      
      const yearJob = {
        status: 'running',
        scanned: 0,
        found: 0,
        events: [],
        startedAt: Date.now(),
      }
      ingestJobs[jobId] = yearJob

      // Process this year synchronously (but we need to yield to allow pause check)
      const gmail = getGmailClient(sess.tokens)
      let pageToken = undefined
      const sinceDate = `${year}/01/01`
      const beforeDate = `${year}/12/31`
      const dateFilter = `after:${sinceDate} before:${beforeDate}`

      while (true) {
        if (ingestAllState.cancelled) break

        const listRes = await gmail.users.messages.list({
          userId: 'me',
          q: `${FULL_QUERY} ${dateFilter}`,
          maxResults: 100,
          ...(pageToken ? { pageToken } : {}),
        })

        const messages = listRes.data.messages || []
        if (!messages.length) break

        for (let j = 0; j < messages.length; j += 5) {
          if (ingestAllState.cancelled) break

          const batch = messages.slice(j, j + 5)
          const fetched = await Promise.all(
            batch.map(m => gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' }))
          )

          for (const msgRes of fetched) {
            if (ingestAllState.cancelled) break
            
            const msg = msgRes.data
            const headers = msg.payload?.headers || []
            const subject = getHeader(headers, 'subject')
            const from = getHeader(headers, 'from')
            const dateHeader = getHeader(headers, 'date')
            const body = extractBody(msg.payload)
            if (!body) continue

            const events = await parseEmailForEvents({ subject, from, body, date: dateHeader })
            const tagged = events.map(e => ({ ...e, gmailId: msg.id }))
            yearJob.events.push(...tagged)
            yearJob.found += tagged.length
            yearJob.scanned++
          }
        }

        pageToken = listRes.data.nextPageToken
        if (!pageToken) break
      }

      // Add year's events to total
      ingestAllState.totalEvents += yearJob.found
      delete ingestJobs[jobId]
      ingestAllState.currentJobId = null

      if (ingestAllState.cancelled) {
        sendEvent({ type: 'cancelled' })
        break
      }

    } catch (err) {
      sendEvent({
        type: 'error',
        year,
        message: err.message,
      })
      ingestAllState.error = err.message
    }
  }

  if (!ingestAllState.cancelled) {
    ingestAllState.running = false
    sendEvent({
      type: 'complete',
      totalEvents: ingestAllState.totalEvents,
      yearsProcessed: ingestAllState.currentYearIndex + 1,
    })
  }

  res.end()
})

// GET /api/gmail/ingest-all — SSE stream for progress updates
router.get('/ingest-all', (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // Send initial state if job is running
  if (ingestAllState.running) {
    const year = ingestAllState.years[ingestAllState.currentYearIndex]
    sendEvent({
      type: 'progress',
      year,
      yearIndex: ingestAllState.currentYearIndex,
      totalYears: ingestAllState.years.length,
      eventsFound: ingestAllState.totalEvents,
      status: ingestAllState.paused ? 'paused' : 'running',
    })
  }

  // Send complete if done
  if (!ingestAllState.running && ingestAllState.years.length > 0) {
    sendEvent({
      type: 'complete',
      totalEvents: ingestAllState.totalEvents,
      yearsProcessed: ingestAllState.currentYearIndex + 1,
    })
    res.end()
    return
  }

  // Poll state changes and send to client
  const interval = setInterval(() => {
    if (!ingestAllState.running) {
      clearInterval(interval)
      sendEvent({
        type: 'complete',
        totalEvents: ingestAllState.totalEvents,
        yearsProcessed: ingestAllState.currentYearIndex + 1,
      })
      res.end()
      return
    }

    const year = ingestAllState.years[ingestAllState.currentYearIndex]
    sendEvent({
      type: 'progress',
      year,
      yearIndex: ingestAllState.currentYearIndex,
      totalYears: ingestAllState.years.length,
      eventsFound: ingestAllState.totalEvents,
      status: ingestAllState.paused ? 'paused' : 'running',
    })
  }, 2000)

  // Cleanup on close
  req.on('close', () => {
    clearInterval(interval)
  })
})

// GET /api/gmail/ingest-all/status — check if running + current progress
router.get('/ingest-all/status', (req, res) => {
  res.json({
    running: ingestAllState.running,
    paused: ingestAllState.paused,
    currentYearIndex: ingestAllState.currentYearIndex,
    currentYear: ingestAllState.years[ingestAllState.currentYearIndex] || null,
    totalYears: ingestAllState.years.length,
    totalEvents: ingestAllState.totalEvents,
    error: ingestAllState.error,
  })
})

// POST /api/gmail/ingest-all/pause — pause the ingest-all job
router.post('/ingest-all/pause', (req, res) => {
  if (!ingestAllState.running) {
    return res.status(400).json({ error: 'No ingestion running' })
  }
  ingestAllState.paused = true
  res.json({ paused: true })
})

// POST /api/gmail/ingest-all/resume — resume the ingest-all job
router.post('/ingest-all/resume', (req, res) => {
  if (!ingestAllState.running) {
    return res.status(400).json({ error: 'No ingestion running' })
  }
  ingestAllState.paused = false
  res.json({ paused: false })
})

// DELETE /api/gmail/ingest-all — cancel the ingest-all job
router.delete('/ingest-all', (req, res) => {
  if (!ingestAllState.running) {
    return res.status(400).json({ error: 'No ingestion running' })
  }
  ingestAllState.cancelled = true
  ingestAllState.running = false
  if (ingestAllState.currentJobId && ingestJobs[ingestAllState.currentJobId]) {
    ingestJobs[ingestAllState.currentJobId].cancelled = true
  }
  res.json({ cancelled: true })
})

export { router as gmailRouter }
