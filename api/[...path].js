import { app } from '../server/app.js'
import { initDb } from '../server/db.js'

let dbReady

function normalizeUrl(req) {
  // Vercel invokes this catch-all as /api/<path>. The Express backend expects:
  // - /auth/* for OAuth
  // - /api/gmail/* and /api/health for API routes
  if (req.url.startsWith('/api/auth/')) {
    req.url = req.url.replace('/api/auth/', '/auth/')
  }
}

export default async function handler(req, res) {
  dbReady ||= initDb().catch(err => {
    console.error('⚠️  DB init failed, using in-memory sessions:', err.message)
  })
  await dbReady
  normalizeUrl(req)
  return app(req, res)
}
