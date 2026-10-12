const { pool } = require('../db/pool');
const { enqueue } = require('./queueService');

/**
 * Dispatch an approved outreach draft.
 * Enforces strict validations before triggering the email provider.
 */
async function dispatchApprovedDraft({ approvalId, expectedRecipient, expectedSubject, expectedBody }) {
  const client = await pool.connect();

  try {
    // 1. Re-validate Provider & Test Inbox Configuration
    const mode = process.env.EMAIL_PROVIDER_MODE || 'mock';
    const testInbox = process.env.EMAIL_TEST_INBOX;

    if (mode === 'real') {
      if (!testInbox) throw new Error('Cannot dispatch: EMAIL_TEST_INBOX is not configured.');

      // The recipient MUST strictly match the test inbox. No CC/BCC/Forwards.
      if (expectedRecipient !== testInbox) {
        throw new Error(`Cannot dispatch: Recipient ${expectedRecipient} is not the configured test inbox.`);
      }
    }

    // Protect against oversized messages
    if (expectedBody && expectedBody.length > 50000) {
      throw new Error('Cannot dispatch: Message body exceeds 50000 characters limit.');
    }

    // 2. Begin Transaction
    await client.query('BEGIN');

    // 3. Verify Approval Status (Row Lock)
    const approvalRes = await client.query(`
      SELECT a.status as approval_status, a.action_type, o.id as outreach_draft_id, o.subject, o.message
      FROM approvals a
      JOIN outreach_drafts o ON o.approval_id = a.id
      JOIN leads l ON l.id = o.lead_id
      WHERE a.id = $1
      FOR UPDATE
    `, [approvalId]);

    if (approvalRes.rows.length === 0) {
      throw new Error('Cannot dispatch: Approval record not found or not linked to an outreach draft.');
    }

    const { approval_status, action_type, outreach_draft_id, subject, message } = approvalRes.rows[0];

    // 4. Enforce "Approved" gate
    if (approval_status !== 'approved') {
      throw new Error(`Cannot dispatch: Approval status is '${approval_status}', expected 'approved'.`);
    }

    // 5. Enforce Content Integrity (Must match approved payload exactly)
    // Note: expectedRecipient could be the test inbox, but the original draft was for the lead.
    // In test mode, we might swap the recipient, but we must never modify the approved subject/body.
    if (subject !== expectedSubject || message !== expectedBody) {
      throw new Error('Cannot dispatch: Subject or body has been modified after approval.');
    }

    // 6. Record Dispatch Intent (Idempotency)
    // The UNIQUE(approval_id) constraint prevents duplicates.
    let dispatchId;
    try {
      const intentRes = await client.query(`
        INSERT INTO email_dispatches (approval_id, outreach_draft_id, recipient, subject, body, status)
        VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id
      `, [approvalId, outreach_draft_id, expectedRecipient, expectedSubject, expectedBody]);
      dispatchId = intentRes.rows[0].id;
    } catch (err) {
      if (err.code === '23505') { // unique violation
        throw new Error('Cannot dispatch: An email dispatch intent already exists for this approval.');
      }
      throw err;
    }

    // Commit intent before calling provider so it's auditable even if process crashes
    await client.query('COMMIT');

    // 7. Enqueue Job for Async Processing
    await enqueue('email_dispatch', { dispatchId }, { idempotencyKey: `dispatch_intent_${dispatchId}`, maxAttempts: 5 });

    return {
      dispatchId,
      status: 'pending'
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Dispatch an approved outreach draft via WhatsApp.
 * Enforces WhatsApp opt-in constraints and test modes.
 */
async function dispatchWhatsappDraft({ approvalId, expectedPhone, expectedTemplateName, expectedTemplateData }) {
  const client = await pool.connect();
  try {
    const mode = process.env.WHATSAPP_PROVIDER_MODE || 'mock';
    const testPhone = process.env.WHATSAPP_TEST_PHONE;

    if (mode === 'real') {
      if (!testPhone) throw new Error('Cannot dispatch: WHATSAPP_TEST_PHONE is not configured.');
      if (expectedPhone !== testPhone) {
        throw new Error(`Cannot dispatch: Phone ${expectedPhone} is not the configured test phone.`);
      }
    }

    await client.query('BEGIN');

    const approvalRes = await client.query(`
      SELECT a.status as approval_status, a.action_type, o.id as outreach_draft_id
      FROM approvals a
      JOIN outreach_drafts o ON o.approval_id = a.id
      WHERE a.id = $1
      FOR UPDATE
    `, [approvalId]);

    if (approvalRes.rows.length === 0) {
      throw new Error('Cannot dispatch: Approval record not found or not linked to an outreach draft.');
    }

    const { approval_status, outreach_draft_id } = approvalRes.rows[0];

    if (approval_status !== 'approved') {
      throw new Error(`Cannot dispatch: Approval status is '${approval_status}', expected 'approved'.`);
    }

    // Check opt-in (in real mode, if template name is not provided, we need active 24h window or opt in)
    const optInRes = await client.query('SELECT has_opted_in FROM whatsapp_opt_ins WHERE phone_number = $1', [expectedPhone]);
    const hasOptedIn = optInRes.rows[0]?.has_opted_in;

    if (mode === 'real' && !expectedTemplateName && !hasOptedIn) {
      // Note: for strict compliance, we should check last_inbound_at for the 24h window.
      // Simplified here: if no template, they must be opted in.
      throw new Error('Cannot dispatch: Recipient has not opted in for non-template messages.');
    }

    let dispatchId;
    try {
      const intentRes = await client.query(`
        INSERT INTO whatsapp_dispatches (approval_id, outreach_draft_id, recipient_phone, template_name, template_data, status)
        VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id
      `, [approvalId, outreach_draft_id, expectedPhone, expectedTemplateName, JSON.stringify(expectedTemplateData || {})]);
      dispatchId = intentRes.rows[0].id;
    } catch (err) {
      if (err.code === '23505') {
        throw new Error('Cannot dispatch: A WhatsApp dispatch intent already exists for this approval.');
      }
      throw err;
    }

    await client.query('COMMIT');

    await enqueue('whatsapp_dispatch', { dispatchId }, { idempotencyKey: `wa_dispatch_intent_${dispatchId}`, maxAttempts: 5 });

    return {
      dispatchId,
      status: 'pending'
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { dispatchApprovedDraft, dispatchWhatsappDraft };
