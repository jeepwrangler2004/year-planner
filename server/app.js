import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { gmailRouter } from './routes/gmail.js'

const app = express()

const ALLOWED_ORIGINS = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3001']

app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin requests (server-to-server, same-origin Vercel functions) and listed origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  next()
})

app.use('/auth', authRouter)
app.use('/api/gmail', gmailRouter)
app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '1.1.0', runtime: 'vercel-or-node' }))

export { app }
