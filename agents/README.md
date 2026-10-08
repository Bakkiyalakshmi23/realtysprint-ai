# RealtySprint AI — Agent Architecture

## Overview

Step 5D implements the AI Workforce foundation for RealtySprint AI.

**Two active agents:**

| Agent | Slug | Role |
|-------|------|------|
| Founder PA | `company-pa` | Central operating and management brain. Reports to Founder. Tracks ₹50L revenue target. |
| Client Acquisition | `client-acquisition` | Business growth and sales. Qualifies leads, prepares proposals. All external comms require approval. |

---

## Directory Structure

```
agents/
├── index.js                    ← System initializer (registers both agents)
├── README.md
│
├── core/
│   ├── agentBase.js            ← BaseAgent class (execution lifecycle)
│   ├── agentRegistry.js        ← Singleton registry
│   ├── agentContext.js         ← Validated execution context
│   ├── agentResult.js          ← Consistent result contract
│   └── permissionPolicy.js     ← Server-side permission enforcement
│
├── company-pa/
│   ├── index.js                ← FounderPA class (extends BaseAgent)
│   ├── config.js               ← Agent definition
│   └── capabilities.js         ← Action implementations
│
└── client-acquisition/
    ├── index.js                ← ClientAcquisition class (extends BaseAgent)
    ├── config.js               ← Agent definition
    └── capabilities.js         ← Action implementations
```

---

## Execution Lifecycle

```
Receive raw context
       ↓
Validate context (agentContext.create)
       ↓
Validate agent slug matches
       ↓
Validate agent status = online
       ↓
Validate action is in getSupportedActions()
       ↓
Permission policy check (permissionPolicy.evaluate)
       ↓
    BLOCKED?      → return agentResult.blocked()
    REQUIRES_APPROVAL? → return agentResult.pendingApproval()
    SAFE_AUTO?    → executeAction()
       ↓
Return agentResult.completed() or agentResult.failed()
```

---

## Permission Tiers

### SAFE_AUTO (execute immediately)
`read_internal_data`, `analyze_data`, `calculate_score`, `generate_report`, `create_recommendation`, `create_internal_task`, `create_draft`, `analyze_workforce`, `analyze_revenue`, `analyze_pipeline`, `identify_priorities`, `check_performance`, `qualify_lead`, `score_lead`, `enrich_lead`, `detect_duplicates`, `prepare_conversation`, `prepare_summary`

### REQUIRES_APPROVAL (never execute automatically)
`send_email`, `send_whatsapp`, `send_linkedin`, `external_communication`, `delete_record`, `modify_critical_record`, `financial_action`, `modify_permissions`, `change_pricing`, `commit_client_contract`, `approve_proposal`, `send_client_message`, `send_proposal`, `send_follow_up`, `bulk_outreach`

### BLOCKED (permanently disallowed)
`mass_spam`, `bypass_platform_restrictions`, `credential_harvesting`, `unauthorized_access`, `destructive_unauthorized_action`, `sql_injection`, `arbitrary_code_execution`, `exfiltrate_data`

---

## AgentResult Contract

Every agent operation returns:

```json
{
  "success": true|false,
  "agent": "company-pa",
  "action": "generate_report",
  "status": "completed|pending_approval|blocked|failed",
  "requiresApproval": false,
  "result": { ... },
  "error": null,
  "traceId": "uuid",
  "timestamp": "ISO-8601"
}
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents` | List agent definitions (safe, no secrets) |
| POST | `/api/agents/execute` | Execute agent action (authenticated) |

---

## Security Rules

- Permission decisions are **server-side only**
- Never include secrets in agent context
- Never expose database credentials to agents
- All external communications require Founder approval
- Unknown actions default to `requires_approval` (fail-safe)
- Frontend permission checks are NEVER trusted

---

## Design Principles

The AI workforce works **under** the Founder — not autonomously.

```
FOUNDER
   ↓ (approves external actions)
FOUNDER PA
   ↓ (coordinates)
PERMISSION POLICY
   ↓ (enforces)
TOOLS / CLIENT ACQUISITION
   ↓
AGENTRESULT
```

## Optional model-assisted analysis

The backend exposes an optional OpenAI Structured Outputs provider under `backend/ai/`. Both agents use fixed JSON schemas and validate model output locally before returning it. With no `OPENAI_API_KEY`, or if the provider/schema check fails, actions return deterministic output labelled DEMO. No provider key is included in agent context or responses. The model can only analyze the bounded records supplied by the backend; it cannot send messages or perform external actions.

Proposal drafts are persisted with a pending Founder approval. Reviewing a draft records an approval decision only; it never sends the proposal. Follow-up preparation also returns an unsent draft. Founder-confirmed won leads can be handed to Company PA, which receives a delivery kickoff task and an expected revenue record. Expected contract value is not counted as received revenue.

Backend setup, optional provider configuration, authenticated endpoints and test command are documented in `backend/README.md`.
