const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db/pool');

const router = express.Router();

/**
 * Validates Meta WhatsApp signature manually using native crypto.
 */
function verifyWhatsAppSignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  try {
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const passedSig = signature.replace('sha256=', '');
    return passedSig === expectedSig;
  } catch (err) {
    return false;
  }
}

/**
 * Validates Svix signature manually using native crypto.
 */
function verifySvixSignature(headers, rawBody, secret) {
  if (!secret) return false;
  try {
    const msgId = headers['svix-id'];
    const msgTimestamp = headers['svix-timestamp'];
    const msgSignature = headers['svix-signature'];

    if (!msgId || !msgTimestamp || !msgSignature) return false;

    // Check timestamp to prevent replay attacks (e.g. 5 mins tolerance)
    const now = Math.floor(Date.now() / 1000);
    if (now - parseInt(msgTimestamp, 10) > 300) return false;

    const toSign = `${msgId}.${msgTimestamp}.${rawBody}`;
    const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');

    const expectedSig = crypto
      .createHmac('sha256', secretBytes)
      .update(toSign)
      .digest('base64');

    const passedSigs = msgSignature.split(' ').map(s => s.split(',')[1]);
    return passedSigs.includes(expectedSig);
  } catch (err) {
    return false;
  }
}

// Mount raw body parser just for webhooks to preserve signature bytes
router.post('/resend', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = req.body.toString('utf8');
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).send('Invalid JSON');
  }

  // Verify signature in real mode
  if (process.env.EMAIL_PROVIDER_MODE === 'real') {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!verifySvixSignature(req.headers, rawBody, secret)) {
      return res.status(401).send('Invalid signature');
    }
  }

  const eventId = payload.id || req.headers['svix-id'] || `mock-${Date.now()}`;
  const eventType = payload.type;

  const client = await pool.connect();
  try {
    // Idempotency check
    const check = await client.query(
      'INSERT INTO webhook_events (provider, event_id, event_type, payload) VALUES ($1, $2, $3, $4) ON CONFLICT (event_id) DO NOTHING RETURNING id',
      ['resend', eventId, eventType, payload]
    );
    if (check.rows.length === 0) {
      return res.status(200).send('Already processed');
    }

    if (payload.data && payload.data.email_id) {
      const emailId = payload.data.email_id;
      let newStatus = null;
      if (eventType === 'email.delivered') newStatus = 'delivered';
      if (eventType === 'email.bounced') newStatus = 'bounced';
      if (eventType === 'email.complained') newStatus = 'failed';

      if (newStatus) {
        await client.query('UPDATE email_dispatches SET status = $1 WHERE provider_message_id = $2', [newStatus, emailId]);
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).send('Internal Server Error');
  } finally {
    client.release();
  }
});

// --- WHATSAPP WEBHOOKS ---

// Meta Webhook Verification
router.get('/whatsapp', (req, res) => {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }
  return res.sendStatus(400);
});

// Meta Webhook Event Processing
router.post('/whatsapp', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = req.body.toString('utf8');
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return res.status(400).send('Invalid JSON');
  }

  if (process.env.WHATSAPP_PROVIDER_MODE === 'real') {
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
    const signature = req.headers['x-hub-signature-256'];
    if (!verifyWhatsAppSignature(rawBody, signature, secret)) {
      return res.status(401).send('Invalid signature');
    }
  }

  // Handle messages vs statuses
  if (payload.object === 'whatsapp_business_account') {
    const client = await pool.connect();
    try {
      for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;

          if (value.statuses) {
            // Delivery receipts
            for (const status of value.statuses) {
              const eventId = status.id;
              const newStatus = status.status; // sent, delivered, read, failed

              // Idempotency
              const check = await client.query(
                'INSERT INTO webhook_events (provider, event_id, event_type, payload) VALUES ($1, $2, $3, $4) ON CONFLICT (event_id) DO NOTHING RETURNING id',
                ['whatsapp', eventId, newStatus, status]
              );

              if (check.rows.length > 0) {
                // Not a duplicate
                await client.query('UPDATE whatsapp_dispatches SET status = $1 WHERE provider_message_id = $2', [newStatus, eventId]);
              }
            }
          }

          if (value.messages) {
            // Inbound messages (Opt-in tracking)
            for (const message of value.messages) {
              const phone = message.from;
              // User initiated a message, they opt in and open 24h window
              await client.query(
                `INSERT INTO whatsapp_opt_ins (phone_number, has_opted_in, opted_in_at, last_inbound_at)
                 VALUES ($1, true, NOW(), NOW())
                 ON CONFLICT (phone_number) DO UPDATE SET has_opted_in = true, last_inbound_at = NOW()`,
                [phone]
              );
            }
          }
        }
      }
      res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
      console.error('WhatsApp Webhook error:', err);
      res.status(500).send('Internal Server Error');
    } finally {
      client.release();
    }
  } else {
    res.sendStatus(404);
  }
});

module.exports = router;
