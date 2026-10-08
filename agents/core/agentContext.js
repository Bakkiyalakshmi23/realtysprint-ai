/**
 * RealtySprint AI — Agent Core: Agent Context
 * agents/core/agentContext.js
 *
 * Validated execution context passed to every agent operation.
 * Rejects malformed inputs before any agent code runs.
 *
 * Fields:
 *   agent       {string}  - agent slug (required)
 *   user        {object}  - authenticated user info (required)
 *   action      {string}  - action to perform (required)
 *   input       {object}  - action-specific input data
 *   permissions {string[]} - user permission scopes
 *   metadata    {object}  - request metadata
 *   traceId     {string}  - correlation ID for logging
 *   demoMode    {boolean} - whether to use demo data
 *   timestamp   {string}  - ISO timestamp
 */

'use strict';

const crypto = require('crypto');

const SECRET_KEY = /(?:secret|token|password|api[_-]?key|credential|authorization)/i;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// Keep only bounded, JSON-safe input fields. Secret-like keys are excluded before
// context reaches an agent or an approval draft.
function sanitize(value, depth = 0) {
  if (depth > 6) throw new Error('Input nesting exceeds the supported limit.');
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value.length > 4000) throw new Error('Input strings must be 4000 characters or fewer.');
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 50) throw new Error('Input arrays may contain at most 50 items.');
    return value.map(item => sanitize(item, depth + 1));
  }
  if (!isPlainObject(value)) throw new Error('Input must contain only plain JSON objects.');
  const entries = Object.entries(value);
  if (entries.length > 50) throw new Error('Input objects may contain at most 50 fields.');
  return Object.fromEntries(entries
    .filter(([key]) => !SECRET_KEY.test(key))
    .map(([key, item]) => [key, sanitize(item, depth + 1)]));
}

/**
 * Create and validate an agent execution context.
 *
 * @param {object} raw - raw input object from API controller
 * @returns {{ ok: true, context: object } | { ok: false, error: string }}
 */
function create(raw) {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'Context must be a non-null object.' };
  }

  // Required fields
  if (!raw.agent || typeof raw.agent !== 'string' || !raw.agent.trim()) {
    return { ok: false, error: 'Context requires a non-empty "agent" string (agent slug).' };
  }

  if (!raw.action || typeof raw.action !== 'string' || !raw.action.trim()) {
    return { ok: false, error: 'Context requires a non-empty "action" string.' };
  }

  if (!raw.user || typeof raw.user !== 'object') {
    return { ok: false, error: 'Context requires a "user" object with authenticated user information.' };
  }

  if (!raw.user.email && !raw.user.id) {
    return { ok: false, error: 'Context "user" must contain at least an email or id.' };
  }

  let input;
  try {
    input = raw.input === undefined ? {} : sanitize(raw.input);
    if (!isPlainObject(input)) throw new Error('Input must be a plain object.');
    if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 16000) {
      throw new Error('Input must be 16 KB or smaller.');
    }
  } catch (error) {
    return { ok: false, error: error.message };
  }

  if (raw.traceId !== undefined && (typeof raw.traceId !== 'string' || raw.traceId.length > 128)) {
    return { ok: false, error: 'Trace ID must be a string of 128 characters or fewer.' };
  }

  // Build clean context — never include secrets or caller-supplied permissions.
  const context = {
    agent:       raw.agent.trim().toLowerCase(),
    action:      raw.action.trim().toLowerCase(),
    user: {
      id:    raw.user.id    || null,
      email: raw.user.email || null,
      name:  raw.user.name  || null,
      role:  raw.user.role  || 'user',
    },
    input,
    permissions: [],
    metadata:    {},
    traceId:     raw.traceId || crypto.randomUUID(),
    demoMode:    raw.demoMode !== false, // default true (safe)
    timestamp:   new Date().toISOString(),
  };

  return { ok: true, context };
}

/**
 * Validate an already-created context object.
 * Used internally and in tests.
 */
function validate(context) {
  if (!context || typeof context !== 'object') return { ok: false, error: 'Context is null or not an object.' };
  if (!context.agent)  return { ok: false, error: 'Context missing "agent".' };
  if (!context.action) return { ok: false, error: 'Context missing "action".' };
  if (!context.user || (!context.user.email && !context.user.id)) {
    return { ok: false, error: 'Context missing valid "user".' };
  }
  return { ok: true };
}

module.exports = { create, validate };
