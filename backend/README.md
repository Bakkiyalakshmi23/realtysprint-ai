# RealtySprint AI — Backend API Service

Node.js + Express.js REST API service for the **RealtySprint AI Workforce Control Center**.

---

## Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

---

## Installation & Setup

1. **Navigate to the backend directory**:
   ```bash
   cd D:\RealitySprint-AI\backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables (optional)**:
   Copy `.env.example` to `.env` if custom overrides are needed:
   ```bash
   PORT=4000
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:8000
   ```

---

## Running the Server

### Development Mode (with hot reloading via nodemon):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

Default API Port: `4000` (`http://localhost:4000`)

---

## API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Health check endpoint returning server status |
| `/api/agents` | `GET` | Returns list of active AI agents (`company-pa`, `client-acquisition`) |
| `/api/tasks` | `GET` | Returns AI workforce task queue & execution statuses |
| `/api/leads` | `GET` | Returns real estate lead pipeline (Dubai & Abu Dhabi) |
| `/api/approvals` | `GET` | Returns human-in-the-loop pending approval requests |
| `/api/activity` | `GET` | Returns chronological agent activity audit stream |

---

## Example Test Requests

### 1. Health Check:
```bash
curl http://localhost:4000/api/health
```

### 2. Fetch Agents:
```bash
curl http://localhost:4000/api/agents
```

### 3. Fetch Lead Pipeline:
```bash
curl http://localhost:4000/api/leads
```

---

## Demo Data & Architecture Notes
- All endpoints currently serve centralized mock data managed inside `services/demoData.js`.
- **Step 5B+ Roadmap**: This mock service layer will be replaced with PostgreSQL / Supabase database connections and OpenAI runtime integrations.
