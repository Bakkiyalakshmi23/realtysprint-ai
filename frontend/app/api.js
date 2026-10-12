/**
 * RealtySprint AI — Frontend API Client (frontend/app/api.js)
 * Step 5C: Connects the Control Center UI to the backend API.
 *
 * ─ All backend URLs are centralised here. ─
 * To change the backend address, update API_BASE_URL only.
 *
 * Every function:
 *  - Returns { ok: true, data: [...] } on success
 *  - Returns { ok: false, error: '...' } on failure
 *  - Never throws — the caller always gets a safe result object
 */

// Determine API base URL dynamically based on environment
const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = isLocal ? 'http://localhost:4000' : "https://api.realitysprint.co.in";

/**
 * Core fetch wrapper with timeout and graceful error handling.
 * @param {string} endpoint  - e.g. '/api/health'
 * @param {number} timeoutMs - request timeout in ms (default 8000)
 */
function demoAuthHeaders() {
  if (typeof Auth === 'undefined' || !Auth.isAuthenticated()) return {};

  try {
    const sessionData = sessionStorage.getItem('realtysprint_demo_session');
    if (sessionData) {
      const parsed = JSON.parse(sessionData);
      if (parsed.token) {
        return { 'Authorization': 'Bearer ' + parsed.token };
      }
    }
  } catch(e) {}

  return {};
}

async function apiFetch(endpoint, timeoutMs = 8000, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      signal: controller.signal,
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...demoAuthHeaders(), ...(options.headers || {}) },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    clearTimeout(timer);

    if (!response.ok) {
      let message = `Server returned ${response.status}: ${response.statusText}`;
      try {
        const body = await response.json();
        if (typeof body.error === 'string') message = body.error;
        else if (body.error?.message) message = body.error.message;
      } catch { /* Keep the HTTP status message. */ }
      return { ok: false, error: message, status: response.status };
    }

    const json = await response.json();
    return { ok: true, data: json };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Request timed out — backend may be unavailable.' };
    }
    return {
      ok: false,
      error: err.message.includes('Failed to fetch')
        ? 'Backend unavailable — could not connect to http://localhost:4000'
        : err.message,
    };
  }
}

// ─── Public API functions ────────────────────────────────────────────────────

/** GET /api/health — backend health + database connectivity */
async function getHealth() {
  return apiFetch('/api/health');
}

/** GET /api/agents — all AI agents */
async function getAgents() {
  return apiFetch('/api/agents');
}

/** GET /api/tasks — all agent tasks */
async function getTasks() {
  return apiFetch('/api/tasks');
}

/** GET /api/leads — lead pipeline */
async function getLeads() {
  return apiFetch('/api/leads');
}

/** GET /api/approvals — pending approvals */
async function getApprovals() {
  return apiFetch('/api/approvals');
}

/** GET /api/activity — recent agent activity */
async function getActivity() {
  return apiFetch('/api/activity');
}

async function executeAgent(agent, action, input = {}, { useAI = false } = {}) {
  return apiFetch('/api/agents/execute', 25000, { method: 'POST', body: { agent, action, input: { ...input, useAI } } });
}

async function reviewApproval(id, decision) {
  return apiFetch(`/api/approvals/${encodeURIComponent(id)}/review`, 8000, { method: 'POST', body: { decision } });
}

async function handoverLead(id, handover) {
  return apiFetch(`/api/leads/${encodeURIComponent(id)}/handover`, 12000, { method: 'POST', body: handover });
}

async function getBusinessSummary() {
  return apiFetch('/api/business/summary');
}

async function getAIStatus() {
  return apiFetch('/api/ai/status');
}

async function getClients() {
  return apiFetch('/api/clients');
}

async function getClient(id) {
  return apiFetch(`/api/clients/${encodeURIComponent(id)}`);
}

// ─── Utility helpers ─────────────────────────────────────────────────────────

/**
 * Format a status string into a CSS class name for .status-badge
 * Maps API status values → existing CSS classes
 */
function statusBadgeClass(status) {
  if (!status) return 'pending';
  const s = status.toLowerCase().replace(/[_\s]/g, '-');
  const map = {
    'completed':         'completed',
    'success':           'completed',
    'in-progress':       'in-progress',
    'in-review':         'in-progress',
    'running':           'in-progress',
    'awaiting-approval': 'awaiting',
    'awaiting':          'awaiting',
    'pending':           'pending',
    'failed':            'failed',
    'qualified':         'completed',
    'approved':          'completed',
    'rejected':          'failed',
    'cancelled':         'failed',
    'new':               'pending',
  };
  return map[s] || 'pending';
}

/**
 * Friendly label for a status string
 */
function statusLabel(status) {
  if (!status) return 'Unknown';
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Priority color CSS variable name
 */
function priorityColor(priority) {
  const p = (priority || '').toLowerCase();
  if (p === 'high' || p === 'critical') return 'var(--red-danger)';
  if (p === 'medium')                   return 'var(--amber-warning)';
  return 'var(--blue-primary)';
}

/**
 * Agent tag class based on slug or name
 */
function agentTagClass(agentName) {
  const n = (agentName || '').toLowerCase();
  return n.includes('client') || n.includes('acquisition') ? 'tag-acq' : 'tag-pa';
}

/**
 * Short agent label for table cells
 */
function agentShortName(agentName) {
  const n = (agentName || '').toLowerCase();
  return n.includes('client') || n.includes('acquisition')
    ? 'Client Acquisition'
    : 'Company PA';
}

/**
 * Format ISO timestamp → human time string
 */
function formatTime(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

/**
 * Format ISO date → short date string
 */
function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return isoString;
  }
}

/**
 * Score colour based on value
 */
function scoreColor(score) {
  if (score >= 88) return 'var(--green-accent)';
  if (score >= 75) return 'var(--blue-primary)';
  return 'var(--amber-warning)';
}

/**
 * Render a backend-unavailable error banner into a container element.
 * @param {HTMLElement} container
 * @param {string} errorMsg
 */
function renderApiError(container, errorMsg) {
  if (!container) return;
  container.innerHTML = `
    <div style="
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.25);
      border-radius: 12px;
      padding: 1.5rem 2rem;
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      margin: 1rem 0;
    ">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--red-danger)" stroke-width="2" style="flex-shrink:0;margin-top:2px">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div>
        <h4 style="font-size:1rem;font-weight:800;color:var(--red-danger);margin-bottom:0.25rem">
          Backend Unavailable
        </h4>
        <p style="font-size:0.9rem;color:var(--text-body);margin:0">
          ${errorMsg || 'Could not reach the API server. Make sure the backend is running on http://localhost:4000.'}
        </p>
        <p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem">
          Run: <code style="background:rgba(0,0,0,0.08);padding:2px 6px;border-radius:4px">npm start</code> in the <code style="background:rgba(0,0,0,0.08);padding:2px 6px;border-radius:4px">backend/</code> directory.
        </p>
      </div>
    </div>
  `;
}

/**
 * Render a loading skeleton placeholder into a container
 * @param {HTMLElement} container
 * @param {string} message
 */
function renderLoading(container, message = 'Loading data from API…') {
  if (!container) return;
  container.innerHTML = `
    <div style="
      display:flex;align-items:center;gap:0.75rem;
      padding:1.5rem;color:var(--text-muted);font-size:0.9rem;
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           style="animation:spin 1s linear infinite">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      ${message}
    </div>
  `;
}

/**
 * Render a small "data source" pill showing whether data came from DB or demo
 * @param {HTMLElement} container
 * @param {string} source  'database' | 'demo'
 */
function renderSourceBadge(container, source) {
  if (!container) return;
  const isDb = source === 'database';
  container.innerHTML = `
    <span style="
      display:inline-flex;align-items:center;gap:0.3rem;
      font-size:0.72rem;font-weight:700;
      padding:0.2rem 0.6rem;border-radius:20px;
      background:${isDb ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'};
      color:${isDb ? 'var(--green-accent)' : 'var(--amber-warning)'};
      letter-spacing:0.02em;
    ">
      <span style="width:6px;height:6px;border-radius:50%;background:currentColor;display:inline-block"></span>
      ${isDb ? 'Live Database' : 'Demo Data'}
    </span>
  `;
}

// Expose as a global object (no bundler needed for vanilla HTML pages)
window.API = {
  getHealth,
  getAgents,
  getTasks,
  getLeads,
  getApprovals,
  getActivity,
  executeAgent,
  reviewApproval,
  handoverLead,
  getBusinessSummary,
  getAIStatus,
  getClients,
  getClient,
  // Helpers
  statusBadgeClass,
  statusLabel,
  priorityColor,
  agentTagClass,
  agentShortName,
  formatTime,
  formatDate,
  scoreColor,
  renderApiError,
  renderLoading,
  renderSourceBadge,
};

// Inject spin keyframe once
(function injectSpinStyle() {
  if (document.getElementById('api-spin-style')) return;
  const style = document.createElement('style');
  style.id = 'api-spin-style';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
})();
