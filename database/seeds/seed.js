/**
 * RealtySprint AI — Step 5B
 * Database Seed Script
 *
 * Inserts safe demo data for:
 *  - 2 AI agents (Company PA + Client Acquisition)
 *  - Demo admin user (password placeholder — NOT production-safe)
 *  - Demo tasks, leads, companies, contacts, approvals, agent_runs
 *
 * Usage:
 *   node database/seeds/seed.js
 *   npm run seed
 *
 * Safe to re-run: uses ON CONFLICT DO NOTHING for idempotency.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'realtysprint',
  user:     process.env.DB_USER     || 'realtysprint_user',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Demo admin user ─────────────────────────────────────────────────
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@realtysprint.ai';
    const adminPass = process.env.ADMIN_PASSWORD || 'DemoOnly123!';
    const bcrypt = require('../../backend/node_modules/bcryptjs');
    const hash = bcrypt.hashSync(adminPass, 10);

    await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('RealtySprint Admin', $1, $2, 'admin')
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
    `, [adminEmail, hash]);
    console.log('[seed] ✅ Users seeded');

    // ── 2. Agents ──────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO agents (name, slug, description, status, capabilities)
      VALUES
        (
          'Company PA Agent',
          'company-pa',
          'Internal AI operations assistant for tasks, KPIs, reporting, follow-ups, workload visibility, and operational coordination.',
          'online',
          '["Task Management","KPI Monitoring","Daily Reporting","Follow-ups","Workload Analysis","Operational Insights"]'
        ),
        (
          'Client Acquisition Agent',
          'client-acquisition',
          'AI prospecting assistant for discovering, researching, qualifying, scoring, and organizing real-estate opportunities.',
          'online',
          '["Prospect Research","Lead Qualification","Lead Scoring","Company Research","Outreach Drafts","Pipeline Tracking"]'
        )
      ON CONFLICT (slug) DO NOTHING;
    `);
    console.log('[seed] ✅ Agents seeded');

    // Fetch agent IDs
    const agentResult = await client.query('SELECT id, slug FROM agents WHERE slug IN ($1, $2)', ['company-pa', 'client-acquisition']);
    const agentMap = {};
    agentResult.rows.forEach(r => { agentMap[r.slug] = r.id; });
    const paId = agentMap['company-pa'];
    const caId = agentMap['client-acquisition'];

    // ── 3. Agent Tasks ─────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO agent_tasks (agent_id, title, description, status, priority)
      VALUES
        ($1, 'Prepare daily operations report', 'Generate and distribute the daily KPI and operations summary.', 'completed', 'medium'),
        ($1, 'Review unallocated viewing resources', 'Identify and reassign unallocated property viewing time slots.', 'in_progress', 'high'),
        ($2, 'Research Dubai property agencies', 'Identify top-tier Dubai real estate agencies for outreach.', 'completed', 'normal'),
        ($2, 'Prepare outreach drafts for ABC Properties', 'Draft personalised outreach messages for ABC Properties LLC.', 'awaiting_approval', 'high'),
        ($1, 'Prepare weekly KPI summary', 'Compile all weekly metrics into an executive summary.', 'pending', 'normal')
      ON CONFLICT DO NOTHING;
    `, [paId, caId]);
    console.log('[seed] ✅ Agent tasks seeded');

    // ── 4. Agent Runs ──────────────────────────────────────────────────────
    const runResult = await client.query(`
      INSERT INTO agent_runs (agent_id, status, started_at, completed_at, result_summary)
      VALUES
        ($1, 'completed', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 50 min',
         '{"message":"Daily operations report generated successfully","recordsProcessed":42}'),
        ($2, 'completed', NOW() - INTERVAL '1 hour 30 min', NOW() - INTERVAL '1 hour 15 min',
         '{"message":"Qualified 4 new prospects from Bayut portal","leadsFound":4}'),
        ($1, 'completed', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '50 min',
         '{"message":"Resource reassignment request created for review","slotsAffected":1}')
      RETURNING id, agent_id;
    `, [paId, caId]);
    console.log('[seed] ✅ Agent runs seeded');

    const runs = runResult.rows;
    const paRun1 = runs.find(r => r.agent_id === paId)?.id;
    const caRun1 = runs.find(r => r.agent_id === caId)?.id;

    // ── 5. Approvals ───────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO approvals (agent_id, agent_run_id, action_type, description, status)
      VALUES
        ($2, $4, 'outreach_draft', 'Outreach Draft for ABC Properties (Downtown Dubai) — High lead score (94/100) matched 2BR Downtown Dubai portfolio opportunity.', 'pending'),
        ($1, $3, 'resource_reassignment', 'Update Operational Resource Assignment — Reassign Agent Sarah viewing slot to Yas Island lead inquiry.', 'pending'),
        ($2, $4, 'outreach_draft', 'Outreach Draft for Al Reem Pearl Investments — Off-plan luxury penthouse inquiry on Al Reem Island.', 'pending')
      ON CONFLICT DO NOTHING;
    `, [paId, caId, paRun1, caRun1]);
    console.log('[seed] ✅ Approvals seeded');

    // ── 6. Companies ───────────────────────────────────────────────────────
    const companyResult = await client.query(`
      INSERT INTO companies (name, website, location, industry)
      VALUES
        ('ABC Properties LLC',         'https://abcproperties.ae',   'Downtown Dubai',           'Real Estate'),
        ('Apex Luxury Real Estate',    'https://apexluxury.ae',      'Dubai Marina',             'Real Estate'),
        ('Yas Island Heights',         'https://yasislandheights.ae','Abu Dhabi',                'Real Estate Development'),
        ('Gulf Horizon Brokerage',     'https://gulfhorizon.ae',     'Business Bay, Dubai',      'Real Estate Brokerage'),
        ('Al Reem Pearl Investments',  'https://alreempearl.ae',     'Al Reem Island, Abu Dhabi','Real Estate Investment')
      ON CONFLICT DO NOTHING
      RETURNING id, name;
    `);
    console.log('[seed] ✅ Companies seeded');

    const companyMap = {};
    companyResult.rows.forEach(r => { companyMap[r.name] = r.id; });

    // ── 7. Contacts ────────────────────────────────────────────────────────
    const contactResult = await client.query(`
      INSERT INTO contacts (company_id, name, job_title)
      VALUES
        ($1, 'Tariq Al Hashimi',   'Director of Acquisitions'),
        ($2, 'Sarah Jenkins',      'Head of Business Development'),
        ($3, 'Hamdan Al Nahyan',   'CEO'),
        ($4, 'Michael Vance',      'Managing Broker'),
        ($5, 'Fatima Al Suwaidi',  'Investment Manager')
      ON CONFLICT DO NOTHING
      RETURNING id, name;
    `, [
      companyMap['ABC Properties LLC'],
      companyMap['Apex Luxury Real Estate'],
      companyMap['Yas Island Heights'],
      companyMap['Gulf Horizon Brokerage'],
      companyMap['Al Reem Pearl Investments'],
    ]);
    console.log('[seed] ✅ Contacts seeded');

    const contactRows = contactResult.rows;

    // ── 8. Leads ───────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO leads (company_id, contact_id, source, status, score, notes)
      VALUES
        ($1, $6,  'Bayut Portal',      'awaiting_approval', 94, 'Strong match for 2BR Downtown Dubai portfolio.'),
        ($2, $7,  'Property Finder',   'qualified',          91, 'Dubai Marina luxury segment.'),
        ($3, $8,  'WhatsApp Business', 'qualified',          88, 'Off-plan inquiry for Abu Dhabi project.'),
        ($4, $9,  'Dubizzle',          'in_review',          79, 'Commercial brokerage opportunity.'),
        ($5, $10, 'Website Chatbot',   'awaiting_approval',  86, 'Penthouse inquiry on Al Reem Island.')
      ON CONFLICT DO NOTHING;
    `, [
      companyMap['ABC Properties LLC'],
      companyMap['Apex Luxury Real Estate'],
      companyMap['Yas Island Heights'],
      companyMap['Gulf Horizon Brokerage'],
      companyMap['Al Reem Pearl Investments'],
      contactRows[0]?.id,
      contactRows[1]?.id,
      contactRows[2]?.id,
      contactRows[3]?.id,
      contactRows[4]?.id,
    ]);
    console.log('[seed] ✅ Leads seeded');

    // ── 9. Schedules ───────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO schedules (agent_id, name, schedule_type, cron_expression, enabled)
      VALUES
        ($1, 'Daily Operations Report', 'cron', '0 8 * * 1-5', true),
        ($1, 'Weekly KPI Summary',      'cron', '0 9 * * 1',   true),
        ($2, 'Morning Prospect Scan',   'cron', '0 7 * * 1-5', true)
      ON CONFLICT DO NOTHING;
    `, [paId, caId]);
    console.log('[seed] ✅ Schedules seeded');

    await client.query('COMMIT');
    console.log('\n[seed] 🎉 All demo data seeded successfully.');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[seed] ❌ Seed failed — transaction rolled back.');
    console.error(err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
