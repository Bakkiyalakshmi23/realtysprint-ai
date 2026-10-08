/**
 * RealtySprint AI — Step 5B
 * Database Migration Runner
 *
 * Reads and executes SQL files in database/migrations/ in order.
 * Tracks applied migrations in a `schema_migrations` table.
 *
 * Usage:
 *   node backend/db/migrate.js
 *   npm run migrate
 */

const fs   = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'realtysprint',
  user:     process.env.DB_USER     || 'realtysprint_user',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const MIGRATIONS_DIR = path.join(__dirname, '../../database/migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         SERIAL      PRIMARY KEY,
      filename   VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query('SELECT filename FROM schema_migrations ORDER BY filename');
  return result.rows.map(r => r.filename);
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureMigrationsTable(client);

    const applied = await getAppliedMigrations(client);
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.includes(file)) {
        console.log(`[migrate] ⏭  Skipped (already applied): ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] ▶  Applying: ${file}`);
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      console.log(`[migrate] ✅ Applied:  ${file}`);
      count++;
    }

    await client.query('COMMIT');
    console.log(`\n[migrate] Done. ${count} migration(s) applied.`);
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[migrate] ❌ Migration failed — transaction rolled back.');
    console.error(err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
