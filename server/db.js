import pg from 'pg'
const { Pool } = pg

// In-memory fallback when DATABASE_URL is not set (local dev / first deploy)
const memStore = {}

let pool = null

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
}

export async function initDb() {
  if (!pool) {
    console.warn('⚠️  No DATABASE_URL — using in-memory session store (sessions lost on restart)')
    return
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  console.log('✅ Postgres connected')
}

export async function getSession(id) {
  if (!pool) return memStore[id] ?? null
  const { rows } = await pool.query('SELECT data FROM sessions WHERE id = $1', [id])
  return rows[0]?.data ?? null
}

export async function setSession(id, data) {
  if (!pool) { memStore[id] = data; return }
  await pool.query(`
    INSERT INTO sessions (id, data, updated_at) VALUES ($1, $2, NOW())
    ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()
  `, [id, JSON.stringify(data)])
}

export async function deleteSession(id) {
  if (!pool) { delete memStore[id]; return }
  await pool.query('DELETE FROM sessions WHERE id = $1', [id])
}

export default pool
