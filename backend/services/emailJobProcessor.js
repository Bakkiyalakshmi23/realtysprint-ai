const { pool } = require('../db/pool');
const { sendEmail } = require('./emailProvider');

/**
 * Worker handler for 'email_dispatch' queue jobs.
 */
async function processEmailDispatchJob(job) {
  const { dispatchId } = job.payload;

  const client = await pool.connect();
  let dispatch;
  try {
    const res = await client.query('SELECT * FROM email_dispatches WHERE id = $1 FOR UPDATE', [dispatchId]);
    dispatch = res.rows[0];

    if (!dispatch) throw new Error(`Dispatch record ${dispatchId} not found`);
    // If it's already sent, or in an unknown state that shouldn't be retried blindly
    if (dispatch.status !== 'pending' && dispatch.status !== 'failed') {
      return; // Already processed
    }
  } finally {
    client.release();
  }

  // Idempotency key for provider prevents duplicate emails on network retries
  const idempotencyKey = `email_dispatch_${dispatch.id}_attempt_${job.attempts}`;

  const providerResult = await sendEmail({
    recipient: dispatch.recipient,
    subject: dispatch.subject,
    body: dispatch.body,
    idempotencyKey
  });

  if (providerResult.status === 'failed') {
    // Throwing here triggers the queueService exponential backoff
    throw new Error(providerResult.error_details || 'Provider delivery failed');
  }

  // Update dispatch record with success or 'unknown' (e.g. timeout)
  await pool.query(`
    UPDATE email_dispatches
    SET status = $1, provider_message_id = $2, error_details = $3, dispatched_at = NOW()
    WHERE id = $4
  `, [providerResult.status, providerResult.provider_message_id || null, providerResult.error_details || null, dispatch.id]);

  if (providerResult.status === 'sent') {
    if (dispatch.outreach_draft_id) {
      await pool.query(`UPDATE outreach_drafts SET status = 'sent' WHERE id = $1`, [dispatch.outreach_draft_id]);
    }
  }
}

module.exports = { processEmailDispatchJob };
