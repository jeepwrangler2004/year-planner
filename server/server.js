import express from 'express'
import cors from 'cors'
import { initDb } from './db.js'
import { authRouter } from './routes/auth.js'
import { gmailRouter } from './routes/gmail.js'

const app = express()
const PORT = process.env.PORT || 3001

const ALLOWED_ORIGINS = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:3001']

app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin requests (e.g. server-to-server) and listed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json())

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  next()
})

app.use('/auth', authRouter)
app.use('/api/gmail', gmailRouter)
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }))

// Init DB then start server (non-fatal — falls back to in-memory if DB unreachable)
initDb().catch(err => {
  console.error('⚠️  DB init failed, running with in-memory sessions:', err.message)
}).finally(() => {
  const server = app.listen(PORT, () => {
    console.log(`Year Planner backend running on port ${PORT}`)
  })
  server.on('error', (err) => {
    console.error(`Server failed to start: ${err.code} ${err.message}`)
    process.exit(1)
  })
})
