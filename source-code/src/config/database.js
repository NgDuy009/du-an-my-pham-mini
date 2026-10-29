const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'cosmetic_mini',
  user: process.env.DB_USER || 'cosmetic_app',
  password: process.env.DB_PASSWORD || 'change_me_db_password',
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: 'cosmetic-mini-web'
});

pool.on('error', (error) => {
  console.error('[database] unexpected idle client error:', error.message);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function waitForDatabase({ attempts = 30, delayMs = 2000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await query('SELECT 1');
      console.log(`[database] ready after attempt ${attempt}`);
      return;
    } catch (error) {
      lastError = error;
      console.log(`[database] waiting (${attempt}/${attempts})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError || new Error('Database did not become ready');
}

module.exports = { pool, query, transaction, waitForDatabase };
