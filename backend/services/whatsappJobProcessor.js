const { pool } = require('../db/pool');
const { sendWhatsapp } = require('./whatsappProvider');

/**
 * Worker handler for 'whatsapp_dispatch' queue jobs.
 */
async function processWhatsappDispatchJob(job) {
  const { dispatchId } = job.payload;

  const client = await pool.connect();
  let dispatch;
  try {
    const res = await client.query('SELECT * FROM whatsapp_dispatches WHERE id = $1 FOR UPDATE', [dispatchId]);
    dispatch = res.rows[0];

    if (!dispatch) throw new Error(`Dispatch record ${dispatchId} not found`);
    if (dispatch.status !== 'pending' && dispatch.status !== 'failed') {
      return;
    }
  } finally {
    client.release();
  }

  const providerResult = await sendWhatsapp({
    phone: dispatch.recipient_phone,
    templateName: dispatch.template_name,
    templateData: dispatch.template_data
  });

  if (providerResult.status === 'failed') {
    throw new Error(providerResult.error_details || 'Provider delivery failed');
  }

  await pool.query(`
    UPDATE whatsapp_dispatches
    SET status = $1, provider_message_id = $2, error_details = $3, dispatched_at = NOW()
    WHERE id = $4
  `, [providerResult.status, providerResult.provider_message_id || null, providerResult.error_details || null, dispatch.id]);

  if (providerResult.status === 'sent') {
    if (dispatch.outreach_draft_id) {
      await pool.query(`UPDATE outreach_drafts SET status = 'sent' WHERE id = $1`, [dispatch.outreach_draft_id]);
    }
  }
}

module.exports = { processWhatsappDispatchJob };
