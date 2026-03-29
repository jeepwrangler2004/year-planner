import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'
import { authRouter } from './routes/auth.js'
import { gmailRouter } from './routes/gmail.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

// Reflect request origin — works with any origin including Cloudflare tunnels
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  next()
})

// In-memory session store (replace with Redis/DB for production)
export const sessions = {}

app.use('/auth', authRouter)
app.use('/api/gmail', gmailRouter)
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }))

// Serve built frontend
const distPath = join(__dirname, '../client/dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('/{*path}', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/auth')) {
      res.sendFile(join(distPath, 'index.html'))
    }
  })
}

// Store reference — required to prevent GC from collecting the http.Server
// object. Without this, Node's GC closes the socket after ~14s and exits cleanly.
const server = app.listen(PORT, () => {
  console.log(`Thread running on port ${PORT}`)
  if (existsSync(distPath)) console.log(`  Serving frontend from ${distPath}`)
})

server.on('error', (err) => {
  console.error(`Server failed to start: ${err.code} ${err.message}`)
  process.exit(1)
})
