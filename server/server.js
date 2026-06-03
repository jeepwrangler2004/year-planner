import { app } from './app.js'
import { initDb } from './db.js'

const PORT = process.env.PORT || 3001

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
