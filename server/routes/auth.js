import { Router } from 'express'
import { google } from 'googleapis'
import { getSession, setSession, deleteSession } from '../db.js'
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
router.get('/google', async (req, res) => {
  const oauth2 = getOAuthClient()
  const state = crypto.randomBytes(16).toString('hex')
  await setSession(state, { pending: true })

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
  const frontendBase = process.env.FRONTEND_ORIGIN || `http://localhost:${process.env.PORT || 3001}`

  if (error) return res.redirect(`${frontendBase}/?error=${error}`)

  const stateData = state ? await getSession(state) : null
  if (!stateData) return res.status(400).send('Invalid state')

  try {
    const oauth2 = getOAuthClient()
    const { tokens } = await oauth2.getToken(code)
    oauth2.setCredentials(tokens)

    const sessionId = crypto.randomBytes(16).toString('hex')
    await setSession(sessionId, { tokens, connectedAt: new Date().toISOString() })
    await deleteSession(state)

    res.redirect(`${frontendBase}/?connected=true&session=${sessionId}`)
  } catch (err) {
    console.error('OAuth callback error:', err)
    res.redirect(`${frontendBase}/?error=auth_failed`)
  }
})

// GET /auth/status?session=xxx — check if connected
router.get('/status', async (req, res) => {
  const { session } = req.query
  const sess = session ? await getSession(session) : null
  res.json({ connected: !!(sess && sess.tokens) })
})

export { router as authRouter }
