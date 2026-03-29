import pg from 'pg'
const { Pool } = pg

// Railway provides DATABASE_URL automatically when you add a Postgres plugin
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
})

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  console.log('DB ready')
}

export async function getSession(id) {
  const { rows } = await pool.query('SELECT data FROM sessions WHERE id = $1', [id])
  return rows[0]?.data ?? null
}

export async function setSession(id, data) {
  await pool.query(`
    INSERT INTO sessions (id, data, updated_at) VALUES ($1, $2, NOW())
    ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()
  `, [id, JSON.stringify(data)])
}

export async function deleteSession(id) {
  await pool.query('DELETE FROM sessions WHERE id = $1', [id])
}

export default pool
