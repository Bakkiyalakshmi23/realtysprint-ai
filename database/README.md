# RealtySprint AI — Database

PostgreSQL database schema and seed data for the RealtySprint AI Workforce Control Center.

---

## Technology

| Component | Choice |
|---|---|
| Database | PostgreSQL 15+ |
| Migration tool | Custom Node.js runner (`backend/db/migrate.js`) |
| Seed tool | Node.js script (`database/seeds/seed.js`) |
| Client | `pg` (node-postgres) with connection pooling |

---

## Directory Structure

```
database/
  migrations/
    001_initial_schema.sql   ← All 13 tables
  seeds/
    seed.js                  ← Demo data seed script
  README.md                  ← This file
```

---

## Tables (13 total)

| Table | Description |
|---|---|
| `users` | Admin and control-center users |
| `agents` | AI agent registry (Company PA + Client Acquisition) |
| `agent_tasks` | Tasks assigned to each agent |
| `agent_runs` | Execution runs per agent |
| `agent_actions` | Individual actions taken within a run |
| `approvals` | Human-in-the-loop approval queue |
| `companies` | Real estate companies (leads pipeline) |
| `contacts` | Individual contacts at companies |
| `leads` | Qualified leads with scoring |
| `outreach_drafts` | AI-generated outreach messages awaiting approval |
| `schedules` | Agent schedule configuration |
| `notifications` | User notifications |
| `errors` | Agent error log |

---

## PostgreSQL Setup

### 1. Install PostgreSQL

Download from https://www.postgresql.org/download/windows/ and install.  
Make sure `psql` is available in your PATH.

### 2. Create the database and user

```sql
-- Run as the postgres superuser:
psql -U postgres

CREATE USER realtysprint_user WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE realtysprint OWNER realtysprint_user;
GRANT ALL PRIVILEGES ON DATABASE realtysprint TO realtysprint_user;
\q
```

### 3. Configure environment variables

```bash
# In backend/.env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=realtysprint
DB_USER=realtysprint_user
DB_PASSWORD=your_secure_password_here
DB_SSL=false
```

---

## Running Migrations

```bash
cd backend
npm run migrate
```

Expected output:
```
[migrate] ▶  Applying: 001_initial_schema.sql
[migrate] ✅ Applied:  001_initial_schema.sql

[migrate] Done. 1 migration(s) applied.
```

### Re-running migrations

Migrations are idempotent — already-applied files are skipped:
```
[migrate] ⏭  Skipped (already applied): 001_initial_schema.sql
[migrate] Done. 0 migration(s) applied.
```

---

## Running the Seed

```bash
cd backend
npm run seed
```

Seeds the following demo data:
- 1 admin user
- 2 AI agents (Company PA, Client Acquisition)
- 5 agent tasks
- 3 agent runs
- 3 approvals
- 5 companies
- 5 contacts
- 5 leads
- 3 schedules

The seed is **idempotent** — safe to run multiple times using `ON CONFLICT DO NOTHING`.

---

## Database Health Check

```bash
curl http://localhost:4000/api/health
```

Expected response when connected:
```json
{
  "success": true,
  "service": "RealtySprint AI API",
  "status": "online",
  "database": {
    "connected": true,
    "latencyMs": 3
  }
}
```

Expected response when disconnected (graceful fallback):
```json
{
  "database": {
    "connected": false,
    "error": "connect ECONNREFUSED 127.0.0.1:5432"
  }
}
```

---

## Cloud / Hosted PostgreSQL

For hosted services (Supabase, Railway, Render), set:

```bash
DB_HOST=your-host.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_cloud_password
DB_SSL=true
```

---

## Notes

- Never commit `.env` — use `.env.example` as the template.
- `password_hash` in the `users` table stores bcrypt hashes only — never plain text.
- The demo seed inserts a placeholder hash that must be replaced before any production use.
- JSONB columns (`capabilities`, `qualification`, `result_summary`, `input_data`, `output_data`) allow flexible schema for agent data without over-engineering.
