import { Router } from 'express'
import { google } from 'googleapis'
import { sessions } from '../server.js'
import crypto from 'crypto'

const router = Router()

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback'
  )
}

// GET /auth/google — redirect to Google consent
router.get('/google', (req, res) => {
  const oauth2 = getOAuthClient()
  const state = crypto.randomBytes(16).toString('hex')
  sessions[state] = { pending: true }

  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    state,
    prompt: 'consent',
  })
  res.redirect(url)
})

// GET /auth/google/callback — handle OAuth callback
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query

  if (error) {
    const frontendBase = process.env.FRONTEND_ORIGIN || 'http://localhost:5000'
    return res.redirect(`${frontendBase}/?error=${error}`)
  }

  if (!state || !sessions[state]) {
    return res.status(400).send('Invalid state')
  }

  try {
    const oauth2 = getOAuthClient()
    const { tokens } = await oauth2.getToken(code)
    oauth2.setCredentials(tokens)

    // Store tokens (in production, store in DB keyed by user ID)
    const sessionId = crypto.randomBytes(16).toString('hex')
    sessions[sessionId] = { tokens, connectedAt: new Date().toISOString() }
    delete sessions[state]

    // Redirect to frontend with session token
    const frontendBase = process.env.FRONTEND_ORIGIN || `http://localhost:${process.env.PORT || 3001}`
    res.redirect(`${frontendBase}/?connected=true&session=${sessionId}`)
  } catch (err) {
    console.error('OAuth callback error:', err)
    const frontendBase = process.env.FRONTEND_ORIGIN || `http://localhost:${process.env.PORT || 3001}`
    res.redirect(`${frontendBase}/?error=auth_failed`)
  }
})

// GET /auth/status?session=xxx — check if connected
router.get('/status', (req, res) => {
  const { session } = req.query
  const sess = sessions[session]
  res.json({ connected: !!(sess && sess.tokens) })
})

export { router as authRouter }
