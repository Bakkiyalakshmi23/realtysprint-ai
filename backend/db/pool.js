/**
 * PostgreSQL Connection Pool
 * RealtySprint AI — Step 5B
 *
 * Uses the `pg` library's built-in Pool for connection management.
 * Connection settings are sourced exclusively from environment variables.
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'realtysprint',
  user:     process.env.DB_USER     || 'realtysprint_user',
  password: process.env.DB_PASSWORD || '',
  max:      parseInt(process.env.DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Test the database connection.
 * Returns { connected: true, latencyMs } on success,
 * or { connected: false, error } on failure.
 */
async function testConnection() {
  const start = Date.now();
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = { pool, testConnection };
