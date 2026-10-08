# RealtySprint AI — Backend API Service

Node.js + Express.js REST API service for the **RealtySprint AI Workforce Control Center**.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: v14 or higher *(required for live database; falls back to demo data if unavailable)*

---

## Installation & Setup

### 1. Navigate to the backend directory

```bash
cd D:\RealitySprint-AI\backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your real values:

```bash
# Server
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:8000

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=realtysprint
DB_USER=realtysprint_user
DB_PASSWORD=your_secure_password_here
DB_POOL_MAX=10
DB_SSL=false
```

**Never commit `.env` to version control.**

---

## PostgreSQL Setup

### 1. Install PostgreSQL

Download and install from https://www.postgresql.org/download/windows/

### 2. Create the database and user

```sql
-- Run as postgres superuser:
psql -U postgres

CREATE USER realtysprint_user WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE realtysprint OWNER realtysprint_user;
GRANT ALL PRIVILEGES ON DATABASE realtysprint TO realtysprint_user;
\q
```

### 3. Run migrations

```bash
npm run migrate
```

Creates all 13 tables with indexes, foreign keys, and constraints.

### 4. Run seed

```bash
npm run seed
```

Inserts demo data: 2 agents, 5 tasks, 5 leads, 3 approvals, 3 agent runs, 5 companies, 5 contacts, 3 schedules.

---

## Running the Server

### Development Mode (hot reload via nodemon):

```bash
npm run dev
```

### Production Mode:

```bash
npm start
```

Default API: `http://localhost:4000`

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | `GET` | Health check — includes database connectivity status |
| `/api/agents` | `GET` | AI agents (Company PA + Client Acquisition) |
| `/api/tasks` | `GET` | Agent task queue and statuses |
| `/api/leads` | `GET` | Real estate lead pipeline |
| `/api/approvals` | `GET` | Human-in-the-loop approval requests |
| `/api/activity` | `GET` | Chronological agent activity log |
| `/api/agents/execute` | `POST` | Authenticated execution for the two registered agents |
| `/api/approvals/:id/review` | `POST` | Founder review of an internal draft; does not send it |
| `/api/leads/:id/handover` | `POST` | Founder-confirmed won-client handover, delivery task, and expected revenue |
| `/api/business/summary` | `GET` | Authenticated actual/expected revenue and delivery aggregates |
| `/api/ai/status` | `GET` | Provider readiness and model name, never API keys |

Company records and agent execution endpoints require the development demo session (`x-demo-session: realtysprint-demo-session`), which the signed-in demo dashboard adds automatically. Demo authentication is deliberately disabled in production; configure production authentication before deployment. Health and AI readiness status are public and contain no business data or secrets.

### Optional AI provider

Agent actions use deterministic, clearly labelled DEMO output by default. Set `AI_PROVIDER` explicitly to `gemini` or `openai` to opt into that provider; unset, `demo`, or an unsupported value does not make external model requests. Configure only the key for the selected provider:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash

# Or select OpenAI instead:
# AI_PROVIDER=openai
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini
```

Keys stay on the backend. Both providers return structured JSON and all agent outputs pass local schema validation. Provider diagnostics expose only sanitized status/error details. If the selected key is missing, the service is unavailable, or output fails validation, the action returns deterministic DEMO output and an AI status. No outbound client communication is performed; proposals and follow-ups remain drafts.

---

## Database Health Check

```bash
curl http://localhost:4000/api/health
```

**Connected response:**
```json
{
  "success": true,
  "status": "online",
  "database": { "connected": true, "latencyMs": 3 }
}
```

**Disconnected response (graceful fallback — all endpoints still work):**
```json
{
  "success": true,
  "status": "online",
  "database": { "connected": false, "error": "connect ECONNREFUSED 127.0.0.1:5432" }
}
```

---

## Migration Commands

| Command | Description |
|---|---|
| `npm run migrate` | Apply all pending SQL migrations from `database/migrations/` |
| `npm run seed` | Insert demo data (idempotent — safe to re-run) |
| `node --test test/step5d.test.js` | Run agent, API, workflow, provider, auth and public-site regression tests |

---

## Project Structure

```
backend/
  config/
    config.js           ← All config from env vars
  db/
    pool.js             ← pg connection pool + testConnection()
    migrate.js          ← SQL migration runner
  middleware/
    errorHandler.js     ← Centralized error middleware
  routes/
    health.js           ← GET /api/health (+ DB check)
    agents.js           ← GET /api/agents
    tasks.js            ← GET /api/tasks
    leads.js            ← GET /api/leads
    approvals.js        ← GET /api/approvals
    activity.js         ← GET /api/activity
  services/
    demoData.js         ← Fallback demo data
  server.js             ← Express app entry point
  .env.example          ← Environment variable template
  package.json

database/
  migrations/
    001_initial_schema.sql   ← All 13 tables
    002_mvp_workflows.sql    ← Proposal review, client handover, projects, revenue
  seeds/
    seed.js                  ← Demo data seed
  README.md
```

---

## Architecture Notes

- Routes **try DB first**, fall back to `demoData.js` if PostgreSQL is unavailable.
- All DB config comes from environment variables — no hardcoded secrets.
- JSONB columns used for flexible agent data (`capabilities`, `result_summary`, `qualification`).
- `schema_migrations` table tracks applied migrations (auto-created on first run).

---

## Step Status

| Step | Description | Status |
|---|---|---|
| 5A | Express API Foundation | ✅ Complete |
| 5B | PostgreSQL Database Foundation | ✅ Complete |
| 5D | Two-agent execution, backend permissions, approval workflow | ✅ Complete |
| MVP workflows | Optional AI, structured agent analysis, handover and expected revenue | ✅ Implemented; apply migration 002 for PostgreSQL |
| Production Auth | JWT + bcrypt | ⏳ Not part of this MVP |
